// Story Bits page, the picker: the word actions (reroll, set, add, remove, pin, own word), the
// sheet or popover, moves and previews, the word list, stepping, and its grammar-edit tab hooks.

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
  // A relation slot takes this phrase inside it ("your uncle" → "your uncle's dentist"): the
  // zoom-out move, not a fresh phrase.
  if (partOf(at.schema, at.k).relation) {
    const head = [...path.slice(0, -1), "n"];
    const c = moveCandidates(slot, head, "zoom").find((x) => x.changed.includes(path.join(".")));
    if (c) { applyCand({ ...c, slot }); state.sel = { slot, path: head, occ: 0 }; render(); }
    return;
  }
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
  if (a.dataset.geKey) return `[data-ge-key="${CSS.escape(a.dataset.geKey)}"]`;
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
    if (focusIn || lost) openerOf(was)?.focus({ preventScroll: true, focusVisible: keyNav });
  }
  movesHint();
}
// The moves row scrolls sideways: a fade at the edge that has more says so, without the last
// pill looking cut off.
function movesHint(row = $("#picker .pk-moves")) {
  if (!row) return;
  row.classList.toggle("more-r", row.scrollLeft + row.clientWidth < row.scrollWidth - 2);
  row.classList.toggle("more-l", row.scrollLeft > 2);
}
document.addEventListener("scroll", (e) => { if (e.target instanceof Element && e.target.matches(".pk-moves")) movesHint(e.target); }, true);
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
    ${part.relation ? "" : `<form class="pk-own" autocomplete="off">
      <input name="own" maxlength="60" placeholder="Your own ${esc(part.name)}…" aria-label="Your own ${esc(part.name)}">
      <button type="submit">Use</button>
    </form>`}
    ${grammarEditHtml(at)}
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
