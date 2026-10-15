// Everything is reversible: the undo timeline, local grammar versions, drafts, and the plain
// labels they show ("added “ugly” to Who · descriptor"). Pure: no DOM, no storage. Loaded after
// engine.js; app.js keeps the stores and draws the History sheet. Tests load it in node (test/).

// ---------- the timeline ----------
// One undo list for every kind of action: tuning the piece, grammar edits, the word bank, the
// cast, drafts. An entry is plain data { kind, label, ... }; whoever records it also knows how to
// apply it, so undo and redo take an apply(entry, back) that returns false if it couldn't.
const TIMELINE_MAX = 200;
function makeTimeline(max = TIMELINE_MAX) {
  return { done: [], undone: [], max };
}
function tlRecord(t, entry) {
  if (entry.at === undefined) entry.at = Date.now();
  t.done.push(entry);
  if (t.done.length > t.max) t.done.splice(0, t.done.length - t.max);
  t.undone.length = 0;
  return entry;
}
// Undo (back) or redo the latest entry. Returns the entry, or null if there was none or apply
// refused it (then it stays where it was).
function tlStep(t, back, apply) {
  const from = back ? t.done : t.undone;
  const to = back ? t.undone : t.done;
  const e = from[from.length - 1];
  if (!e) return null;
  if (apply(e, back) === false) return null;
  from.pop();
  to.push(e);
  return e;
}
const tlUndo = (t, apply) => tlStep(t, true, apply);
const tlRedo = (t, apply) => tlStep(t, false, apply);
// Drop entries that no longer apply (piece steps from a jam you've left, say).
function tlDrop(t, pred) {
  for (const list of [t.done, t.undone]) for (let i = list.length - 1; i >= 0; i--) if (pred(list[i])) list.splice(i, 1);
}
// The timeline as one list, newest first: undone entries (redo-able) above, then done ones.
// n is how far to go to reach that row: redos (n > 0) to redo it, undos (n < 0) to undo it.
function tlRows(t) {
  const up = t.undone.map((e, i) => ({ e, undone: true, n: t.undone.length - i }));
  const down = t.done.map((e, i) => ({ e, undone: false, n: -(t.done.length - i) })).reverse();
  return [...up, ...down];
}

// ---------- local grammar versions ----------
// Every saved edit to a grammar in your library is a version: { n, at, label, doc }. A store per
// grammar is { cur, list }, cur being the version in use. Undoing an edit moves cur back (nothing
// is deleted); restoring an old version saves it again as a new one. Up to VERSIONS_MAX are kept;
// pruning drops the oldest, never the current one or any in keep (drafts pin theirs).
const VERSIONS_MAX = 50;
function verInit(doc, label = "first version", at = Date.now()) {
  return { cur: 1, list: [{ n: 1, at, label, doc }] };
}
const verGet = (store, n) => store?.list.find((v) => v.n === n) || null;
const verCur = (store) => verGet(store, store?.cur);
const verLast = (store) => store.list[store.list.length - 1];
// Save doc as the next version and make it current. Returns the new version.
function verPush(store, doc, label, at = Date.now(), max = VERSIONS_MAX, keep = []) {
  const v = { n: verLast(store).n + 1, at, label, doc };
  store.list.push(v);
  store.cur = v.n;
  verPrune(store, max, keep);
  return v;
}
// Restore an older version: saved again as a new version (the old one stays where it was).
function verRestore(store, n, at = Date.now(), max = VERSIONS_MAX, keep = []) {
  const old = verGet(store, n);
  if (!old) return null;
  return verPush(store, clone(old.doc), `restored v${n}`, at, max, keep);
}
function verPrune(store, max = VERSIONS_MAX, keep = []) {
  const spare = new Set([store.cur, ...keep]);
  for (let i = 0; store.list.length > max && i < store.list.length;) {
    if (spare.has(store.list[i].n)) i++;
    else store.list.splice(i, 1);
  }
  return store;
}
// The version next to n, going back (dir -1) or forward (+1), for stepping a preview.
function verStep(store, n, dir) {
  const i = store.list.findIndex((v) => v.n === n);
  return store.list[i + dir]?.n ?? null;
}

// Stored compactly: the first version whole, each later one as what changed from the one before,
// two levels deep (a card's schema, a form, the rules), since an edit usually touches one of them.
// A forked grammar is ~25 KB, so fifty whole copies would crowd localStorage.
function deltaOf(a, b) {
  const set = {}, del = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(k in b)) { del.push(k); continue; }
    if (same(a[k], b[k])) continue;
    const x = a[k], y = b[k];
    if (x && y && typeof x === "object" && typeof y === "object" && !Array.isArray(x) && !Array.isArray(y)) {
      for (const j of new Set([...Object.keys(x), ...Object.keys(y)])) {
        if (!(j in y)) del.push(`${k}.${j}`);
        else if (!same(x[j], y[j])) set[`${k}.${j}`] = y[j];
      }
    } else set[k] = y;
  }
  return { set, del };
}
function applyDelta(a, { set = {}, del = [] }) {
  const out = clone(a);
  for (const p of del) {
    const [k, j] = p.split(".");
    if (j === undefined) delete out[k];
    else if (out[k] && typeof out[k] === "object") delete out[k][j];
  }
  for (const [p, v] of Object.entries(set)) {
    const [k, j] = p.split(".");
    if (j === undefined) out[k] = clone(v);
    else { if (!out[k] || typeof out[k] !== "object" || Array.isArray(out[k])) out[k] = {}; out[k][j] = clone(v); }
  }
  return out;
}
function packVersions(store) {
  let prev = null;
  const list = store.list.map((v) => {
    const row = { n: v.n, at: v.at, label: v.label };
    if (prev) row.d = deltaOf(prev, v.doc); else row.doc = v.doc;
    prev = v.doc;
    return row;
  });
  return { cur: store.cur, list };
}
function unpackVersions(packed) {
  if (!packed || !Array.isArray(packed.list) || !packed.list.length) return null;
  let prev = null;
  const list = [];
  for (const row of packed.list) {
    if (!Number.isInteger(row?.n)) return null;
    const doc = row.doc ? row.doc : prev && row.d ? applyDelta(prev, row.d) : null;
    if (!doc) return null;
    list.push({ n: row.n, at: +row.at || 0, label: String(row.label || "").slice(0, 160), doc });
    prev = doc;
  }
  const cur = list.some((v) => v.n === packed.cur) ? packed.cur : list[list.length - 1].n;
  return { cur, list };
}

// ---------- drafts ----------
// A draft is a named snapshot of the piece, kept in this browser: { id, name, at, snap }. Newest
// first, up to DRAFTS_MAX.
const DRAFTS_MAX = 30;
function draftsAdd(list, draft, max = DRAFTS_MAX) {
  return [draft, ...list.filter((d) => d.id !== draft.id)].slice(0, max);
}
// "Draft 3", or the next free number.
function draftName(list) {
  let n = list.length + 1;
  while (list.some((d) => d.name === `Draft ${n}`)) n++;
  return `Draft ${n}`;
}

// ---------- labels ----------
// "Who · descriptor": the card and the slot, from the grammar in use.
function slotName(schema, k, g = G) {
  const card = g.cards.find((c) => c.key === schema);
  const part = g.schemas[schema]?.parts.find((p) => p.k === k);
  return `${card ? card.label : schema} · ${part ? part.name : k}`;
}
const quote = (t) => `“${String(t).replace(/\{thing\}/g, "…").trim()}”`;
// The word at a path in a phrase, as text with pronouns filled in, and where it sits.
function wordAt(slot, ph, path, who) {
  const at = ph && locate(slot, ph, path);
  if (!at || !(at.k in at.ph.w)) return null;
  return { text: pron(entryOf(at.schema, at.k, at.ph.w[at.k]).t, who), where: slotName(at.schema, at.k) };
}
const whoIn = (pick) => (G.pronouns && pick[G.pronouns] ? word(G.pronouns, pick[G.pronouns], "n") : THEY);
// A plain label for a step of the piece, from the two sides of it ({ G, pick, beats, form, len,
// dial, seed }, as app.js takes them).
function pieceLabel(from, to) {
  if (from.G !== to.G) {
    if (from.G.id === to.G.id) return `${to.G.name}, another version`;
    return `switched to ${to.G.name}`;
  }
  return withGrammar(to.G, () => {
    if (from.form !== to.form) return `form: ${FORMS[to.form]?.name || to.form}`;
    if (from.dial !== to.dial) return `${(G.rules.dialName || "dial").toLowerCase()}: ${G.rules.dialLabels[to.dial]}`;
    const paths = [];
    for (const c of SLOTS) {
      const a = from.pick[c.key], b = to.pick[c.key];
      if (!a || !b) { if (a !== b) paths.push([c.key, null]); continue; }
      for (const p of diffPhrase(c.key, a, b)) paths.push([c.key, p.split(".")]);
    }
    if (paths.length === 1 && paths[0][1]) {
      const [slot, path] = paths[0];
      const a = wordAt(slot, from.pick[slot], path, whoIn(from.pick));
      const b = wordAt(slot, to.pick[slot], path, whoIn(to.pick));
      if (a && b) return `${quote(a.text)} → ${quote(b.text)} in ${b.where}`;
      if (b) return `added ${quote(b.text)} to ${b.where}`;
      if (a) return `removed ${quote(a.text)} from ${a.where}`;
    }
    const cards = [...new Set(paths.map(([k]) => k))];
    if (cards.length === 1) return `rerolled ${SLOTS.find((c) => c.key === cards[0])?.label || cards[0]}`;
    if (cards.length > 1) return "shuffled";
    if (from.len !== to.len) return to.len > from.len ? `added a stanza (${to.len})` : `cut a stanza (${to.len})`;
    if (from.seed !== to.seed) return "retold";
    const beats = [...new Set([...Object.keys(from.beats), ...Object.keys(to.beats)])].filter((k) => from.beats[k] !== to.beats[k]);
    if (beats.length === 1) {
      const name = FORMS[to.form]?.beats[beats[0]]?.name || beats[0];
      return to.beats[beats[0]] === undefined ? `${name}: back to the dice` : `retuned the line: ${name}`;
    }
    if (beats.length) return "retuned lines";
    return "changed the piece";
  });
}
const bankLabel = (e, added) => {
  const g = resolveGrammar(e.g || "story-bits");
  const where = g && g.schemas[e.s] ? slotName(e.s, e.k, g) : `${e.s} · ${e.k}`;
  return added ? `added ${quote(e.t)} to ${where}` : `removed ${quote(e.t)} from ${where}`;
};

// ---------- a piece under another version of its grammar ----------
// For previewing: the snapshot told with doc instead, or null if it doesn't fit (a word it uses
// is gone, its form was removed...). doc rides along as .gram, like parseSnapshot's.
function snapshotUnder(snap, doc) {
  if (!doc || !snap) return null;
  const fm = doc.forms[snap.f];
  if (!fm || snap.l > fm.stanzas.length) return null;
  if (!withGrammar(doc, () => doc.cards.every((c) => validPhrase(c.key, snap.p[c.key], 0)))) return null;
  const out = { ...clone(snap), b: Object.fromEntries(Object.entries(snap.b || {}).filter(([k]) => fm.beats[k])) };
  Object.defineProperty(out, "gram", { value: doc, enumerable: false });
  return out;
}
