// Story Bits: tune a piece word by word, in a grammar you can swap, fork and share.
// This is the page: rendering, the picker, events, storage and boot. The engine (phrases, the
// dial, beats, snapshots, links) is in engine.js, loaded first. See docs/design.md.

// Your library: grammars you've forked, written or imported, kept in this browser.
const LIB_KEY = "story-bits-grammars";
function loadLibrary() {
  try {
    const out = {};
    for (const g of JSON.parse(localStorage.getItem(LIB_KEY)) || []) if (!checkGrammar(g) && !GRAMMARS[g.id]) out[g.id] = g;
    return out;
  } catch { return {}; }
}
function saveLibrary() {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(Object.values(library))); } catch {}
}
library = loadLibrary();

// ---------- word bank (yours, kept in this browser) ----------
const BANK_KEY = "story-bits-bank";
function loadBank() {
  try { return (JSON.parse(localStorage.getItem(BANK_KEY)) || []).filter((e) => e && typeof e.t === "string"); } catch { return []; }
}
function saveBank() {
  try { localStorage.setItem(BANK_KEY, JSON.stringify(bank)); } catch {}
}
bank = loadBank();
// Adds checked, new words. Returns how many were added.
function addToBank(entries) {
  let n = 0;
  for (let e of entries) {
    e = { ...e, g: e.g || "story-bits" };
    const gram = resolveGrammar(e.g);
    if (!gram || checkEntry(e, gram) || builtinHas(e, gram) || bank.some((b) => sameWord(b, e))) continue;
    bank.push(e);
    n++;
  }
  saveBank();
  return n;
}

// ---------- actions ----------
function reroll(keys) {
  rerollPick(keys);
  render();
}
function setValue(slot, path, val) {
  state.pick[slot] = variants(slot, path, [val])[0];
  render();
}
// A random word for this slot, within the dial if possible.
function surprise(slot, path) {
  const at = locate(slot, state.pick[slot], path);
  const vals = options(at.schema, partOf(at.schema, at.k), at.depth).filter((v) => !same(v, at.ph.w[at.k]));
  if (!vals.length) return;
  pickFrom(slot, variants(slot, path, vals));
  render();
}
// Fill an empty optional slot (a ghost), then open it in the picker.
function addWord(slot, path) {
  const at = locate(slot, state.pick[slot], path);
  if (!at) return;
  pickFrom(slot, variants(slot, path, options(at.schema, partOf(at.schema, at.k), at.depth)));
  state.sel = { slot, path, occ: 0 };
  render();
}
function removeWord(slot, path) {
  const top = clone(state.pick[slot]);
  const at = locate(slot, top, path);
  dropWord(at.schema, at.ph, at.k);
  state.pick[slot] = top;
  state.sel = null;
  render();
}
// A new telling: fresh beats from a new seed, except pinned beats, which keep their line.
function retell() {
  const ctx = context();
  const keep = beatChoices(ctx);
  state.seed = 1 + rand(1e9);
  state.beats = Object.fromEntries(Object.entries(keep).filter(([k]) => state.pins.includes(`beat|${k}`)));
  if (state.sel && state.sel.beat) state.sel = null;
  render();
}
function setBeat(key, i) {
  state.beats = { ...state.beats, [key]: i };
  render();
}
function togglePin(slot, path) {
  const key = `${slot}|${path.join(".")}`;
  state.pins = state.pins.includes(key) ? state.pins.filter((p) => p !== key) : [...state.pins, key];
  render();
}
// Use your own text in a slot. It inherits the current word's register and mood, and joins your bank.
function useOwn(slot, path, text) {
  const t = cleanWord(text);
  if (!t) return;
  const at = locate(slot, state.pick[slot], path);
  const cur = word(at.schema, at.ph, at.k);
  const e = { g: G.id, s: at.schema, k: at.k, t, tier: cur.tier };
  const dets = detsFor(e.s, e.k, G);
  if (needsMood(e.s, e.k, G)) e.v = cur.v ?? 0;
  if (dets) e.det = dets.includes(cur.det) ? cur.det : dets[0];
  if (needsPronouns(e.s, e.k, G)) e.pr = Object.keys(PRON).find((k) => PRON[k].p === cur.p) || "they";
  const err = checkEntry(e, G);
  if (err) { toast(err); return; }
  if (addToBank([e])) toast(`Added “${t}” to your word bank.`);
  renderBank();
  setValue(slot, path, asValue(e));
}

// ---------- the picker ----------
function crumbs(slot, path) {
  const names = [SLOTS.find((s) => s.key === slot).label];
  let schema = slot;
  path.forEach((k, i) => {
    names.push(partOf(schema, k).name);
    if (i < path.length - 1) {
      const inner = subSchema(schema, locate(slot, state.pick[slot], path.slice(0, i + 1)).ph, k);
      names.push(SLOTS.find((c) => c.key === inner)?.label.toLowerCase() || inner);
      schema = inner;
    }
  });
  return names;
}

let pickerVals = [];
function renderBeatPicker(el, key) {
  const ctx = context();
  const cur = beatChoices(ctx)[key];
  const opts = beatOptions(key, ctx);
  pickerVals = opts.map((x) => x.i);
  const idx = pickerVals.indexOf(cur);
  const line = beatLines(key, ctx)[cur];
  const pinned = state.pins.includes(`beat|${key}`);
  const groups = [0, 1, 2].map((t) => {
    const items = opts.map((x, i) => ({ ...x, n: i })).filter((x) => x.l.tier === t);
    if (!items.length) return "";
    return `<div class="pk-group"><h4>${TIER_NAMES[t]}</h4>${items.map((x) =>
      `<button class="pk-opt pk-line${x.i === cur ? " cur" : ""}" data-opt="${x.n}">${esc(fillText(x.l.t, ctx))}</button>`).join("")}</div>`;
  }).join("");
  el.innerHTML = `
    <div class="pk-head">
      <span class="pk-crumb">Story › ${esc(beatGroup(key).name)}</span>
      <button class="pk-x" data-act="close" aria-label="Close">✕</button>
    </div>
    <div class="pk-step">
      <button class="pk-arrow" data-act="prev" aria-label="Plainer" ${idx <= 0 ? "disabled" : ""}>‹</button>
      <div class="pk-cur"><b class="pk-sentence">${esc(fillText(line.t, ctx))}</b>
        <span class="pk-meta"><span class="tier t${line.tier}">${TIER_NAMES[line.tier]}</span> ${idx + 1} of ${opts.length}${Number.isInteger(state.beats[key]) ? " · tuned" : ""}</span></div>
      <button class="pk-arrow" data-act="next" aria-label="Stranger" ${idx >= opts.length - 1 ? "disabled" : ""}>›</button>
    </div>
    <p class="pk-keys">← plainer · stranger →</p>
    <div class="pk-actions">
      <button data-act="surprise">Surprise me</button>
      ${state.game ? (selChanged() ? `<button data-act="putback">Put back</button>` : "") : `<button data-act="pin" aria-pressed="${pinned}">${pinned ? "Pinned" : "Pin"}</button>`}
      ${Number.isInteger(state.beats[key]) ? `<button data-act="untune">Back to the dice</button>` : ""}
    </div>
    <div class="pk-list">${groups}</div>
    ${state.room ? jamPickerHtml(`beat|${key}`, fillText(line.t, ctx)) : ""}`;
  el.classList.toggle("readonly", !!state.room && jamReadOnly());
  el.hidden = false;
  positionPicker();
}
function renderPicker() {
  const el = $("#picker");
  const sel = state.sel;
  if (sel && sel.beat) {
    if (!stanza().paras.flat().includes(sel.beat)) { state.sel = null; el.hidden = true; return; }
    renderBeatPicker(el, sel.beat);
    return;
  }
  const at = sel && state.pick[sel.slot] && locate(sel.slot, state.pick[sel.slot], sel.path);
  if (!at || !(at.k in at.ph.w)) { state.sel = null; el.hidden = true; return; }
  const part = partOf(at.schema, at.k);
  const cur = at.ph.w[at.k];
  const who = person();
  pickerVals = pickerOptions(at);
  const idx = pickerVals.findIndex((v) => same(v, cur));
  const entry = entryOf(at.schema, at.k, cur);
  const pinned = state.pins.includes(`${sel.slot}|${sel.path.join(".")}`);
  const label = (v) => pron(entryOf(at.schema, at.k, v).t, who).replace("{thing}", "…");
  const groups = [0, 1, 2].map((t) => {
    const items = pickerVals.map((v, i) => ({ v, i })).filter((x) => entryOf(at.schema, at.k, x.v).tier === t);
    if (!items.length) return "";
    return `<div class="pk-group"><h4>${TIER_NAMES[t]}</h4>${items.map((x) =>
      `<button class="pk-opt${x.i === idx ? " cur" : ""}${typeof x.v === "number" ? "" : " yours"}" data-opt="${x.i}">${esc(label(x.v))}</button>`).join("")}</div>`;
  }).join("");

  el.innerHTML = `
    <div class="pk-head">
      <span class="pk-crumb">${crumbs(sel.slot, sel.path).map(esc).join(" › ")}</span>
      <button class="pk-x" data-act="close" aria-label="Close">✕</button>
    </div>
    <div class="pk-step">
      <button class="pk-arrow" data-act="prev" aria-label="Plainer" ${idx <= 0 ? "disabled" : ""}>‹</button>
      <div class="pk-cur"><b>${esc(label(cur))}</b>
        <span class="pk-meta"><span class="tier t${entry.tier}">${TIER_NAMES[entry.tier]}</span> ${idx + 1} of ${pickerVals.length}${entry.custom ? " · yours" : ""}</span></div>
      <button class="pk-arrow" data-act="next" aria-label="Stranger" ${idx >= pickerVals.length - 1 ? "disabled" : ""}>›</button>
    </div>
    <p class="pk-keys">← plainer · stranger →</p>
    <div class="pk-actions">
      <button data-act="surprise">Surprise me</button>
      ${state.game ? (selChanged() ? `<button data-act="putback">Put back</button>` : "") : `<button data-act="pin" aria-pressed="${pinned}">${pinned ? "Pinned" : "Pin"}</button>`}
      ${part.opt ? `<button data-act="remove">Remove</button>` : ""}
      ${loreTarget() ? `<button data-act="lore" title="Keep the whole phrase in ${esc(loreTarget().name)}'s lore">Keep “${esc(phraseText(sel.slot).slice(0, 32))}” as lore</button>` : ""}
    </div>
    <div class="pk-list">${groups}</div>
    <form class="pk-own" autocomplete="off">
      <input name="own" maxlength="60" placeholder="Your own ${esc(part.name)}…" aria-label="Your own ${esc(part.name)}">
      <button type="submit">Use</button>
    </form>
    ${state.room ? jamPickerHtml(`${sel.slot}|${sel.path.join(".")}`, label(cur)) : ""}`;
  el.classList.toggle("readonly", !!state.room && jamReadOnly());
  el.hidden = false;
  positionPicker();
}

function selectedEl() {
  const s = state.sel;
  if (!s) return null;
  if (s.beat) return document.querySelector(`.beat[data-beat="${s.beat}"]`);
  const els = document.querySelectorAll(`.word[data-slot="${s.slot}"][data-path="${s.path.join(".")}"]`);
  return els[Math.min(s.occ || 0, els.length - 1)] || null;
}
function positionPicker() {
  const el = $("#picker");
  const w = selectedEl();
  if (!w) return;
  const r = w.getBoundingClientRect();
  if (innerWidth < 640) {
    // Bottom sheet; keep the word in view above it.
    el.classList.add("sheet");
    el.style.left = el.style.top = "";
    const room = innerHeight - el.offsetHeight - 16;
    if (r.bottom > room || r.top < 8) scrollBy({ top: r.top - Math.max(16, room - r.height - 40), behavior: "smooth" });
    return;
  }
  el.classList.remove("sheet");
  const width = el.offsetWidth;
  el.style.left = `${Math.max(16, Math.min(r.left + scrollX, scrollX + innerWidth - width - 16))}px`;
  el.style.top = `${r.bottom + scrollY + 10}px`;
}

function selectBeat(key) {
  state.sel = state.sel && state.sel.beat === key ? null : { beat: key };
  render();
  if (state.sel) selectedEl()?.focus({ preventScroll: true });
}
function surpriseBeat(key) {
  const ctx = context();
  const cur = beatChoices(ctx)[key];
  const opts = beatOptions(key, ctx).map((x) => x.i).filter((i) => i !== cur);
  if (opts.length) setBeat(key, opts[rand(opts.length)]);
}
function select(slot, path, el) {
  const els = [...document.querySelectorAll(`.word[data-slot="${slot}"][data-path="${path.join(".")}"]`)];
  const occ = Math.max(0, els.indexOf(el));
  if (state.sel && state.sel.slot === slot && same(state.sel.path, path) && state.sel.occ === occ) state.sel = null;
  else state.sel = { slot, path, occ };
  render();
  if (state.sel) selectedEl()?.focus({ preventScroll: true });
}
function step(dir) {
  const s = state.sel;
  if (s.beat) {
    const ctx = context();
    const opts = beatOptions(s.beat, ctx).map((x) => x.i);
    const i = opts.indexOf(beatChoices(ctx)[s.beat]) + dir;
    if (i >= 0 && i < opts.length) setBeat(s.beat, opts[i]);
    return;
  }
  const at = locate(s.slot, state.pick[s.slot], s.path);
  const vals = pickerOptions(at);
  const i = vals.findIndex((v) => same(v, at.ph.w[at.k])) + dir;
  if (i < 0 || i >= vals.length) return;
  setValue(s.slot, s.path, vals[i]);
}

// ---------- cast (characters you keep telling stories about) ----------
// Only for grammars with a pronoun card (Story Bits: who). Each entry: { g, who: phrase, bits },
// keyed by grammar and the head word under any descriptor.
const CAST_KEY = "story-bits-cast";
const castKey = (c) => `${c.g || "story-bits"}|${JSON.stringify(c.who.w.n)}`;
function loadCast() {
  try {
    const raw = JSON.parse(localStorage.getItem(CAST_KEY)) || [];
    // Older entries stored a bare index into the people list, and had no grammar.
    return raw.map((c) => (typeof c.who === "number" ? { ...c, who: { w: { n: c.who } } } : c))
      .map((c) => ({ ...c, g: c.g || "story-bits" }))
      .filter((c) => c.who && typeof c.who.w === "object" && Array.isArray(c.bits));
  } catch { return []; }
}
function saveCast() {
  try { localStorage.setItem(CAST_KEY, JSON.stringify(cast)); } catch {}
}
let cast = [];
const castHere = () => cast.map((c, i) => ({ c, i })).filter(({ c }) => c.g === G.id && G.pronouns && validPhrase(G.pronouns, c.who, 0));

function keepBit() {
  if (!G.pronouns) return;
  const ctx = context();
  const line = bitLine(ctx);
  const entry = { g: G.id, who: clone(state.pick[G.pronouns]), bits: [] };
  let c = cast.find((x) => castKey(x) === castKey(entry));
  if (!c) { c = entry; cast.unshift(c); }
  c.who = entry.who;
  if (!c.bits.includes(line)) c.bits.unshift(line);
  saveCast();
  renderCast();
  toast(`Kept. ${cap(ctx.name)} now has ${c.bits.length} ${c.bits.length === 1 ? "story" : "stories"}.`);
}
function tellAnother(i) {
  const c = cast[i];
  if (!c || c.g !== G.id || !G.pronouns) return;
  const key = G.pronouns;
  state.pick[key] = clone(c.who);
  // Pin the character's words; shuffle everything else.
  state.pins = state.pins.filter((p) => !p.startsWith(key + "|")).concat(Object.keys(c.who.w).map((k) => `${key}|${k}`));
  state.sel = null;
  reroll(SLOTS.map((x) => x.key).filter((k) => k !== key));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toHash() {
  if (state.room) return `#jam=${state.room.code}${state.room.key ? `~${state.room.key}` : ""}`;
  // Mid-challenge, the link holds the challenge and your copy, so a reload picks up where you were.
  if (state.game) return "#p=" + b64(JSON.stringify(playPayload()));
  // Comparing (and not playing): keep the set of versions in the link.
  if (state.compare) return "#cmp=" + b64(JSON.stringify({ c: state.compare.c, e: state.compare.entries.map((e) => ({ name: e.name, me: e.me })) }));
  return "#" + b64(JSON.stringify(snapshot()));
}

// A pack link carries words only: "#pack=<base64url JSON { name, words }>".
function packLink() {
  const pack = { name: "Shared words", words: bank };
  return `${location.origin}${location.pathname}#pack=${b64(JSON.stringify(pack))}`;
}
function importPack(h) {
  try {
    const pack = JSON.parse(unb64(h));
    const words = Array.isArray(pack.words) ? pack.words : [];
    const n = addToBank(words);
    toast(n ? `Added ${n} word${n === 1 ? "" : "s"} from “${cleanWord(pack.name) || "a pack"}” to your word bank.` : "Those words are already in your bank.");
  } catch { toast("That pack link couldn't be read."); }
}

// Words that reach everyone: a pre-filled GitHub issue. A maintainer labels it accepted-pack,
// and .github/workflows/word-pack.yml turns it into a pull request adding packs/issue-N.json.
const REPO = "https://github.com/reeswrites/story-bits";
function suggestLink() {
  const pack = { name: "Suggested words", words: bank };
  const body = `Words suggested from Story Bits for the shared word bank.\n\nA maintainer adds the \`accepted-pack\` label to turn this into a pull request. Edit the list below first if any words shouldn't go in.\n\n\`\`\`json\n${JSON.stringify(pack, null, 1)}\n\`\`\`\n`;
  return `${REPO}/issues/new?${new URLSearchParams({ title: `Word pack: ${bank.length} word${bank.length === 1 ? "" : "s"}`, labels: "word-pack", body })}`;
}

// Shared packs that made it into the repo: packs/index.json lists files, loaded in order and
// appended to the pools. Append-only, so the indices in older links stay put.
async function loadPacks() {
  try {
    const files = await (await fetch("packs/index.json")).json();
    for (const f of files) {
      if (!/^[\w-]+\.json$/.test(f)) continue;
      const pack = await (await fetch(`packs/${f}`)).json();
      // Whole grammars first, so the words and forms below can belong to them. An id already
      // taken is skipped, so links to a grammar never change meaning.
      for (const [id, gram] of Object.entries(pack.grammars || {})) if (!GRAMMARS[id] && gram?.id === id && !checkGrammar(gram)) GRAMMARS[id] = { ...gram, shared: true };
      for (const e of pack.words || []) {
        const gram = GRAMMARS[e.g || "story-bits"];
        if (gram && !checkEntry(e, gram) && !builtinHas(e, gram)) gram.schemas[e.s].parts.find((p) => p.k === e.k).pool.push(poolEntry(e, gram));
      }
      // Forms join a grammar by key (pack.grammar, default Story Bits); a taken key is skipped.
      const fg = GRAMMARS[pack.grammar || "story-bits"];
      if (fg) for (const [k, f] of Object.entries(pack.forms || {})) if (!fg.forms[k] && /^[a-z][a-z0-9-]{0,23}$/.test(k) && !checkForm(f, fg)) fg.forms[k] = { ...f, pack: true };
    }
  } catch {}
}


// ---------- the friends game: same bit, a few moves, compare ----------
// A challenge is a starting story plus a move budget. Everyone tunes their own copy; a move is
// any word or beat that differs from the start, so putting one back gives the move back. Then
// the copies go side by side, changes highlighted, and the room votes. No server: every copy
// is a link. Link kinds: #c= challenge, #p= a copy in progress, #s= a finished copy,
// #cmp= a set of copies to compare.
const linkTo = (kind, payload) => `${location.origin}${location.pathname}#${kind}=${b64(JSON.stringify(payload))}`;

function startGame(c, me = c.s, name = "") {
  applySnapshot(me);
  state.pins = [];
  state.sel = null;
  state.game = { c, name, good: null };
  document.body.classList.add("in-game");
  $("#challenge-panel").hidden = true;
  render();
}
function leaveGame() {
  state.game = null;
  document.body.classList.remove("in-game");
  render();
}
// Put one word or beat back the way the challenge started.
function putBack() {
  const s = state.sel;
  const start = state.game.c.s;
  if (s.beat) { setBeat(s.beat, start.b[s.beat]); return; }
  const at = locate(s.slot, start.p[s.slot], s.path);
  if (at && at.k in at.ph.w) {
    const top = clone(state.pick[s.slot]);
    const here = locate(s.slot, top, s.path);
    here.ph.w[here.k] = clone(at.ph.w[here.k]);
    if (at.ph.sub?.[here.k]) { here.ph.sub = here.ph.sub || {}; here.ph.sub[here.k] = clone(at.ph.sub[here.k]); } else if (here.ph.sub) delete here.ph.sub[here.k];
    tidy(at.schema, here.ph);
    state.pick[s.slot] = top;
    render();
  } else removeWord(s.slot, s.path);
}
// Is the selected word or beat different from the start?
function selChanged() {
  if (!state.game || !state.sel) return false;
  const key = state.sel.beat ? `beat|${state.sel.beat}` : `${state.sel.slot}|${state.sel.path.join(".")}`;
  return changes(state.game.c.s, fixedSnapshot()).some((c) => c === key || key.startsWith(c + "."));
}

function renderGameBar() {
  const bar = $("#game-bar");
  if (!state.game) { bar.hidden = true; return; }
  const { c, name } = state.game;
  const used = movesUsed();
  bar.hidden = false;
  bar.innerHTML = `
    <div class="gb-top">
      <p class="gb-title"><span class="eyebrow">${c.d ? `Today's bit · ${esc(c.h)}` : `Challenge${c.h ? ` from ${esc(c.h)}` : ""}`}</span>
        ${c.n ? `Make it yours in <b>${c.n}</b> move${c.n === 1 ? "" : "s"}. Any word or beat you change is a move; put it back to get the move back.` : `Make it yours. No move limit: everything you change shows up highlighted at the reveal.`}</p>
      ${c.n ? `<div class="gb-moves" aria-label="${used} of ${c.n} moves used">${Array.from({ length: c.n }, (_, i) => `<span class="${i < used ? "on" : ""}"></span>`).join("")}<b>${used}/${c.n}</b></div>` : `<div class="gb-moves"><b>${used} change${used === 1 ? "" : "s"}</b></div>`}
    </div>
    ${state.room ? `<div class="gb-row">
      <button id="gb-send" class="primary" ${jamCan("edit") ? "" : "hidden"}>${roomMe()?.submitted ? "Update my version" : "Send my version"}</button>
      <span class="gb-note">${roomMe()?.submitted ? "Sent. You can keep tuning and send again until the host reveals." : "Everyone's copies stay hidden until the host reveals them."}</span>
    </div>` : `<div class="gb-row">
      <label class="gb-name"><span class="dial-label">Your name</span><input id="gb-name" maxlength="${NAME_MAX}" value="${esc(name)}" placeholder="so they know it's you"></label>
      <button id="gb-submit" class="primary">Copy my version</button>
      <button id="gb-compare" class="ghost">Compare versions</button>
      <button id="gb-leave" class="ghost subtle">Leave challenge</button>
    </div>`}`;
}

// ----- compare -----
// state.compare = { c, entries: [{ name, me, votes }] }
function openCompare(c, entries = []) {
  state.compare = { c, entries: [] };
  addEntries(entries);
  $("#compare").hidden = false;
  renderCompare();
  $("#compare").scrollIntoView({ behavior: "smooth", block: "start" });
}
function addEntries(entries) {
  const cmp = state.compare;
  let added = 0, other = 0;
  for (const e of entries) {
    if (challengeId(e.c) !== challengeId(cmp.c)) { other++; continue; }
    const key = JSON.stringify(e.me) + e.name;
    if (cmp.entries.some((x) => JSON.stringify(x.me) + x.name === key)) continue;
    cmp.entries.push({ name: e.name, me: e.me, votes: 0 });
    added++;
  }
  if (other) toast(`${other} link${other === 1 ? " was" : "s were"} from a different challenge.`);
  return added;
}

function renderCompare() {
  const el = $("#compare-cards");
  const cmp = state.compare;
  if (!cmp) return;
  if (!state.game) history.replaceState(null, "", toHash());
  document.body.classList.toggle("room-compare", !!state.room);
  const top = Math.max(0, ...cmp.entries.map((e) => e.votes));
  const original = `<article class="version original"><header><h3>The original</h3><span class="count">${esc(cmp.c.d ? `today's bit · ${cmp.c.h}` : cmp.c.h ? `from ${cmp.c.h}` : "start")}</span></header>${staticHtml(cmp.c.s, [])}</article>`;
  const startHtml = currentLore().length ? staticHtml(cmp.c.s, []) : "";
  el.innerHTML = original + cmp.entries.map((e, i) => {
    const ch = changes(cmp.c.s, e.me);
    const html = staticHtml(e.me, ch);
    // A kept phrase from the space's lore, brought back: a callback.
    const calls = startHtml ? callbacksIn(html, startHtml) : [];
    return `<article class="version${top > 0 && e.votes === top ? " leading" : ""}">
      <header><h3>${esc(e.name || `Player ${i + 1}`)}</h3><span class="count">${ch.length} move${ch.length === 1 ? "" : "s"}</span></header>
      ${html}
      ${calls.length ? `<p class="callbacks"><span class="dial-label">↩ callback${calls.length === 1 ? "" : "s"}</span> ${calls.map((l) => `“${esc(cleanWord(l.text))}”`).join(", ")}</p>` : ""}
      ${state.room ? jamCardHtml(e) : ""}
      <div class="vote">${clapsOn() ? `<button class="clap" data-clap="${i}" aria-label="Clap for ${esc(e.name || `player ${i + 1}`)}" ${clapDisabled(e) ? "disabled" : ""}>👏 <b>${e.votes}</b></button>${top > 0 && e.votes === top ? `<span class="crown">${state.room?.data?.phase === "results" ? "winner" : "leading"}</span>` : ""}` : ""}${state.room && e.id === playerId() ? `<span class="crown mine">yours</span>` : ""}</div>
    </article>`;
  }).join("");
  $("#compare-empty").hidden = cmp.entries.length > 0;
}
function compareLink() {
  const cmp = state.compare;
  return linkTo("cmp", { c: cmp.c, e: cmp.entries.map((e) => ({ name: e.name, me: e.me })) });
}


// ---------- render ----------
const $ = (s) => document.querySelector(s);

function render() {
  // In a challenge, a change past the move budget is undone.
  if (state.room) jamBeforeRender();
  if (state.game && state.game.c.n > 0) {
    if (movesUsed() > state.game.c.n && state.game.good) {
      state.pick = clone(state.game.good.pick);
      state.beats = { ...state.game.good.beats };
      toast(`That would be move ${state.game.c.n + 1} of ${state.game.c.n}. Put something back first.`);
    }
    state.game.good = { pick: clone(state.pick), beats: { ...state.beats } };
  }
  // Drop pins and selection that point at words which no longer exist.
  state.pins = state.pins.filter((key) => {
    const [slot, p] = key.split("|");
    if (slot === "beat") return !!form().beats[p];
    const at = state.pick[slot] && locate(slot, state.pick[slot], p.split("."));
    return at && at.k in at.ph.w;
  });
  const ctx = context();
  history.replaceState(null, "", toHash());

  const inPlay = stanza().slots;
  $("#legend").innerHTML = SLOTS.filter((s) => inPlay.includes(s.key)).map((s) =>
    `<button class="chip ${cardClass(s.key)}" data-roll="${s.key}" title="Reroll ${esc(s.hint || s.label)}, keeping pinned words">${esc(s.label)} <span aria-hidden="true">↻</span></button>`).join("");

  renderGameBar();
  document.body.classList.toggle("verse", !!form().lines);
  $("#bit").innerHTML = bitHtml(ctx);
  $("#story").innerHTML = story(ctx).map((p) => `<p>${p}</p>`).join("");

  $("#grammar-pick").innerHTML = grammarOptions();
  $("#grammar-desc").textContent = [G.description, ...(G.rules.constraints || []).map(describeConstraint).filter(Boolean).map((x) => cap(x) + ".")].filter(Boolean).join(" ");
  $("#headline-name").textContent = G.headline || "The line";
  $("#dial-name").textContent = G.rules.dialName || "Dial";
  document.querySelectorAll(".dial button[data-dial]").forEach((b) => { b.textContent = G.rules.dialLabels[+b.dataset.dial]; });
  $("#forms").innerHTML = Object.entries(FORMS).map(([k, f]) =>
    `<button data-form="${k}" aria-pressed="${k === state.form}">${esc(f.name)}</button>`).join("");
  document.querySelectorAll(".dial button[data-dial]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.dial === state.dial)));
  $("#dial-note").textContent = DIAL_NOTES[state.dial];

  $("#len-n").textContent = state.len;
  $("#len-name").textContent = stanza().name;
  $("#len-down").disabled = state.len <= 1;
  $("#len-up").disabled = state.len >= maxLen();
  $("#len-pips").innerHTML = form().stanzas.map((_, i) => `<span class="${i < state.len ? "on" : ""}"></span>`).join("");

  $("#pairs").innerHTML = pairsInPlay().map((p) => {
    const c = clashes(p);
    return `<li class="${c ? "clash" : "fit"}"><span class="pair-label">${esc(p.label || `${p.a} ↔ ${p.b}`)}</span><span class="pair-state">${c ? "clashes" : "fits"}</span></li>`;
  }).join("");

  renderPicker();
  if (state.room) jamAfterRender();
}

// Switch to another grammar: a fresh piece in its first form.
function switchGrammar(id) {
  const g = typeof id === "object" ? id : resolveGrammar(id);
  if (!g || g === G) return;
  if (state.game) leaveGame();
  useGrammar(g);
  Object.assign(state, { grammar: g.id, form: Object.keys(g.forms)[0], beats: {}, pins: [], sel: null, pick: {} });
  state.len = Math.min(Math.max(state.len, 2), maxLen());
  for (const c of SLOTS) state.pick[c.key] = randomPhrase(c.key);
  state.seed = 1 + rand(1e9);
  for (const c of SLOTS.slice(1)) pickFrom(c.key, Array.from({ length: 300 }, () => randomPhrase(c.key)));
  renderBankForm();
  renderBank();
  renderCast();
  render();
  renderLibrary();
}
const allGrammars = () => [...Object.values(GRAMMARS), ...Object.values(library)];
// The grammar picker: built in and yours, then each joined space's grammars ("@SPACE/gid").
function grammarOptions() {
  const src = srcOf.get(G);
  const mine = allGrammars().map((g) => `<option value="${esc(g.id)}" ${g === G ? "selected" : ""}>${esc(g.name)}${library[g.id] ? " (yours)" : ""}</option>`).join("");
  const groups = [...spaces.list, ...(spaces.visiting ? [spaces.visiting] : [])].map((s) => spaces.data[s.id]).filter(Boolean).map((v) => {
    const gs = v.items.filter((it) => it.kind === "grammar");
    return gs.length ? `<optgroup label="${esc(v.name)}">${gs.map((it) => `<option value="@${v.id}/${esc(it.gid)}" ${src?.sp === v.id && G.id === it.gid ? "selected" : ""}>${esc(it.data.name)} v${it.head}</option>`).join("")}</optgroup>` : "";
  }).join("");
  // A pinned older version, or a grammar that came with a piece, still shows as in use.
  const here = (allGrammars().includes(G) || (src && spaceGrammar(src.sp, G.id)?.data === G)) ? "" : `<option selected>${esc(G.name)}${src ? ` v${src.ver}` : ""}</option>`;
  return here + mine + groups;
}

function setForm(key) {
  if (!FORMS[key] || key === state.form) return;
  state.form = key;
  state.len = Math.min(Math.max(state.len, 2), maxLen());
  state.beats = {};
  state.pins = state.pins.filter((p) => !p.startsWith("beat|"));
  state.sel = null;
  render();
}


function setLen(n) {
  state.len = Math.max(1, Math.min(maxLen(), n));
  render();
}

function renderCast() {
  const el = $("#cast");
  // The cast belongs to grammars with a pronoun card (characters); others don't have one.
  $(".cast-wrap").hidden = !G.pronouns;
  $("#keep").hidden = !G.pronouns;
  if (!G.pronouns) return;
  const here = castHere();
  if (!here.length) {
    el.innerHTML = `<p class="empty">Nobody yet. Keep a bit and its character joins the cast. Tell more stories about them and they start to feel like someone you know.</p>`;
    return;
  }
  el.innerHTML = here.map(({ c, i }) => {
    const pr = word(G.pronouns, c.who, "n");
    return `
    <article class="person">
      <header><h3>${esc(cap(flat(tokens(G.pronouns, c.who, pr, G.pronouns))))}</h3>
        <span class="count">${c.bits.length} ${c.bits.length === 1 ? "story" : "stories"}</span></header>
      <ul>${c.bits.slice(0, 6).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      <div class="person-actions">
        <button class="ghost" data-another="${i}">Tell another about ${esc(pr.o)}</button>
        <button class="ghost subtle" data-forget="${i}">Forget</button>
      </div>
    </article>`;
  }).join("");
}

// ---------- word bank form ----------
function renderBankForm() {
  const sel = $("#bf-slot");
  const keep = sel.value;
  sel.innerHTML = SLOTS.map((s) => `<optgroup label="${esc(s.label)}">${SCHEMAS[s.key].parts.map((p) =>
    `<option value="${s.key}.${p.k}">${esc(s.label)}: ${esc(p.name)}</option>`).join("")}</optgroup>`).join("");
  // Default to a describing slot if the grammar has one, else the first slot.
  const fallback = SLOTS.flatMap((s) => SCHEMAS[s.key].parts.filter((p) => p.k === "q").map((p) => `${s.key}.${p.k}`))[0];
  sel.value = [...sel.options].some((o) => o.value === keep) ? keep : fallback || sel.options[0].value;
  $("#bank-h").textContent = `Word bank · ${G.name}`;
  updateBankForm();
}
function formEntry() {
  const [s, k] = $("#bf-slot").value.split(".");
  const e = { g: G.id, s, k, t: cleanWord($("#bf-text").value), tier: +document.querySelector('[name="bf-tier"]:checked').value };
  if (needsMood(s, k, G)) e.v = +document.querySelector('[name="bf-mood"]:checked').value;
  if (detsFor(s, k, G)) e.det = $("#bf-det").value;
  if (needsPronouns(s, k, G)) e.pr = $("#bf-pr").value;
  return e;
}
function updateBankForm() {
  const [s, k] = $("#bf-slot").value.split(".");
  const part = partOf(s, k);
  const dets = detsFor(s, k, G);
  $("#bf-mood-row").hidden = !part.mood;
  $("#bf-det-row").hidden = !dets;
  $("#bf-pr-row").hidden = !part.pronouns;
  if (dets) {
    const d = $("#bf-det");
    const keep = d.value;
    d.innerHTML = dets.map((x) => `<option>${esc(x)}</option>`).join("");
    if (dets.includes(keep)) d.value = keep;
  }
  const e = formEntry();
  let det = e.det || "";
  const shown = e.t ? `<b>${esc(e.t)}</b>` : `<b class="blank">___</b>`;
  if (det === "a" && e.t) det = /^[aeiou]/i.test(e.t) ? "an" : "a";
  $("#bf-frame").innerHTML = esc(part.frame || "___").replace("{det}", esc(det)).replace("___", shown);
  const rules = (G.rules.constraints || []).map(describeConstraint).filter(Boolean);
  $("#bf-hint").textContent = [part.hint || `A word for “${part.name}”.`, rules.length ? `This grammar: ${rules.join("; ")}.` : ""].filter(Boolean).join(" ");
  const err = grammarClosed(G) ? "This grammar is closed: it only uses its own words. Fork it to add some." : e.t ? checkEntry(e, G) || (builtinHas(e) || bank.some((b) => sameWord(b, e)) ? "Already in the bank." : "") : "";
  $("#bf-error").textContent = err;
  $("#bf-add").disabled = !e.t || !!err;
}
function renderBank() {
  const el = $("#bank-list");
  const mineAll = bank.map((e, i) => ({ e, i })).filter((x) => gOf(x.e) === G.id && partIn(G, x.e.s, x.e.k));
  if (!mineAll.length) {
    el.innerHTML = `<p class="empty">No words of your own for ${esc(G.name)} yet. Add one above, or type your own in any word's picker.</p>`;
  } else {
    el.innerHTML = SLOTS.map((s) => {
      const mine = mineAll.filter((x) => x.e.s === s.key);
      if (!mine.length) return "";
      return `<div class="bank-group"><h4>${esc(s.label)}</h4>${mine.map((x) =>
        `<span class="bank-word" title="${esc(partOf(x.e.s, x.e.k).name)} · ${TIER_NAMES[x.e.tier]}">${esc(x.e.t)}<span class="bw-slot">${esc(partOf(x.e.s, x.e.k).name)}</span><button class="bw-x" data-unbank="${x.i}" aria-label="Remove ${esc(x.e.t)} from your bank">✕</button></span>`).join("")}</div>`;
    }).join("");
  }
  $("#bank-share").disabled = $("#bank-suggest").disabled = !mineAll.length;
  $("#bank-count").textContent = mineAll.length ? `${mineAll.length} word${mineAll.length === 1 ? "" : "s"}` : "";
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// ---------- events ----------
const pathOf = (el) => (el.dataset.path ? el.dataset.path.split(".") : []);
function copy(text, ok) {
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
    .then(() => toast(ok))
    .catch(() => window.prompt("Copy this link:", text));
}

document.addEventListener("click", (e) => {
  if (!(e.target instanceof Element)) return;
  const t = e.target.closest("button");
  const inPicker = e.target.closest("#picker");
  if (!t) {
    // A beat is any part of a story sentence that isn't a word.
    const beat = !inPicker && e.target.closest(".beat");
    if (beat) { selectBeat(beat.dataset.beat); return; }
    if (state.sel && !inPicker) { state.sel = null; render(); }
    return;
  }
  const s = state.sel;
  if (t.dataset.act) {
    const act = t.dataset.act;
    if (act === "close") { state.sel = null; render(); }
    else if (act === "prev") step(-1);
    else if (act === "next") step(1);
    else if (act === "putback") putBack();
    else if (s.beat) {
      if (act === "surprise") surpriseBeat(s.beat);
      else if (act === "pin") togglePin("beat", [s.beat]);
      else if (act === "untune") { const b = { ...state.beats }; delete b[s.beat]; state.beats = b; render(); }
    }
    else if (act === "surprise") surprise(s.slot, s.path);
    else if (act === "pin") togglePin(s.slot, s.path);
    else if (act === "remove") removeWord(s.slot, s.path);
    return;
  }
  if (t.dataset.opt !== undefined) {
    if (s.beat) setBeat(s.beat, pickerVals[+t.dataset.opt]);
    else setValue(s.slot, s.path, pickerVals[+t.dataset.opt]);
    return;
  }
  if (inPicker) return;
  if (t.classList.contains("word")) { select(t.dataset.slot, pathOf(t), t); return; }
  if (t.dataset.add) { addWord(t.dataset.add, pathOf(t)); return; }
  if (state.sel && !t.closest(".controls")) state.sel = null;
  if (t.dataset.roll) reroll([t.dataset.roll]);
  else if (t.dataset.form) setForm(t.dataset.form);
  else if (t.id === "daily") { const c = parseChallenge(dailyChallenge()); if (c) startGame(c); }
  else if (t.dataset.dial) { state.dial = +t.dataset.dial; reroll(SLOTS.map((x) => x.key)); }
  else if (t.dataset.another !== undefined) tellAnother(+t.dataset.another);
  else if (t.dataset.forget !== undefined) { cast.splice(+t.dataset.forget, 1); saveCast(); renderCast(); }
  else if (t.dataset.unbank !== undefined) { bank.splice(+t.dataset.unbank, 1); saveBank(); renderBank(); updateBankForm(); render(); }
  else if (t.id === "len-up") setLen(state.len + 1);
  else if (t.id === "len-down") setLen(state.len - 1);
  else if (t.id === "shuffle") reroll(SLOTS.map((x) => x.key));
  else if (t.id === "retell") retell();
  else if (t.id === "keep") keepBit();
  else if (t.id === "challenge") { const pnl = $("#challenge-panel"); pnl.hidden = !pnl.hidden; if (!pnl.hidden) $("#ch-name").focus(); }
  else if (t.id === "ch-copy" || t.id === "ch-play") {
    const c = { h: cleanName($("#ch-name").value), n: +document.querySelector('[name="ch-n"]:checked').value, s: fixedSnapshot() };
    if (t.id === "ch-copy") copy(linkTo("c", c), `Link copied. Everyone gets the same piece${c.n ? ` and ${c.n} move${c.n === 1 ? "" : "s"}` : ", no move limit"}.`);
    else startGame(parseChallenge(c), undefined, c.h);
  }
  else if (t.id === "gb-submit") copy(linkTo("s", playPayload()), "Your version is copied. Paste it in the group chat.");
  else if (t.id === "gb-compare") { const me = playPayload(); openCompare(state.game.c, [parseCopy(me)].filter(Boolean)); }
  else if (t.id === "gb-leave") leaveGame();
  else if (t.id === "cmp-add") {
    const text = $("#cmp-paste").value;
    prefetchText(text).then(() => {
      const n = addEntries(linksIn(text));
      $("#cmp-paste").value = "";
      toast(n ? `Added ${n} version${n === 1 ? "" : "s"}.` : "No new versions in that text.");
      renderCompare();
    });
  }
  else if (t.id === "cmp-copy") copy(compareLink(), "Compare link copied. Everyone who opens it sees all the versions.");
  else if (t.id === "cmp-play") startGame(state.compare.c, undefined, "");
  else if (t.id === "cmp-close") { state.compare = null; $("#compare").hidden = true; render(); }
  else if (t.dataset.clap !== undefined) {
    const e = state.compare.entries[+t.dataset.clap];
    if (state.room) roomSend({ t: "clap", to: e.id });
    else { e.votes++; renderCompare(); }
  }
  else if (t.id === "live") openRoom(newRoomCode());
  else if (t.id === "share") copy(location.href, "Link copied. Same words, same story.");
  else if (t.id === "bank-share") copy(packLink(), "Pack link copied. Whoever opens it gets your words in their bank.");
  else if (t.id === "bank-suggest") {
    const url = suggestLink();
    if (url.length > 7500) toast("That's a lot of words for one suggestion. Share a pack link instead, or remove a few.");
    else window.open(url, "_blank", "noopener");
  }
  else render();
});

document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.matches(".pk-own")) {
    const input = e.target.elements.own;
    if (state.sel) useOwn(state.sel.slot, state.sel.path, input.value);
  } else if (e.target.id === "bank-form") {
    const entry = formEntry();
    if (addToBank([entry])) {
      toast(`Added “${entry.t}” to your word bank. It'll turn up in shuffles.`);
      $("#bf-text").value = "";
    }
    renderBank();
    updateBankForm();
    render();
  }
});
document.addEventListener("input", (e) => {
  if (e.target instanceof Element && e.target.id === "gb-name" && state.game) {
    state.game.name = cleanName(e.target.value);
    history.replaceState(null, "", toHash());
  }
});
const inBankForm = (e) => e.target instanceof Element && e.target.closest("#bank-form");
document.addEventListener("input", (e) => { if (inBankForm(e)) updateBankForm(); });
document.addEventListener("change", (e) => {
  if (inBankForm(e)) updateBankForm();
  else if (e.target instanceof Element && e.target.id === "grammar-pick") {
    const m = /^@([A-Z0-9]{8})\/(.+)$/.exec(e.target.value);
    if (m) useSpaceGrammar(m[1], m[2]); else switchGrammar(e.target.value);
  }
});

// Hovering a word outlines the phrase it belongs to, so it's clear what a clause attaches to.
document.addEventListener("mouseover", (e) => {
  const w = e.target instanceof Element && e.target.closest(".word, .ghost-slot");
  document.querySelectorAll(".ph.hl").forEach((x) => x.classList.remove("hl"));
  if (w) w.closest(".ph")?.classList.add("hl");
});

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const target = e.target instanceof Element ? e.target : document.body;
  const typing = target.closest("input, textarea, select");
  if (!typing && (e.key === "Enter" || e.key === " ") && target.closest(".beat") && !target.closest("button")) {
    e.preventDefault();
    selectBeat(target.closest(".beat").dataset.beat);
    return;
  }
  if (state.sel && state.sel.beat && !typing) {
    const s = state.sel;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); step(-1); selectedEl()?.focus({ preventScroll: true }); return; }
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); step(1); selectedEl()?.focus({ preventScroll: true }); return; }
    if (e.key === "Escape") { state.sel = null; render(); document.querySelector(`.beat[data-beat="${s.beat}"]`)?.focus(); return; }
    if (e.key === "p") { togglePin("beat", [s.beat]); return; }
    if (e.key === "?") { surpriseBeat(s.beat); return; }
  }
  if (state.sel && !state.sel.beat && !typing) {
    const s = state.sel;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); step(-1); selectedEl()?.focus({ preventScroll: true }); return; }
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); step(1); selectedEl()?.focus({ preventScroll: true }); return; }
    if (e.key === "Escape") { state.sel = null; render(); document.querySelector(`.word[data-slot="${s.slot}"][data-path="${s.path.join(".")}"]`)?.focus(); return; }
    if (e.key === "p") { togglePin(s.slot, s.path); return; }
    if (e.key === "?") { surprise(s.slot, s.path); return; }
    if ((e.key === "Backspace" || e.key === "Delete") && partOf(locate(s.slot, state.pick[s.slot], s.path).schema, s.path[s.path.length - 1]).opt) { removeWord(s.slot, s.path); return; }
  }
  if (e.key === "Escape" && typing && state.sel) { state.sel = null; render(); return; }
  if (typing) return;
  if (state.game && [" ", "r", "+", "=", "]", "-", "["].includes(e.key)) return;
  if (e.key === " " && !target.closest("button")) { e.preventDefault(); state.sel = null; reroll(SLOTS.map((x) => x.key)); }
  else if (e.key === "r") retell();
  else if (e.key === "k") keepBit();
  else if (e.key === "+" || e.key === "=" || e.key === "]") setLen(state.len + 1);
  else if (e.key === "-" || e.key === "[") setLen(state.len - 1);
});
addEventListener("resize", () => state.sel && positionPicker());

// ---------- boot ----------
(async function boot() {
  await loadPacks();
  cast = loadCast();
  const h = location.hash.slice(1);
  const [kind, data] = h.includes("=") ? [h.slice(0, h.indexOf("=")), h.slice(h.indexOf("=") + 1)] : ["", h];
  const read = () => { try { return JSON.parse(unb64(data)); } catch { return null; } };
  // Pieces pinned to a space's grammar version: fetch those versions before parsing.
  if (["", "c", "p"].includes(kind)) { try { await prefetchRefs(JSON.parse(unb64(data))); } catch {} }
  else if (kind === "s" || kind === "cmp") await prefetchText("#" + h);
  let ready = false;
  if (kind === "pack") importPack(data);
  else if (kind === "space" || kind === "sp") {
    for (const sl of SLOTS) state.pick[sl.key] = randomPhrase(sl.key);
    state.seed = 1 + rand(1e9);
    ready = true;
    queueMicrotask(async () => { await receiveSpace(kind, data); renderSpaces(); renderLibrary(); render(); $("#spaces").scrollIntoView({ behavior: "smooth", block: "start" }); });
  }
  else if (kind === "grammar") receiveGrammar(data);
  else if ((kind === "jam" || kind === "room") && ROOM_CODE.test(data.split("~")[0])) {
    // Start with a fresh story under the room; the room takes over once connected.
    for (const sl of SLOTS) state.pick[sl.key] = randomPhrase(sl.key);
    state.seed = 1 + rand(1e9);
    ready = true;
    const [code, key = ""] = data.split("~");
    queueMicrotask(() => openRoom(code, key));
  }
  else if (h === "daily") { const c = parseChallenge(dailyChallenge()); if (c) { startGame(c); ready = true; } }
  else if (kind === "c") { const c = parseChallenge(read()); if (c) { startGame(c); ready = true; } }
  else if (kind === "p") { const cp = parseCopy(read()); if (cp) { startGame(cp.c, cp.me, cp.name); ready = true; } }
  else if (kind === "s" || kind === "cmp") {
    const copies = linksIn("#" + h);
    if (copies.length) { applySnapshot(copies[0].c.s); state.pins = []; ready = true; queueMicrotask(() => openCompare(copies[0].c, copies)); }
  }
  else ready = fromHash(h);
  if (!ready) {
    for (const s of SLOTS) state.pick[s.key] = randomPhrase(s.key);
    state.seed = 1 + rand(1e9);
    // Settle the pairs under the dial before the first render.
    for (const s of SLOTS.slice(1)) pickFrom(s.key, Array.from({ length: 300 }, () => randomPhrase(s.key)));
  }
  $("#live").hidden = !ROOMS_HOST;
  renderBankForm();
  renderBank();
  render();
  renderCast();
  renderLibrary();
  renderSpaces();
  // Spaces you've joined: fetch them (only those; nothing else leaves the browser).
  if (spaces.list.length) refreshAllSpaces();
  if (lib.incoming) $("#library").scrollIntoView({ behavior: "smooth", block: "start" });
})();
