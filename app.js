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
// Saving also saves a version of each grammar that changed (history.js), labelled for the
// timeline; it returns those timeline entries.
function saveLibrary(label) {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(Object.values(library))); } catch {}
  return syncVersions(label);
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
// Adds checked, new words, as one step on the timeline. Returns how many were added.
function addToBank(entries, label) {
  const before = clone(bank);
  let n = 0;
  for (let e of entries) {
    e = { ...e, g: e.g || "story-bits" };
    const gram = resolveGrammar(e.g);
    if (!gram || checkEntry(e, gram) || builtinHas(e, gram) || bank.some((b) => sameWord(b, e))) continue;
    bank.push(e);
    n++;
  }
  saveBank();
  if (n) remember("bank", label || (n === 1 ? bankLabel(bank[bank.length - 1], true) : `added ${n} words to the word bank`), before, bank);
  return n;
}

// ---------- actions ----------
function reroll(keys) {
  rerollPick(keys);
  render();
}
// What a word reads as right now, for history labels ("" if it isn't there).
function wordNow(slot, path, top = state.pick[slot]) {
  const at = top && locate(slot, top, path);
  return at && at.k in at.ph.w ? wordText(at.schema, at.ph, at.k) : "";
}
// Moves (‹ › and the move chips) name their step "Stranger: uncle → dentist"; anything else
// (a pick from the list, Surprise me, Remove) leaves it to the timeline's own wording.
const MOVE_HOWS = ["Plainer", "Stranger"];
const changeLabel = (how, a, b) => (MOVE_HOWS.includes(how) ? `${how}: ${a ? `${a} → ` : ""}${b}` : null);
function setValue(slot, path, val, how = "Changed") {
  const next = variants(slot, path, [val])[0];
  changeWith(changeLabel(how, wordNow(slot, path), wordNow(slot, path, next)), () => { state.pick[slot] = next; });
}
// A random word for this slot, within the dial if possible.
function surprise(slot, path) {
  const at = locate(slot, state.pick[slot], path);
  const vals = options(at.schema, partOf(at.schema, at.k), at.depth).filter((v) => !same(v, at.ph.w[at.k]));
  if (!vals.length) return;
  const was = wordNow(slot, path);
  const pick = { ...state.pick };
  const saved = state.pick;
  state.pick = pick;
  pickFrom(slot, variants(slot, path, vals));
  state.pick = saved;
  changeWith(changeLabel("Surprise", was, wordNow(slot, path, pick[slot])), () => { state.pick[slot] = pick[slot]; });
}
// Fill an empty optional slot (a ghost), then open it in the picker.
function addWord(slot, path) {
  const at = locate(slot, state.pick[slot], path);
  if (!at) return;
  const pick = { ...state.pick };
  const saved = state.pick;
  state.pick = pick;
  pickFrom(slot, variants(slot, path, options(at.schema, partOf(at.schema, at.k), at.depth)));
  state.pick = saved;
  changeWith(changeLabel("Add", "", wordNow(slot, path, pick[slot])), () => { state.pick[slot] = pick[slot]; state.sel = { slot, path, occ: 0 }; });
}
function removeWord(slot, path) {
  const top = clone(state.pick[slot]);
  const at = locate(slot, top, path);
  dropWord(at.schema, at.ph, at.k);
  changeWith(null, () => { state.pick[slot] = top; state.sel = null; });
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
function setBeat(key, i, how = "Line") {
  const ctx = context();
  const lines = beatLines(key, ctx);
  const was = lines[beatChoices(ctx)[key]];
  changeWith(changeLabel(how, was && lineGist(was.t, ctx), lines[i] ? lineGist(lines[i].t, ctx) : beatGroup(key).name), () => { state.beats = { ...state.beats, [key]: i }; });
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
  setValue(slot, path, asValue(e), "Your word");
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
// Moves in the picker: which move's previews are showing, the candidates, which three, and which
// one is previewed in the piece. Reset when the selection changes.
const PREVIEWS = 3;
let pm = { key: null, move: null, cands: [], page: 0, ghost: -1 };
function movesNow() {
  const s = state.sel;
  if (!s) return {};
  if (s.beat) {
    const ctx = context();
    const cur = beatChoices(ctx)[s.beat];
    const lines = beatLines(s.beat, ctx);
    const side = beatSideways(s.beat, ctx).slice(0, MOVE_MAX).map((i) => ({ move: "sideways", beat: s.beat, i, label: `Sideways: ${lineGist(lines[cur].t, ctx)} → ${lineGist(lines[i].t, ctx)}` }));
    return side.length ? { sideways: side } : {};
  }
  const out = {};
  for (const m of MOVES) {
    const c = moveCandidates(s.slot, s.path, m.key);
    if (c.length) out[m.key] = c.map((x) => ({ ...x, slot: s.slot }));
  }
  return out;
}
const lineGist = (t, ctx) => { const s = fillText(t, ctx); return s.length > 28 ? s.slice(0, 26) + "…" : s; };
// The line a selected word sits in: the beat it's in, or the headline.
function selBeat() {
  const s = state.sel;
  if (!s) return null;
  if (s.beat) return s.beat;
  return selectedEl()?.closest(".beat")?.dataset.beat || null;
}
// A candidate as it would read, change marked.
function candHtml(c) {
  if (c.beat) {
    const ctx = context();
    return `<span class="w changed">${fill(beatLines(c.beat, ctx)[c.i].t, ctx)}</span>`;
  }
  return previewLine(c.slot, c.ph, c.changed, selBeat());
}
// In a challenge: what applying it would leave you at.
function candMoves(c) {
  if (!state.game || !state.game.c.n) return null;
  const snap = fixedSnapshot();
  if (c.beat) snap.b = { ...snap.b, [c.beat]: c.i };
  else snap.p = { ...snap.p, [c.slot]: c.ph };
  return changes(state.game.c.s, snap).length;
}
// Show a candidate in the piece itself, ghosted, without applying it (-1: none).
function ghostCand(n) {
  if (pm.ghost === n) return;
  pm.ghost = n;
  const c = pm.cands[n];
  const saved = { pick: state.pick, beats: state.beats };
  if (c) {
    if (c.beat) { state.beats = { ...state.beats, [c.beat]: c.i }; state.ghost = new Set([`beat|${c.beat}`]); }
    else { state.pick = { ...state.pick, [c.slot]: c.ph }; state.ghost = new Set(c.changed.map((p) => `${c.slot}|${p}`)); }
  }
  try { drawPiece(); } finally { Object.assign(state, saved); state.ghost = null; }
  document.querySelectorAll("#picker .pk-pv").forEach((b) => b.classList.toggle("on", +b.dataset.pv === n));
}
// Apply a candidate: one change, recorded for undo with its label.
function applyCand(c) {
  if (!c) return;
  pm.ghost = -1;
  if (c.beat) changeWith(c.label, () => { state.beats = { ...state.beats, [c.beat]: c.i }; });
  else changeWith(c.label, () => { state.pick[c.slot] = c.ph; });
}
// Make a change and render it, named for the undo timeline ("Sideways: uncle → aunt"). An outside
// recorder (window.storyHistory) gets the change itself; otherwise the timeline's hintNext names
// the step render() notes.
function changeWith(label, fn) {
  const h = window.storyHistory;
  if (h?.record) {
    const before = clone(snapshot());
    fn();
    quietly(render);
    const after = clone(snapshot());
    if (!same(before, after)) h.record(label || "Changed", before, after);
    return;
  }
  if (label) hintNext(label);
  fn();
  render();
}
function pickMove(move) {
  pm.move = pm.move === move ? null : move;
  pm.page = 0;
  pm.ghost = -1;
  renderPicker();
  if (pm.move && matchMedia("(hover: none)").matches) ghostCand(0);
}
// The move chips and, for the open move, three previews and "more".
function movesHtml(all) {
  const keys = MOVES.map((m) => m.key).filter((k) => all[k]);
  if (!keys.length) return "";
  if (pm.move && !all[pm.move]) pm.move = null;
  pm.cands = pm.move ? all[pm.move] : [];
  if (pm.page * PREVIEWS >= pm.cands.length) pm.page = 0;
  const start = pm.page * PREVIEWS;
  const shown = pm.cands.slice(start, start + PREVIEWS);
  const budget = state.game?.c.n;
  const chips = keys.map((k) => `<button class="pk-move" data-move="${k}" aria-pressed="${pm.move === k}" aria-controls="pk-previews">${esc(MOVES.find((m) => m.key === k).name)}</button>`).join("");
  const previews = pm.move ? `<div class="pk-previews" id="pk-previews" role="group" aria-label="${esc(MOVES.find((m) => m.key === pm.move).name)}: tap one to use it">
      ${shown.map((c, j) => {
        const n = start + j;
        const used = candMoves(c);
        const cost = used === null ? "" : `<span class="pv-cost${used > budget ? " over" : ""}">${used > budget ? `over your ${budget} moves` : `move ${used} of ${budget}`}</span>`;
        return `<button class="pk-pv${n === pm.ghost ? " on" : ""}" data-pv="${n}" aria-label="${esc(c.label)}"><span class="pv-n" aria-hidden="true">${j + 1}</span><span class="pv-line">${candHtml(c)}</span>${cost}</button>`;
      }).join("")}
      ${pm.cands.length > PREVIEWS ? `<button class="pk-more" data-act="more">More <span class="pv-of">${start + 1}–${start + shown.length} of ${pm.cands.length}</span></button>` : ""}
    </div>` : "";
  return `<div class="pk-moves" role="toolbar" aria-label="Moves">${chips}</div>${previews}`;
}
// The current word, big, with ‹ plainer · stranger ›. Swipe it sideways on a phone.
function stepHtml(text, tier, idx, total, note) {
  return `<div class="pk-step">
      <button class="pk-arrow" data-act="prev" aria-label="Plainer" ${idx <= 0 ? "disabled" : ""}>‹</button>
      <div class="pk-cur"><b>${text}</b>
        <span class="pk-meta"><span class="tier t${tier}">${TIER_NAMES[tier]}</span> ${idx + 1} of ${total}${note}</span></div>
      <button class="pk-arrow" data-act="next" aria-label="Stranger" ${idx >= total - 1 ? "disabled" : ""}>›</button>
    </div>
    <p class="pk-keys">‹ plainer · stranger ›<span class="pk-swipe"> · swipe for sideways</span><span class="pk-kbd"> · ← → · 1–3 use a preview</span></p>`;
}
const allWordsHtml = (groups, n, what) => `<details class="pk-all"${pm.allOpen ? " open" : ""}><summary>All ${what} <span class="pv-of">${n}</span></summary><div class="pk-list">${groups}</div></details>`;

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
      <span class="pk-crumb" id="pk-title"><span class="sr">Tune: </span>Story › ${esc(beatGroup(key).name)}</span>
      <button class="pk-x" data-act="close" aria-label="Close">✕</button>
    </div>
    ${stepHtml(`<span class="pk-sentence">${esc(fillText(line.t, ctx))}</span>`, line.tier, idx, opts.length, Number.isInteger(state.beats[key]) ? " · tuned" : "")}
    ${movesHtml(movesNow())}
    <div class="pk-actions">
      <button data-act="surprise">Surprise me</button>
      ${state.game ? (selChanged() ? `<button data-act="putback">Put back</button>` : "") : `<button data-act="pin" aria-pressed="${pinned}">${pinned ? "Pinned" : "Pin"}</button>`}
      ${Number.isInteger(state.beats[key]) ? `<button data-act="untune">Back to the dice</button>` : ""}
    </div>
    ${allWordsHtml(groups, opts.length, "lines")}
    ${marksHtml()}
    ${state.room ? jamPickerHtml(`beat|${key}`, fillText(line.t, ctx)) : ""}`;
  el.classList.toggle("readonly", !!state.room && jamReadOnly());
  el.hidden = false;
  positionPicker();
}
// The picker is a dialog. Opening it moves focus in; tuning keeps focus where it was (the
// contents are redrawn each time); closing it puts focus back on the word or sentence.
const selKey = (s) => (!s ? null : s.beat ? `beat|${s.beat}` : `${s.slot}|${s.path.join(".")}|${s.occ || 0}`);
let pickerFor = null; // { key, sel } of the word the open picker belongs to
function focusKeyOf(a) {
  if (!(a instanceof Element)) return null;
  if (a.dataset.act) return `[data-act="${a.dataset.act}"]`;
  if (a.dataset.opt !== undefined) return `[data-opt="${a.dataset.opt}"]`;
  if (a.dataset.move) return `[data-move="${a.dataset.move}"]`;
  if (a.dataset.pv !== undefined) return `[data-pv="${a.dataset.pv}"]`;
  if (a.matches(".pk-all > summary")) return ".pk-all > summary";
  if (a.name) return `[name="${a.name}"]`;
  return null;
}
// The element that opens a selection, for focus: the word, or the sentence's button.
function openerOf(s) {
  if (!s) return null;
  if (s.beat) return document.querySelector(`.beat-btn[data-beat-btn="${s.beat}"]`);
  const els = document.querySelectorAll(`.word[data-slot="${s.slot}"][data-path="${s.path.join(".")}"]`);
  return els[Math.min(s.occ || 0, els.length - 1)] || null;
}
function renderPicker() {
  const el = $("#picker");
  const active = document.activeElement;
  const focusIn = el.contains(active);
  const lost = !active || active === document.body;
  const again = focusIn && active !== el ? focusKeyOf(active) : null;
  const scrollTop = el.querySelector(".pk-list")?.scrollTop || 0;
  const movesLeft = el.querySelector(".pk-moves")?.scrollLeft || 0;
  const key = selKey(state.sel);
  // A new word: no move open, the long list folded.
  if (pm.key !== key) pm = { key, move: null, cands: [], page: 0, ghost: -1, allOpen: false };
  pm.ghost = -1;
  drawPicker(el);
  document.body.classList.toggle("sheet-open", !el.hidden && el.classList.contains("sheet"));
  if (!el.hidden) {
    el.setAttribute("aria-modal", String(el.classList.contains("sheet")));
    const list = el.querySelector(".pk-list");
    const chips = el.querySelector(".pk-moves");
    if (pickerFor?.key === key) {
      if (list) list.scrollTop = scrollTop;
      if (chips) chips.scrollLeft = movesLeft;
      if (focusIn || lost) (again && el.querySelector(again)) ? el.querySelector(again).focus({ preventScroll: true }) : el.focus({ preventScroll: true });
    } else {
      el.focus({ preventScroll: true });
    }
    pickerFor = { key, sel: state.sel };
  } else if (pickerFor) {
    const was = pickerFor.sel;
    pickerFor = null;
    if (focusIn || lost) openerOf(was)?.focus({ preventScroll: true });
  }
}
function drawPicker(el) {
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
  const label = (v) => pron(entryOf(at.schema, at.k, v).t, who).replace(/\{\w+\}/g, "…");
  const groups = [0, 1, 2].map((t) => {
    const items = pickerVals.map((v, i) => ({ v, i })).filter((x) => entryOf(at.schema, at.k, x.v).tier === t);
    if (!items.length) return "";
    return `<div class="pk-group"><h4>${TIER_NAMES[t]}</h4>${items.map((x) =>
      `<button class="pk-opt${x.i === idx ? " cur" : ""}${typeof x.v === "number" ? "" : " yours"}" data-opt="${x.i}">${esc(label(x.v))}</button>`).join("")}</div>`;
  }).join("");

  el.innerHTML = `
    <div class="pk-head">
      <span class="pk-crumb" id="pk-title"><span class="sr">Tune: </span>${crumbs(sel.slot, sel.path).map(esc).join(" › ")}</span>
      <button class="pk-x" data-act="close" aria-label="Close">✕</button>
    </div>
    ${stepHtml(esc(label(cur)), entry.tier, idx, pickerVals.length, entry.custom ? " · yours" : "")}
    ${movesHtml(movesNow())}
    <div class="pk-actions">
      <button data-act="surprise">Surprise me</button>
      ${state.game ? (selChanged() ? `<button data-act="putback">Put back</button>` : "") : `<button data-act="pin" aria-pressed="${pinned}">${pinned ? "Pinned" : "Pin"}</button>`}
      ${part.opt ? `<button data-act="remove">Remove</button>` : ""}
      ${loreTarget() ? `<button data-act="lore" title="Keep the whole phrase in ${esc(loreTarget().name)}'s lore">Keep “${esc(phraseText(sel.slot).slice(0, 32))}” as lore</button>` : ""}
    </div>
    ${allWordsHtml(groups, pickerVals.length, "words")}
    <form class="pk-own" autocomplete="off">
      <input name="own" maxlength="60" placeholder="Your own ${esc(part.name)}…" aria-label="Your own ${esc(part.name)}">
      <button type="submit">Use</button>
    </form>
    ${marksHtml()}
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
// On a phone the picker is a bottom sheet (at most ~55% of the screen) and the line holding the
// selected word stays in view above it. On a wider screen it's a popover under the word.
const isSheet = () => innerWidth < 640;
function positionPicker() {
  const el = $("#picker");
  const w = selectedEl();
  if (!w) return;
  if (isSheet()) {
    el.classList.add("sheet");
    el.style.left = el.style.top = "";
    // After this frame's redraws (a ghosted preview can change the piece), so the scroll sticks.
    clearTimeout(positionPicker.later);
    positionPicker.later = setTimeout(() => keepSelInView());
    return;
  }
  el.classList.remove("sheet");
  const r = w.getBoundingClientRect();
  const width = el.offsetWidth;
  el.style.left = `${Math.max(16, Math.min(r.left + scrollX, scrollX + innerWidth - width - 16))}px`;
  el.style.top = `${r.bottom + scrollY + 10}px`;
}
// Scroll so the selected word's line (its sentence, or the headline) sits above the sheet.
function keepSelInView(smooth = true) {
  const el = $("#picker");
  const w = selectedEl();
  if (!w || el.hidden || !el.classList.contains("sheet")) return;
  const line = w.closest(".beat, #bit") || w;
  const lr = line.getBoundingClientRect(), wr = w.getBoundingClientRect();
  const top = (innerHeight - el.offsetHeight) - 12; // where the sheet starts, less a margin
  // The whole line if it fits; else the word a third of the way down the room above the sheet,
  // with what comes before and after it.
  let dy = 0;
  if (lr.height <= top - 12) {
    if (lr.bottom > top) dy = lr.bottom - top;
    if (lr.top - dy < 8) dy = lr.top - 8;
  } else dy = wr.top - Math.max(8, (top - wr.height) / 3);
  if (Math.abs(dy) <= 2) return;
  const from = scrollY;
  scrollBy({ top: dy, behavior: smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" });
  // Where smooth scrolling doesn't start (some embedded views), jump instead.
  if (smooth) setTimeout(() => { if (scrollY === from) scrollBy({ top: dy }); }, 250);
}

function selectBeat(key) {
  state.sel = state.sel && state.sel.beat === key ? null : { beat: key };
  render();
}
function surpriseBeat(key) {
  const ctx = context();
  const cur = beatChoices(ctx)[key];
  const opts = beatOptions(key, ctx).map((x) => x.i).filter((i) => i !== cur);
  if (opts.length) setBeat(key, opts[rand(opts.length)], "Surprise");
}
function select(slot, path, el) {
  const els = [...document.querySelectorAll(`.word[data-slot="${slot}"][data-path="${path.join(".")}"]`)];
  const occ = Math.max(0, els.indexOf(el));
  if (state.sel && state.sel.slot === slot && same(state.sel.path, path) && state.sel.occ === occ) state.sel = null;
  else state.sel = { slot, path, occ };
  hideFirstHint(true);
  render();
}
function step(dir) {
  const s = state.sel;
  if (s.beat) {
    const ctx = context();
    const opts = beatOptions(s.beat, ctx).map((x) => x.i);
    const i = opts.indexOf(beatChoices(ctx)[s.beat]) + dir;
    if (i >= 0 && i < opts.length) setBeat(s.beat, opts[i], dir < 0 ? "Plainer" : "Stranger");
    return;
  }
  const at = locate(s.slot, state.pick[s.slot], s.path);
  const vals = pickerOptions(at);
  const i = vals.findIndex((v) => same(v, at.ph.w[at.k])) + dir;
  if (i < 0 || i >= vals.length) return;
  setValue(s.slot, s.path, vals[i], dir < 0 ? "Plainer" : "Stranger");
}
// Swipe the current word (or line) sideways: left for the next one at this register, right
// for the one before.
function sideStep(dir) {
  const c = movesNow().sideways;
  if (!c?.length) return false;
  applyCand(dir > 0 ? c[0] : c[c.length - 1]);
  return true;
}

// ---------- the kept shelf (phrases you keep coming back to) ----------
// The shelf's model (shelfKey, castToShelf, pinPhrase…) is in engine.js; this is its storage.
const SHELF_KEY = "story-bits-kept";
const CAST_KEY = "story-bits-cast"; // before the shelf: Story Bits characters only, { g, who, bits }
function loadShelf() {
  try {
    const kept = JSON.parse(localStorage.getItem(SHELF_KEY));
    if (Array.isArray(kept)) return kept.filter(shelfOk);
  } catch {}
  // First run with the shelf: bring the old cast across. The old key stays as it was, so nothing
  // is lost even if this browser goes back to an older page.
  try {
    const shelf = castToShelf(JSON.parse(localStorage.getItem(CAST_KEY)) || [], (g) => resolveGrammar(g)?.pronouns);
    if (shelf.length) localStorage.setItem(SHELF_KEY, JSON.stringify(shelf));
    return shelf;
  } catch { return []; }
}
function saveShelf() {
  try { localStorage.setItem(SHELF_KEY, JSON.stringify(shelf)); } catch {}
}
let shelf = [];
const shelfHere = () => shelfFor(shelf, G);
function addToShelf(entry) {
  const c = shelve(shelf, entry);
  saveShelf();
  renderShelf();
  return c;
}

function keepBit() {
  const card = keepOf(G).card;
  if (!state.pick[card]) return;
  const before = clone(shelf);
  const c = addToShelf({ g: G.id, card, ph: clone(state.pick[card]), bits: [bitLine(context())] });
  if (!same(before, shelf)) remember("shelf", `kept ${keptText(card, c.ph)}`, before, shelf);
  toast(`Kept. ${cap(keptText(card, c.ph))}: ${headlineCount(c.bits.length)} so far.`);
}
// Pin a kept phrase and shuffle everything else: a new piece around something kept.
function tellAnother(i) {
  const c = shelf[i];
  if (!c || c.g !== G.id || c.card !== keepOf(G).card) return;
  pinPhrase(c.card, c.ph);
  hintNext(`told another with “${keptText(c.card, c.ph)}”`);
  reroll(SLOTS.map((x) => x.key).filter((k) => k !== c.card));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toHash() {
  if (state.room) return `#jam=${state.room.code}${state.room.key ? `~${state.room.key}` : ""}`;
  // Mid-challenge, the link holds the challenge and your copy, so a reload picks up where you were.
  if (state.game) return "#p=" + b64(JSON.stringify(playPayload()));
  // Comparing (and not playing): keep the set of versions in the link.
  if (state.compare && !state.compare.drafts) return "#cmp=" + b64(JSON.stringify({ c: state.compare.c, e: state.compare.entries.map((e) => ({ name: e.name, me: e.me })) }));
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
    const n = addToBank(words, `added words from “${cleanWord(pack.name) || "a pack"}”`);
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
  if (s.beat) { setBeat(s.beat, start.b[s.beat], "Put back"); return; }
  const at = locate(s.slot, start.p[s.slot], s.path);
  if (at && at.k in at.ph.w) {
    const top = clone(state.pick[s.slot]);
    const here = locate(s.slot, top, s.path);
    here.ph.w[here.k] = clone(at.ph.w[here.k]);
    if (at.ph.sub?.[here.k]) { here.ph.sub = here.ph.sub || {}; here.ph.sub[here.k] = clone(at.ph.sub[here.k]); } else if (here.ph.sub) delete here.ph.sub[here.k];
    tidy(at.schema, here.ph);
    changeWith(changeLabel("Put back", wordNow(s.slot, s.path), wordNow(s.slot, s.path, top)), () => { state.pick[s.slot] = top; });
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
  document.body.classList.toggle("cmp-drafts", !!cmp.drafts);
  if (cmp.drafts) { renderDraftCompare(el, cmp); return; }
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
      <div class="vote">${clapsOn() ? `<button class="clap" data-clap="${i}" aria-label="Clap for ${esc(e.name || `player ${i + 1}`)}" ${clapDisabled(e) ? "disabled" : ""}>👏 <b>${e.votes}</b></button>${top > 0 && e.votes === top ? `<span class="crown">${state.room?.data?.phase === "results" ? "winner" : "leading"}</span>` : ""}` : ""}${state.room && e.id === jamMe() ? `<span class="crown mine">yours</span>` : ""}</div>
    </article>`;
  }).join("");
  $("#compare-empty").hidden = cmp.entries.length > 0;
  $("#cmp-count").textContent = `${cmp.entries.length + 1} versions · swipe`;
}
// Drafts side by side (history.js): now first, then each draft, its changes from now marked.
function renderDraftCompare(el, cmp) {
  const now = `<article class="version original"><header><h3>Now</h3><span class="count">the piece as it is</span></header>${staticHtml(cmp.c.s, [])}</article>`;
  el.innerHTML = now + cmp.entries.map((e) => {
    const ch = draftChanges(cmp.c.s, e.me);
    return `<article class="version">
      <header><h3>${esc(e.name)}</h3><span class="count">${ch ? `${ch.length} change${ch.length === 1 ? "" : "s"}` : e.me.g !== cmp.c.s.g ? "another grammar" : "another shape"}</span></header>
      ${staticHtml(e.me, ch || [])}
      <div class="vote"><button class="clap" data-draft-open="${esc(e.id)}">Open this draft</button></div>
    </article>`;
  }).join("");
  $("#compare-empty").hidden = true;
  $("#cmp-count").textContent = `${cmp.entries.length + 1} versions · swipe`;
}
function compareLink() {
  const cmp = state.compare;
  return linkTo("cmp", { c: cmp.c, e: cmp.entries.map((e) => ({ name: e.name, me: e.me })) });
}


// Undo, redo and the rest of history: history.js.

// ---------- calm layout: folds, menus, the first-run hint ----------
// Rules and the sections below the page fold away; whether each is open is remembered in this
// browser. Menus (With others, More) close when you pick something or click elsewhere.
const FOLD_KEY = "story-bits-folds";
function loadFolds() {
  try { return JSON.parse(localStorage.getItem(FOLD_KEY)) || {}; } catch { return {}; }
}
function initFolds() {
  const saved = loadFolds();
  document.querySelectorAll("details[data-fold]").forEach((d) => {
    if (d.dataset.fold in saved) d.open = !!saved[d.dataset.fold];
    d.addEventListener("toggle", () => saveFold(d.dataset.fold, d.open));
  });
  // The Rules drawer is a button and a panel, so its button sits in the toolbar row.
  document.querySelectorAll("[data-fold-btn]").forEach((b) => setDrawer(b, !!saved[b.dataset.foldBtn], false));
}
function saveFold(name, open) {
  const now = loadFolds();
  now[name] = open;
  try { localStorage.setItem(FOLD_KEY, JSON.stringify(now)); } catch {}
}
function setDrawer(btn, open, save = true) {
  btn.setAttribute("aria-expanded", String(open));
  document.getElementById(btn.getAttribute("aria-controls")).hidden = !open;
  if (save) saveFold(btn.dataset.foldBtn, open);
}
// Open every fold around an element, so something that wants your attention can be seen.
function reveal(el) {
  for (let d = el?.closest("details"); d; d = d.parentElement?.closest("details")) d.open = true;
  const drawer = el?.closest(".drawer");
  if (drawer) setDrawer(document.querySelector(`[aria-controls="${drawer.id}"]`), true);
  return el;
}
function closeMenus(except) {
  document.querySelectorAll("details.menu[open]").forEach((d) => { if (d !== except) d.open = false; });
}

// The first time you open Story Bits, one headline word pulses gently under a "tap to change"
// bubble. Tapping any word, or the ✕, puts it away for good (in this browser).
const HINT_KEY = "story-bits-hint-seen";
let hintOn = false;
function showFirstHint() {
  try { if (localStorage.getItem(HINT_KEY)) return; } catch { return; }
  if (state.room || state.game) return;
  hintOn = true;
  placeFirstHint();
}
function hideFirstHint(forGood) {
  if (!hintOn && !forGood) return;
  hintOn = false;
  $("#first-hint").hidden = true;
  // The pulsing word goes with the bubble.
  document.querySelectorAll(".word.pulse").forEach((x) => x.classList.remove("pulse"));
  if (forGood) try { localStorage.setItem(HINT_KEY, "1"); } catch {}
}
function placeFirstHint() {
  const h = $("#first-hint");
  document.querySelectorAll(".word.pulse").forEach((x) => x.classList.remove("pulse"));
  if (!hintOn || state.sel || state.game || state.room) { h.hidden = true; return; }
  const w = document.querySelector("#bit .word");
  if (!w) { h.hidden = true; return; }
  w.classList.add("pulse");
  h.hidden = false;
  const r = w.getBoundingClientRect();
  const left = Math.max(16, Math.min(r.left + scrollX + r.width / 2 - 24, scrollX + document.documentElement.clientWidth - h.offsetWidth - 16));
  h.style.left = `${left}px`;
  h.style.top = `${r.top + scrollY - h.offsetHeight - 10}px`;
  h.style.setProperty("--arrow", `${Math.max(14, r.left + scrollX + r.width / 2 - left - 7)}px`);
}

// ---------- parts: the mad-lib labels ----------
// Every tunable word sits on a dotted blank, like a Mad Libs page. In the headline, a small
// label under each card's phrase names the part (from the grammar: WHO, WHAT HAPPENED; IMAGE,
// PLACE), and nested phrases get one too ("thing, inside"). Labels show on a first visit and
// fade once you've tuned a few words; Show parts (in Rules) turns them on or off for good.
const PARTS_KEY = "story-bits-parts"; // "on" | "off" | absent (automatic)
const TUNES_KEY = "story-bits-tunes";
const PARTS_AFTER = 3;
function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} }
function stored(k) { try { return localStorage.getItem(k); } catch { return null; } }
function partsOn() {
  const m = stored(PARTS_KEY);
  if (m === "on" || m === "off") return m === "on";
  return (+stored(TUNES_KEY) || 0) < PARTS_AFTER;
}
function countTune() {
  const n = (+stored(TUNES_KEY) || 0) + 1;
  if (n <= PARTS_AFTER + 1) store(TUNES_KEY, String(n));
  if (n === PARTS_AFTER) renderParts();
}
function renderParts() {
  const on = partsOn();
  document.body.classList.toggle("show-parts", on);
  const box = $("#show-parts");
  if (box) box.checked = on;
}
// Labels go in as the first child of each phrase, so they sit under where the phrase starts,
// even when it wraps. They're aria-hidden: each word's name already says its part.
function labelParts(root) {
  root.querySelectorAll(".ph[data-card]").forEach((ph) => {
    const card = SLOTS.find((c) => c.key === ph.dataset.card);
    if (!card) return;
    const l = document.createElement("span");
    l.className = "part-label";
    l.setAttribute("aria-hidden", "true");
    l.textContent = ph.classList.contains("nested") ? `${card.label.toLowerCase()}, inside` : card.label;
    ph.prepend(l);
  });
}
// What the marks on words mean, at the foot of the picker.
const marksHtml = () => `<p class="pk-marks"><span class="mk-blank">dotted</span> can change · <span class="mk-pin">underlined</span> pinned${state.room ? ` · <span class="mk-note">wavy</span> has a comment · <span class="mk-peer">outlined</span> someone's on it` : ""}</p>`;

// ---------- reload starts fresh ----------
// Reloading a plain piece starts a new one (links opened any other way open exactly). The piece
// you had is kept in this browser, and a button offers it back for a few seconds.
const LAST_KEY = "story-bits-last-piece";
let backTimer;
function offerBack() {
  const el = $("#back-offer");
  el.hidden = false;
  clearTimeout(backTimer);
  backTimer = setTimeout(() => { if (!el.contains(document.activeElement)) el.hidden = true; else backTimer = setTimeout(() => (el.hidden = true), 5000); }, 10000);
}
function backToLast() {
  $("#back-offer").hidden = true;
  const h = stored(LAST_KEY);
  hintNext("back to your last piece");
  if (!h || !fromHash(h)) { toast("That piece couldn't be opened."); return; }
  state.sel = null;
  renderBankForm(); renderBank(); renderShelf(); renderLibrary();
  render();
  $("#shuffle").focus({ preventScroll: true });
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
  drawPiece(ctx);

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
  histNote();
  placeFirstHint();
}

// The headline and the story. A preview (ghostCand) draws them with a change ghosted in.
function drawPiece(ctx = context()) {
  $("#bit").innerHTML = bitHtml(ctx);
  labelParts($("#bit"));
  $("#story").innerHTML = story(ctx).map((p) => `<p>${p}</p>`).join("");
  if (state.room) { paintPeers(); paintNotes(); }
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
  renderShelf();
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
  const lv = !src && localVer.get(G);
  const here = (allGrammars().includes(G) || (src && spaceGrammar(src.sp, G.id)?.data === G)) ? "" : `<option selected>${esc(G.name)}${src ? ` v${src.ver}` : lv ? ` v${lv.n} (an older version)` : ""}</option>`;
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

function renderShelf() {
  const el = $("#cast");
  const k = keepOf(G);
  $("#cast-h").textContent = k.name;
  $("#keep").firstChild.textContent = k.verb + " ";
  $("#keep .menu-note").textContent = `adds ${k.card === G.pronouns ? "them" : "it"} to ${shelfName(G)}`;
  const help = $(".cast-wrap .help");
  if (help) help.textContent = k.note || `What you've kept in ${G.name}, and every ${(G.headline || "The line").replace(/^the\s+/i, "").toLowerCase()} it has been in.`;
  const here = shelfHere();
  if (!here.length) {
    el.innerHTML = `<p class="empty">Nothing yet. Choose <i>${esc(k.verb)}</i> (<kbd>k</kbd>) and it lands here. Then tell another with it, and it starts to feel like something you know.</p>`;
    return;
  }
  el.innerHTML = here.map(({ c, i }) => {
    const pr = keptWho(c.card, c.ph);
    return `
    <article class="person">
      <header><h3>${esc(cap(keptText(c.card, c.ph)))}</h3>
        <span class="count">${headlineCount(c.bits.length)}</span></header>
      <ul>${c.bits.slice(0, 6).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      <div class="person-actions">
        <button class="ghost" data-another="${i}">Tell another${c.card === G.pronouns ? ` about ${esc(pr.o)}` : ""}</button>
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
  closeMenus(e.target.closest("details.menu"));
  if (e.target.closest(".menu-item")) closeMenus();
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
    else if (act === "more") { pm.page = (pm.page + 1) * PREVIEWS < pm.cands.length ? pm.page + 1 : 0; renderPicker(); if (matchMedia("(hover: none)").matches) ghostCand(pm.page * PREVIEWS); }
    else if (s.beat) {
      if (act === "surprise") surpriseBeat(s.beat);
      else if (act === "pin") togglePin("beat", [s.beat]);
      else if (act === "untune") changeWith(null, () => { const b = { ...state.beats }; delete b[s.beat]; state.beats = b; });
    }
    else if (act === "surprise") surprise(s.slot, s.path);
    else if (act === "pin") togglePin(s.slot, s.path);
    else if (act === "remove") removeWord(s.slot, s.path);
    return;
  }
  if (t.dataset.opt !== undefined) {
    if (s.beat) setBeat(s.beat, pickerVals[+t.dataset.opt], "Picked");
    else setValue(s.slot, s.path, pickerVals[+t.dataset.opt], "Picked");
    return;
  }
  if (t.dataset.move) { pickMove(t.dataset.move); return; }
  if (t.dataset.pv !== undefined) { applyCand(pm.cands[+t.dataset.pv]); return; }
  if (inPicker || t.closest("#history") || ["tb-undo", "tb-redo", "tb-history"].includes(t.id) || t.dataset.libHistory || t.dataset.draftOpen || ["undo", "redo", "history-btn", "save-draft"].includes(t.id)) return;
  if (t.classList.contains("word")) { select(t.dataset.slot, pathOf(t), t); return; }
  if (t.dataset.beatBtn) { selectBeat(t.dataset.beatBtn); return; }
  if (t.dataset.foldBtn) { setDrawer(t, t.getAttribute("aria-expanded") !== "true"); return; }
  if (t.id === "back-last") { backToLast(); return; }
  if (t.classList.contains("fh-x")) { hideFirstHint(true); return; }
  if (t.dataset.add) { addWord(t.dataset.add, pathOf(t)); return; }
  if (state.sel && !t.closest(".controls")) state.sel = null;
  if (t.dataset.roll) reroll([t.dataset.roll]);
  else if (t.dataset.form) setForm(t.dataset.form);
  else if (t.id === "daily") { const c = parseChallenge(dailyChallenge()); if (c) startGame(c); }
  else if (t.dataset.dial) { state.dial = +t.dataset.dial; reroll(SLOTS.map((x) => x.key)); }
  else if (t.dataset.another !== undefined) tellAnother(+t.dataset.another);
  else if (t.dataset.forget !== undefined) {
    const before = clone(shelf);
    const [c] = shelf.splice(+t.dataset.forget, 1);
    saveShelf(); renderShelf();
    if (c) { remember("shelf", `forgot ${withGrammar(resolveGrammar(c.g) || G, () => keptText(c.card, c.ph))}`, before, shelf); toast("Forgotten. Undo brings it back."); }
  }
  else if (t.dataset.unbank !== undefined) {
    const before = clone(bank);
    const [w] = bank.splice(+t.dataset.unbank, 1);
    saveBank(); renderBank(); updateBankForm(); render();
    if (w) remember("bank", bankLabel(w, false), before, bank);
  }
  else if (t.id === "len-up") setLen(state.len + 1);
  else if (t.id === "len-down") setLen(state.len - 1);
  else if (t.id === "shuffle" || t.id === "tb-shuffle") { state.sel = null; reroll(SLOTS.map((x) => x.key)); }
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
  else if (t.id === "cmp-close") { state.compare = null; $("#compare").hidden = true; document.body.classList.remove("cmp-drafts"); render(); }
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
  if (e.target instanceof Element && e.target.id === "show-parts") { store(PARTS_KEY, e.target.checked ? "on" : "off"); renderParts(); return; }
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

// A preview under the pointer or keyboard focus shows in the piece, ghosted; leaving puts it back.
document.addEventListener("pointerover", (e) => {
  const pv = e.target instanceof Element && e.target.closest("#picker .pk-pv");
  if (pv && e.pointerType === "mouse") ghostCand(+pv.dataset.pv);
});
document.addEventListener("pointerout", (e) => {
  const pv = e.target instanceof Element && e.target.closest("#picker .pk-pv");
  if (pv && e.pointerType === "mouse" && !pv.contains(e.relatedTarget) && !$("#picker").contains(document.activeElement?.closest(".pk-pv"))) ghostCand(-1);
});
document.addEventListener("focusin", (e) => {
  const pv = e.target instanceof Element && e.target.closest("#picker .pk-pv");
  if (pv) ghostCand(+pv.dataset.pv);
  else if (pm.ghost >= 0 && $("#picker").contains(e.target) && !matchMedia("(hover: none)").matches) ghostCand(-1);
});
document.addEventListener("toggle", (e) => {
  if (e.target instanceof Element && e.target.matches("#picker .pk-all")) pm.allOpen = e.target.open;
}, true);
// Swipe the current word sideways (phones): left for the next, right for the one before.
let swipe = null;
document.addEventListener("touchstart", (e) => {
  const cur = e.target instanceof Element && e.target.closest("#picker .pk-cur");
  swipe = cur && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
}, { passive: true });
document.addEventListener("touchend", (e) => {
  if (!swipe) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
  swipe = null;
  if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  if (state.room && jamReadOnly()) return;
  const dir = dx < 0 ? 1 : -1;
  if (sideStep(dir)) {
    const b = $("#picker .pk-cur b");
    b?.classList.add(dir > 0 ? "from-right" : "from-left");
  }
}, { passive: true });
addEventListener("resize", () => { if (state.sel) positionPicker(); });

// On the phone sheet the picker is modal: Tab cycles inside it.
function trapPickerFocus(e) {
  const el = $("#picker");
  if (el.hidden || !el.classList.contains("sheet")) return false;
  const items = [...el.querySelectorAll("button:not([disabled]), input, textarea, select, a[href], [tabindex='0']")].filter((x) => x.offsetParent !== null);
  if (!items.length) return false;
  const first = items[0], last = items[items.length - 1];
  const a = document.activeElement;
  if (!el.contains(a)) { e.preventDefault(); first.focus(); return true; }
  if (e.shiftKey && (a === first || a === el)) { e.preventDefault(); last.focus(); return true; }
  if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); return true; }
  return false;
}

document.addEventListener("keydown", (e) => {
  const target = e.target instanceof Element ? e.target : document.body;
  const typing = target.closest("input, textarea, select");
  // Undo and redo: ⌘Z / Ctrl+Z, ⇧⌘Z / Ctrl+Shift+Z (and Ctrl+Y). Text fields keep their own.
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !typing) {
    const k = e.key.toLowerCase();
    if (k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (k === "y" && e.ctrlKey) { e.preventDefault(); redo(); return; }
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Tab" && trapPickerFocus(e)) return;
  if (e.key === "Escape" && document.querySelector("details.menu[open]")) {
    const open = document.querySelector("details.menu[open]");
    open.open = false;
    open.querySelector("summary").focus();
    return;
  }
  // 1–3 use a preview of the open move.
  if (state.sel && !typing && /^[1-9]$/.test(e.key) && pm.move && !(state.room && jamReadOnly())) {
    const n = pm.page * PREVIEWS + (+e.key - 1);
    if (+e.key <= PREVIEWS && pm.cands[n]) { e.preventDefault(); applyCand(pm.cands[n]); return; }
  }
  if (state.sel && state.sel.beat && !typing) {
    const s = state.sel;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); step(-1); return; }
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); step(1); return; }
    if (e.key === "Escape") { state.sel = null; render(); return; }
    if (e.key === "p") { togglePin("beat", [s.beat]); return; }
    if (e.key === "?") { surpriseBeat(s.beat); return; }
  }
  if (state.sel && !state.sel.beat && !typing) {
    const s = state.sel;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); step(-1); return; }
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); step(1); return; }
    if (e.key === "Escape") { state.sel = null; render(); return; }
    if (e.key === "p") { togglePin(s.slot, s.path); return; }
    if (e.key === "?") { surprise(s.slot, s.path); return; }
    if ((e.key === "Backspace" || e.key === "Delete") && partOf(locate(s.slot, state.pick[s.slot], s.path).schema, s.path[s.path.length - 1]).opt) { removeWord(s.slot, s.path); return; }
  }
  if (e.key === "Escape" && typing && state.sel) { state.sel = null; render(); return; }
  if (typing) return;
  if (state.game && [" ", "r", "+", "=", "]", "-", "["].includes(e.key)) return;
  if (e.key === " " && !target.closest("button, summary, a")) { e.preventDefault(); state.sel = null; reroll(SLOTS.map((x) => x.key)); }
  else if (e.key === "r") retell();
  else if (e.key === "k") keepBit();
  else if (e.key === "+" || e.key === "=" || e.key === "]") setLen(state.len + 1);
  else if (e.key === "-" || e.key === "[") setLen(state.len - 1);
});
addEventListener("resize", () => { if (state.sel) positionPicker(); placeFirstHint(); });

// ---------- boot ----------
(async function boot() {
  initFolds();
  renderParts();
  await loadPacks();
  shelf = loadShelf();
  loadDrafts();
  loadVersions();
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
    queueMicrotask(async () => { await receiveSpace(kind, data); renderSpaces(); renderLibrary(); render(); reveal($("#spaces")).scrollIntoView({ behavior: "smooth", block: "start" }); });
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
  else {
    ready = fromHash(h);
    // A reload of a plain piece: keep it for "Back to your last piece", then start a new one in
    // the same grammar, form, length and dial.
    const nav = performance.getEntriesByType?.("navigation")?.[0]?.type;
    if (ready && freshOnReload(nav, h)) {
      store(LAST_KEY, h);
      Object.assign(state, { pins: [], beats: {}, sel: null });
      ready = false;
      queueMicrotask(offerBack);
    }
  }
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
  renderShelf();
  renderLibrary();
  renderSpaces();
  // Spaces you've joined: fetch them (only those; nothing else leaves the browser).
  if (spaces.list.length) refreshAllSpaces();
  if (lib.incoming) reveal($("#library")).scrollIntoView({ behavior: "smooth", block: "start" });
  showFirstHint();
})();
