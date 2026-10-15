// History: one undo timeline for everything, local grammar versions, drafts, and the History
// sheet that shows them. The pure parts (the timeline, versions, labels) are in timeline.js.
// Loaded before app.js; everything here runs at call time, after app.js has set up.
//
// Recording from elsewhere (the picker, say):
//   remember(kind, label, before, after)    one entry; undo puts `before` back, redo `after`
//   onUndo(kind, (value, entry) => {...})   how to put a value of that kind back
//   hintNext(label)                         a label for the next change to the piece
//   saveGrammarVersion(id, doc, label)      a new version of a library grammar (on the timeline)
// Changes to the piece itself need nothing: render() notes them.

const timeline = makeTimeline();
const undoers = {};
function onUndo(kind, fn) { undoers[kind] = fn; }
function remember(kind, label, before, after, extra = {}) {
  const e = tlRecord(timeline, { kind, label, before: clone(before), after: clone(after), ...extra });
  renderUndo();
  return e;
}

// ---------- the piece ----------
// render() notes each change to the piece as an entry { kind: "piece", from, to }. Undo puts back
// only what that step changed and renders as usual, so in a together jam it goes out as ordinary
// patches (and leaves others' edits alone), and in a challenge it counts like putting a change
// back. Changes that arrive from a jam move the baseline without adding an entry. Starting or
// leaving a jam or challenge drops the piece's entries (they were about another piece); the rest
// of the timeline stays.
let histNow = null; // { at, key, ctx }: the piece as of the last render
let histQuiet = false;
let histHint = null;
const histCtx = () => (state.game ? `g:${challengeId(state.game.c)}` : state.room ? `r:${state.room.code}` : "solo");
const histTake = () => ({ G, pick: clone(state.pick), beats: { ...state.beats }, form: state.form, len: state.len, dial: state.dial, seed: state.seed });
const histKey = (h) => JSON.stringify([h.G.id, srcOf.get(h.G)?.ver, localVer.get(h.G)?.n, h.pick, h.beats, h.form, h.len, h.dial, h.seed]);
const hintNext = (label) => { histHint = label; };
function quietly(fn) {
  const was = histQuiet;
  histQuiet = true;
  try { return fn(); } finally { histQuiet = was; }
}
function histNote() {
  const ctx = histCtx();
  const at = histTake();
  const key = histKey(at);
  if (!histNow || histNow.ctx !== ctx) {
    if (histNow) tlDrop(timeline, (e) => e.kind === "piece");
    histNow = { at, key, ctx };
    histHint = null;
    renderUndo();
    return;
  }
  if (histNow.at.G === at.G && histNow.key === key) { renderUndo(); return; }
  if (!histQuiet && !state.room?.applying) {
    tlRecord(timeline, { kind: "piece", label: histHint || pieceLabel(histNow.at, at), from: histNow.at, to: at });
    if (state.sel) countTune();
  }
  histHint = null;
  histNow = { at, key, ctx };
  renderUndo();
}
// Move the piece from one side of a step to the other, touching only what the step changed.
function histPut(want, was) {
  if (want.G !== was.G) {
    // Another version of the same grammar, or your copy of it (the picker's fork-on-write): the
    // word you're on and your pins still mean the same (render drops any that no longer fit).
    const kin = kinGrammars(want.G, was.G);
    useGrammar(want.G);
    Object.assign(state, { grammar: G.id, pick: clone(want.pick), beats: { ...want.beats }, form: want.form, len: want.len, dial: want.dial, seed: want.seed, ...(!kin && { sel: null, pins: [] }) });
    renderBankForm(); renderBank(); renderShelf(); renderLibrary();
    return;
  }
  for (const k of new Set([...Object.keys(want.pick), ...Object.keys(was.pick)])) {
    if (!same(want.pick[k], was.pick[k]) && want.pick[k]) state.pick[k] = clone(want.pick[k]);
  }
  const beats = { ...state.beats };
  for (const k of new Set([...Object.keys(want.beats), ...Object.keys(was.beats)])) {
    if (want.beats[k] === was.beats[k]) continue;
    if (want.beats[k] === undefined) delete beats[k]; else beats[k] = want.beats[k];
  }
  state.beats = beats;
  for (const f of ["form", "len", "dial", "seed"]) if (want[f] !== was[f]) state[f] = want[f];
  state.len = Math.max(1, Math.min(maxLen(), state.len));
}
const canTune = () => !(state.room && jamReadOnly());
onUndo("piece", (_, e, back) => {
  if (!canTune()) return false;
  if (back) histPut(e.from, e.to); else histPut(e.to, e.from);
  render();
});

// ---------- undo and redo ----------
function applyEntry(e, back) {
  const fn = undoers[e.kind];
  if (!fn) return false;
  return quietly(() => fn(back ? e.before : e.after, e, back));
}
const undoTop = () => timeline.done[timeline.done.length - 1];
const redoTop = () => timeline.undone[timeline.undone.length - 1];
const canStep = (e) => !!e && (e.kind !== "piece" || canTune());
function undo(say = true) {
  if (!canStep(undoTop())) return null;
  const e = tlUndo(timeline, applyEntry);
  if (e && say) toast(`Undid: ${e.label}`);
  renderUndo();
  return e;
}
function redo(say = true) {
  if (!canStep(redoTop())) return null;
  const e = tlRedo(timeline, applyEntry);
  if (e && say) toast(`Redid: ${e.label}`);
  renderUndo();
  return e;
}
// Several steps at once, from the History sheet: n < 0 undoes, n > 0 redoes.
function travel(n) {
  let done = 0, last = null;
  for (let i = 0; i < Math.abs(n); i++) { const e = n < 0 ? undo(false) : redo(false); if (!e) break; last = e; done++; }
  if (done === 1) toast(`${n < 0 ? "Undid" : "Redid"}: ${last.label}`);
  else if (done) toast(`${n < 0 ? "Undid" : "Redid"} ${done} steps.`);
}
function renderUndo() {
  const u = $("#undo"), r = $("#redo");
  if (!u) return;
  const cu = canStep(undoTop()), cr = canStep(redoTop());
  // Inline (desktop): shown only when there's something to undo or redo, so the first view stays calm.
  u.hidden = !cu;
  r.hidden = !cr;
  u.title = cu ? `Undo: ${undoTop().label} (⌘Z / Ctrl+Z)` : "Undo";
  r.title = cr ? `Redo: ${redoTop().label} (⇧⌘Z / Ctrl+Shift+Z)` : "Redo";
  // The thumb bar (phones) keeps its place: undo and redo are there, outlined when there's nothing.
  const tu = $("#tb-undo"), tr = $("#tb-redo");
  tu.disabled = !cu;
  tr.disabled = !cr;
  tu.setAttribute("aria-label", cu ? `Undo: ${undoTop().label}` : "Undo");
  tr.setAttribute("aria-label", cr ? `Redo: ${redoTop().label}` : "Redo");
  // Don't drop keyboard focus when the button you pressed goes away.
  const a = document.activeElement;
  if ((a === u && u.hidden) || (a === r && r.hidden)) (!u.hidden ? u : !r.hidden ? r : $("#shuffle")).focus();
  if (!$("#history").hidden) renderHistory();
}

// ---------- the word bank and the kept shelf ----------
onUndo("bank", (v) => { bank = clone(v); saveBank(); renderBank(); updateBankForm(); render(); });
onUndo("shelf", (v) => { shelf = clone(v); saveShelf(); renderShelf(); });

// ---------- local grammar versions ----------
// Every grammar in your library has a store of versions (timeline.js), kept in its own key.
// library[id] is always the store's current version (the same object), so a piece's grammar can
// be pinned by version. saveLibrary() notices what changed and saves new versions.
const VERSIONS_KEY = "story-bits-grammar-versions";
let versions = {}; // gid -> { cur, list }
let versionLabel = null;
function loadVersions() {
  try {
    const raw = JSON.parse(localStorage.getItem(VERSIONS_KEY)) || {};
    for (const [id, packed] of Object.entries(raw)) {
      const store = unpackVersions(packed);
      if (store && library[id]) versions[id] = store;
    }
  } catch {}
  // Line the library up with its stores; a grammar changed in another tab gets a version of its own.
  for (const [id, doc] of Object.entries(library)) {
    const store = versions[id];
    if (!store) versions[id] = verInit(doc, doc.forkedFrom ? "as it was" : "first version");
    else if (same(verCur(store).doc, doc)) library[id] = verCur(store).doc;
    else verPush(store, doc, "changed in another tab");
    for (const v of versions[id].list) setLocalVersion(v.doc, id, v.n);
  }
  saveVersions();
}
// Versions a draft pins are kept when old ones are pruned.
const pinnedVersions = (id) => drafts.filter((d) => d.snap.g === id && Number.isInteger(d.snap.lv)).map((d) => d.snap.lv);
function saveVersions() {
  const out = Object.fromEntries(Object.entries(versions).map(([id, s]) => [id, packVersions(s)]));
  try { localStorage.setItem(VERSIONS_KEY, JSON.stringify(out)); return; } catch {}
  // Full: keep fewer versions of each, oldest first, until it fits (or give up quietly).
  for (let max = VERSIONS_MAX - 10; max >= 1; max -= 10) {
    for (const [id, s] of Object.entries(versions)) verPrune(s, max, pinnedVersions(id));
    try { localStorage.setItem(VERSIONS_KEY, JSON.stringify(Object.fromEntries(Object.entries(versions).map(([id, s]) => [id, packVersions(s)])))); toast(`Storage is full: keeping the last ${max} versions of each grammar.`); return; } catch {}
  }
}
// After the library changed: new grammars get a first version, changed ones a new version, and
// deleted ones leave (their versions ride along in the timeline entry, so undo brings them back).
// Each change goes on the timeline, except an edit to the grammar a jam is using.
function syncVersions(label) {
  const made = [];
  for (const [id, doc] of Object.entries(library)) {
    const store = versions[id];
    if (!store) {
      versions[id] = verInit(doc, label || "added");
      setLocalVersion(doc, id, 1);
      made.push({ id, before: null, after: 1, label: label || `added ${doc.name}` });
    } else if (verCur(store).doc !== doc) {
      if (same(verCur(store).doc, doc)) { library[id] = verCur(store).doc; continue; }
      const was = store.cur;
      const v = verPush(store, doc, label || "changed", Date.now(), VERSIONS_MAX, pinnedVersions(id));
      setLocalVersion(doc, id, v.n);
      made.push({ id, before: was, after: v.n, label: label || `changed ${doc.name}` });
    }
  }
  for (const id of Object.keys(versions)) {
    if (library[id]) continue;
    made.push({ id, before: versions[id].cur, after: null, store: versions[id], label: label || `deleted ${verCur(versions[id]).doc.name}` });
    delete versions[id];
  }
  saveVersions();
  const out = [];
  for (const m of made) {
    if (state.room && G.id === m.id) continue;
    out.push(tlRecord(timeline, { kind: "grammar", label: m.label, id: m.id, before: m.before, after: m.after, store: m.store, where: library[m.id]?.name || m.store && verCur(m.store).doc.name }));
  }
  renderUndo();
  return out;
}
// Save doc as a new version of grammar id and use it (the picker's fork-on-write can call this).
function saveGrammarVersion(id, doc, label) {
  if (!library[id] || checkGrammar(doc)) return false;
  const before = histNow?.at;
  library[id] = doc;
  const [e] = saveLibrary(label);
  if (G.id === id) quietly(() => refreshActive(doc));
  if (e && before && histNow && histNow.at.G !== before.G) e.piece = { from: before, to: histNow.at };
  renderLibrary();
  return true;
}
// Put grammar id at version n (null: not in the library), and the piece with it if it moved.
onUndo("grammar", (n, e, back) => {
  if (n === null) {
    delete library[e.id];
    e.store = versions[e.id] || e.store;
    delete versions[e.id];
    if (lib.editing === e.id) lib.editing = null;
  } else {
    const store = versions[e.id] || (versions[e.id] = e.store);
    if (!store || !verGet(store, n)) { toast("That version is gone."); return false; }
    store.cur = n;
    library[e.id] = verCur(store).doc;
  }
  try { localStorage.setItem(LIB_KEY, JSON.stringify(Object.values(library))); } catch {}
  saveVersions();
  if (e.piece) { const [want, was] = back ? [e.piece.from, e.piece.to] : [e.piece.to, e.piece.from]; histPut(want, was); render(); }
  else if (G.id === e.id && n !== null && !state.room) refreshActive(library[e.id]);
  else if (G.id === e.id && n === null && !state.room) switchGrammar("story-bits");
  renderLibrary();
});
// Restore an old version: saved again as the newest (nothing is lost), and the piece follows.
function restoreVersion(id, n) {
  const store = versions[id];
  const old = verGet(store, n);
  if (!old) return;
  const doc = clone(old.doc);
  if (saveGrammarVersion(id, doc, `restored v${n}`)) toast(`Restored v${n} of ${doc.name} as v${store.cur}.`);
}

// ---------- drafts ----------
const DRAFTS_KEY = "story-bits-drafts";
let drafts = [];
function loadDrafts() {
  try { drafts = (JSON.parse(localStorage.getItem(DRAFTS_KEY)) || []).filter((d) => d && typeof d.id === "string" && d.snap && typeof d.snap === "object").slice(0, DRAFTS_MAX); } catch { drafts = []; }
}
function saveDrafts() {
  try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch { toast("This browser's storage is full: that draft wasn't kept."); }
}
onUndo("drafts", (v) => { drafts = clone(v); saveDrafts(); });
function saveDraft(name) {
  const snap = clone(snapshot());
  // Your own grammar is pinned by version (kept while a draft needs it); no need to carry it too.
  if (Number.isInteger(snap.lv) && versions[snap.g]) delete snap.gx;
  let line = "";
  try { line = bitLine(context()); } catch {}
  const d = { id: Math.random().toString(36).slice(2, 10), name: cleanWord(name).slice(0, 40) || draftName(drafts), at: Date.now(), snap, line: line.slice(0, 160) };
  const before = drafts;
  drafts = draftsAdd(drafts, d);
  saveDrafts();
  remember("drafts", `saved draft “${d.name}”`, before, drafts);
  toast(`Saved “${d.name}”. It's in History, under Drafts.`);
}
function deleteDraft(id) {
  const d = drafts.find((x) => x.id === id);
  if (!d) return;
  const before = drafts;
  drafts = drafts.filter((x) => x !== d);
  saveDrafts();
  remember("drafts", `deleted draft “${d.name}”`, before, drafts);
}
function openDraft(id) {
  const d = drafts.find((x) => x.id === id);
  const snap = d && parseSnapshot(d.snap);
  if (!snap) { toast("That draft can't be opened: its grammar isn't here any more."); return; }
  if (state.game) leaveGame();
  hintNext(`opened draft “${d.name}”`);
  const before = G;
  applySnapshot(snap);
  state.sel = null;
  if (G !== before) { renderBankForm(); renderBank(); renderShelf(); renderLibrary(); }
  render();
  closeHistory();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
// Drafts side by side, in the Compare view: the piece as it is now first, then each draft with
// what's different from now marked (when it's the same grammar and form).
function compareDrafts(ids) {
  const now = parseSnapshot(fixedSnapshot());
  const picked = drafts.filter((d) => ids.includes(d.id));
  const entries = picked.map((d) => ({ name: d.name, at: d.at, id: d.id, me: parseSnapshot(d.snap) })).filter((e) => e.me);
  if (!entries.length) { toast("Those drafts can't be opened here."); return; }
  closeHistory();
  state.compare = { c: { s: now }, entries, drafts: true };
  $("#compare").hidden = false;
  renderCompare();
  reveal($("#compare")).scrollIntoView({ behavior: "smooth", block: "start" });
}
// What changed from one piece to another, or null when they're too different to mark.
function draftChanges(from, to) {
  if (from.g !== to.g || from.f !== to.f || from.l !== to.l) return null;
  try { return changes(from, to); } catch { return null; }
}

// ---------- the History sheet ----------
// A full-height sheet on phones, a panel at the side on wider screens. Three views: the
// timeline, drafts, and the versions of one of your grammars.
const hist = { view: "timeline", gid: null, at: null, pick: new Set(), opener: null };
function openHistory(view = hist.view, gid) {
  hist.view = view;
  if (gid) { hist.gid = gid; hist.at = null; }
  hist.opener = document.activeElement;
  state.sel = null;
  render();
  $("#history").hidden = false;
  $("#hist-scrim").hidden = false;
  document.body.classList.add("hist-open");
  renderHistory();
  $("#history").focus({ preventScroll: true });
}
function closeHistory() {
  if ($("#history").hidden) return;
  $("#history").hidden = true;
  $("#hist-scrim").hidden = true;
  document.body.classList.remove("hist-open");
  const o = hist.opener;
  hist.opener = null;
  if (o && document.contains(o) && o.offsetParent !== null) o.focus({ preventScroll: true });
}
function ago(t) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
const KIND_NAMES = { piece: "piece", grammar: "grammar", bank: "word bank", shelf: "kept shelf", drafts: "drafts" };
function renderHistory() {
  const el = $("#history");
  const mineIds = Object.keys(library);
  if (hist.view === "versions" && !mineIds.length) hist.view = "timeline";
  const tabs = [["timeline", "Timeline"], ["drafts", `Drafts${drafts.length ? ` · ${drafts.length}` : ""}`], ...(mineIds.length ? [["versions", "Versions"]] : [])];
  const scroll = el.querySelector(".hist-body")?.scrollTop || 0;
  const again = el.contains(document.activeElement) ? focusKeyOfHist(document.activeElement) : null;
  el.innerHTML = `
    <div class="hist-head">
      <h2 id="hist-h">History</h2>
      <button class="pk-x" data-hist="close" aria-label="Close history">✕</button>
    </div>
    <div class="hist-tabs" role="tablist" aria-label="History">${tabs.map(([k, n]) => `<button role="tab" aria-selected="${hist.view === k}" data-hist-tab="${k}">${n}</button>`).join("")}</div>
    <div class="hist-body">${hist.view === "drafts" ? draftsHtml() : hist.view === "versions" ? versionsHtml() : timelineHtml()}</div>`;
  el.querySelector(".hist-body").scrollTop = scroll;
  if (again && el.querySelector(again)) el.querySelector(again).focus({ preventScroll: true });
}
function focusKeyOfHist(a) {
  for (const k of ["hist", "histTab", "histGo", "histDraft", "histOpen", "histDel", "histVer", "histRestore", "histStep"]) {
    if (a.dataset[k] !== undefined) return `[data-${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}="${a.dataset[k]}"]`;
  }
  if (a.id) return `#${a.id}`;
  return null;
}
function timelineHtml() {
  const rows = tlRows(timeline);
  if (!rows.length) return `<p class="empty">Nothing yet. Everything you change lands here (words, lines, grammar edits, the word bank, the kept shelf, drafts), and anything can be taken back.</p>`;
  const row = ({ e, undone, n }) => {
    const blocked = !canStep(e) ? " disabled" : "";
    const where = e.kind === "grammar" && e.where ? ` · ${esc(e.where)}` : "";
    return `<li class="${undone ? "undone" : ""}"><button class="hist-row" data-hist-go="${n}"${blocked} aria-label="${undone ? "Redo" : "Undo back to before"}: ${esc(e.label)}">
      <span class="hr-label">${esc(e.label)}</span>
      <span class="hr-meta">${esc(KIND_NAMES[e.kind] || e.kind)}${where} · ${ago(e.at)}${undone ? " · undone, tap to redo" : ""}</span>
    </button></li>`;
  };
  const up = rows.filter((r) => r.undone), down = rows.filter((r) => !r.undone);
  return `<div class="hist-steps"><button class="tool" data-hist="undo" ${canStep(undoTop()) ? "" : "disabled"}>↶ Undo</button><button class="tool" data-hist="redo" ${canStep(redoTop()) ? "" : "disabled"}>Redo ↷</button></div>
    <ol class="hist-list">${up.map(row).join("")}<li class="hist-now" aria-label="Now"><span>now</span></li>${down.map(row).join("")}</ol>
    <p class="help">Tap a step to go back to just before it; steps you've undone stay above the line until you change something new.</p>`;
}
function draftsHtml() {
  const n = hist.pick.size;
  const list = drafts.map((d) => {
    const g = resolveGrammar(d.snap.g, null, null, d.snap.lv);
    return `<li class="draft">
      <label class="draft-pick"><input type="checkbox" data-hist-draft="${esc(d.id)}" ${hist.pick.has(d.id) ? "checked" : ""}><span class="sr">Compare ${esc(d.name)}</span></label>
      <div class="draft-main"><b>${esc(d.name)}</b><span class="hr-meta">${esc(g?.name || "a grammar not here")}${Number.isInteger(d.snap.lv) ? ` v${d.snap.lv}` : ""} · ${ago(d.at)}</span>${d.line ? `<span class="draft-line">${esc(d.line)}</span>` : ""}</div>
      <div class="draft-actions"><button class="tool" data-hist-open="${esc(d.id)}">Open</button><button class="tool subtle" data-hist-del="${esc(d.id)}" aria-label="Delete ${esc(d.name)}">Delete</button></div>
    </li>`;
  }).join("");
  return `<form class="draft-save" data-hist-save autocomplete="off">
      <label class="bf-field"><span class="dial-label">Name</span><input name="name" maxlength="40" placeholder="${esc(draftName(drafts))}"></label>
      <button class="primary" type="submit">Save a draft</button>
    </form>
    <p class="help">A draft keeps this piece exactly as it is, in this browser (up to ${DRAFTS_MAX}). Tick a few to see them side by side with now.</p>
    ${drafts.length ? `<ol class="hist-list drafts">${list}</ol>
    <div class="hist-steps"><button class="primary tool" data-hist="compare" ${n ? "" : "disabled"}>Compare ${n ? `${n} with now` : "(tick some)"}</button></div>` : `<p class="empty">No drafts yet.</p>`}`;
}
function versionsHtml() {
  const ids = Object.keys(library);
  const id = library[hist.gid] ? hist.gid : library[G.id] ? G.id : ids[0];
  hist.gid = id;
  const store = versions[id];
  if (!store) return `<p class="empty">No versions yet.</p>`;
  const n = verGet(store, hist.at) ? hist.at : store.cur;
  hist.at = n;
  const v = verGet(store, n);
  const prev = verStep(store, n, -1), next = verStep(store, n, 1);
  // The piece as it is, told with that version, if it fits.
  let preview;
  const now = G.id === id ? fixedSnapshot() : null;
  const under = now && snapshotUnder(now, v.doc);
  if (!now) preview = `<p class="empty">Use ${esc(v.doc.name)} to preview your piece under its versions.</p>`;
  else if (!under) preview = `<p class="empty">Your piece doesn't fit v${n}: it uses a word, form or line that version doesn't have.</p>`;
  else { try { preview = staticHtml(under, []); } catch { preview = `<p class="empty">This version can't tell your piece.</p>`; } }
  return `${ids.length > 1 ? `<label class="bf-field"><span class="dial-label">Grammar</span><select id="hist-gram">${ids.map((x) => `<option value="${esc(x)}" ${x === id ? "selected" : ""}>${esc(library[x].name)}</option>`).join("")}</select></label>` : `<p class="dial-label">${esc(library[id].name)}</p>`}
    <div class="ver-step">
      <button class="pk-arrow" data-hist-step="-1" aria-label="Older version" ${prev ? "" : "disabled"}>‹</button>
      <div class="ver-cur"><b>v${n}${n === store.cur ? " · in use" : ""}</b><span class="hr-meta">${esc(v.label)} · ${ago(v.at)}</span></div>
      <button class="pk-arrow" data-hist-step="1" aria-label="Newer version" ${next ? "" : "disabled"}>›</button>
    </div>
    <article class="version ver-preview">${preview}</article>
    <div class="hist-steps">${n === store.cur ? `<span class="crown">the version in use</span>` : `<button class="primary tool" data-hist-restore="${n}">Restore v${n}</button>`}</div>
    <p class="help">Restoring saves v${n} again as the newest version; nothing is deleted. Pieces made with any version keep theirs.</p>
    <ol class="hist-list">${[...store.list].reverse().map((x) => `<li${x.n === n ? ' class="at"' : ""}><button class="hist-row" data-hist-ver="${x.n}" aria-current="${x.n === n}"><span class="hr-label">v${x.n} · ${esc(x.label)}</span><span class="hr-meta">${ago(x.at)}${x.n === store.cur ? " · in use" : ""}</span></button></li>`).join("")}</ol>`;
}

// Tab stays inside the sheet; Escape closes it.
function trapHistoryFocus(e) {
  const el = $("#history");
  if (el.hidden) return false;
  const items = [...el.querySelectorAll("button:not([disabled]), input, select, textarea")].filter((x) => x.offsetParent !== null);
  if (!items.length) return false;
  const first = items[0], last = items[items.length - 1], a = document.activeElement;
  if (!el.contains(a)) { e.preventDefault(); first.focus(); return true; }
  if (e.shiftKey && (a === first || a === el)) { e.preventDefault(); last.focus(); return true; }
  if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); return true; }
  return false;
}

document.addEventListener("click", (e) => {
  if (!(e.target instanceof Element)) return;
  if (e.target.id === "hist-scrim") { closeHistory(); return; }
  const t = e.target.closest("button");
  if (!t) return;
  if (t.id === "tb-undo" || t.id === "undo") { undo(); return; }
  if (t.id === "tb-redo" || t.id === "redo") { redo(); return; }
  if (t.id === "tb-history" || t.id === "history-btn") { openHistory(); return; }
  if (t.id === "save-draft") { closeMenus(); openHistory("drafts"); $("#history [name=name]")?.focus(); return; }
  if (t.dataset.libHistory) { openHistory("versions", t.dataset.libHistory); return; }
  if (t.dataset.draftOpen) { openDraft(t.dataset.draftOpen); return; }
  if (!t.closest("#history")) return;
  const d = t.dataset;
  if (d.hist === "close") closeHistory();
  else if (d.hist === "undo") undo();
  else if (d.hist === "redo") redo();
  else if (d.hist === "compare") compareDrafts([...hist.pick]);
  else if (d.histTab) { hist.view = d.histTab; renderHistory(); el$("[aria-selected=true]")?.focus(); }
  else if (d.histGo !== undefined) travel(+d.histGo);
  else if (d.histOpen) openDraft(d.histOpen);
  else if (d.histDel) { hist.pick.delete(d.histDel); deleteDraft(d.histDel); }
  else if (d.histVer) { hist.at = +d.histVer; renderHistory(); }
  else if (d.histStep) { const n = verStep(versions[hist.gid], hist.at, +d.histStep); if (n) { hist.at = n; renderHistory(); } }
  else if (d.histRestore) { restoreVersion(hist.gid, +d.histRestore); hist.at = null; renderHistory(); }
});
const el$ = (s) => $("#history").querySelector(s);
document.addEventListener("change", (e) => {
  if (!(e.target instanceof Element) || !e.target.closest("#history")) return;
  if (e.target.dataset.histDraft) { if (e.target.checked) hist.pick.add(e.target.dataset.histDraft); else hist.pick.delete(e.target.dataset.histDraft); renderHistory(); }
  else if (e.target.id === "hist-gram") { hist.gid = e.target.value; hist.at = null; renderHistory(); }
});
document.addEventListener("submit", (e) => {
  if (!(e.target instanceof HTMLFormElement) || e.target.dataset.histSave === undefined) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  saveDraft(e.target.elements.name.value);
  hist.view = "drafts";
  renderHistory();
}, true);
// While the sheet is open the page's own keys (space shuffles, arrows tune) stay out of it;
// ⌘Z / Ctrl+Z still undo.
document.addEventListener("keydown", (e) => {
  if ($("#history").hidden) return;
  if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeHistory(); }
  else if (e.key === "Tab") { trapHistoryFocus(e); e.stopImmediatePropagation(); }
  else if (!e.metaKey && !e.ctrlKey) e.stopImmediatePropagation();
}, true);
