// "Change the grammar here": the picker's section for changing the grammar right where you're
// tuning ("your uncle" → add a slot, add "ugly"), without a trip to the library editor. The edits
// are grammar-ops.js; what the section offers is edit-plan.js. Loaded after history.js, before
// app.js; everything here runs at call time.
//
// Every edit goes through editHere(): a built-in, shared or space grammar is forked first
// ("Story Bits (yours)") and switched to with the open piece remapped, so nothing on screen
// changes except the edit; the result is saved as a local grammar version and recorded as ONE
// step on the timeline (fork included), so ⌘Z, the phone Undo button and the section's own
// Undo take it back. In a together jam the switch goes out as a whole-grammar change, the
// existing doc path (jamAfterRender). Hidden in a challenge or workshop, and for jam commenters
// and viewers (editBlocked).

const ge = { open: false, tab: "words", offer: null, err: "", step: null, forkedFrom: "", draft: {}, slotDraft: {}, tagDraft: "", detDraft: "" };

const geBlocked = () => editBlocked({ game: !!state.game, room: state.room ? { mode: jamData()?.mode, role: jamRole() } : null });

// Make one edit to the grammar in use: grammarOps[op](grammar, ...args). Returns true if it saved.
function editHere(op, ...args) {
  if (geBlocked()) return false;
  const sel = state.sel;
  const oldG = G;
  const f = grammarOps.forkOnWrite(G);
  const r = f.error ? f : grammarOps[op](f.grammar, ...args);
  if (r.error) { ge.err = r.error; renderPicker(); return false; }
  ge.err = "";
  const before = histNow?.at;
  const snap = clone(snapshot());
  const id = r.grammar.id;
  const was = versions[id]?.cur ?? null;
  const steps = [];
  if (f.forked) { library[id] = f.grammar; steps.push(...saveLibrary(f.label)); }
  library[id] = r.grammar;
  steps.push(...saveLibrary(r.label));
  const label = f.forked ? `${r.label} (in your own copy)` : r.label;
  // In a jam, saveLibrary leaves the jam's grammar off the timeline; this edit is yours to undo.
  const step = mergeSteps(timeline, steps, label) || tlRecord(timeline, { kind: "grammar", label, id, before: was, after: versions[id]?.cur, where: r.grammar.name });
  // The open piece, carried onto the edited grammar (a removed slot's word goes with it).
  const m = grammarOps.remapPiece(snap, oldG, r.grammar, { lv: versions[id]?.cur });
  const parsed = m.snapshot && parseSnapshot(m.snapshot);
  if (parsed) applySnapshot(parsed); else { useGrammar(library[id]); state.grammar = id; }
  state.sel = sel;
  quietly(() => {
    if (f.forked) { renderBankForm(); renderBank(); renderShelf(); }
    render();
  });
  renderLibrary();
  if (before && histNow) step.piece = { from: before, to: histNow.at };
  ge.step = step;
  ge.forkedFrom = f.forked ? oldG.name : "";
  renderUndo();
  renderPicker();
  return true;
}

// ---------- the section ----------
const geKey = (k) => `data-ge-key="${esc(k)}"`;
const segHtml = (name, opts, cur, key) => `<span class="seg ge-seg" role="radiogroup">${opts.map(([v, n]) => `<label><input type="radio" name="${name}" value="${v}" ${String(cur) === String(v) ? "checked" : ""} ${geKey(`${key}-${v}`)}>${esc(n)}</label>`).join("")}</span>`;
const TIER_OPTS = TIER_NAMES.map((n, i) => [i, n]);
const MOOD_OPTS = [[1, "good"], [0, "mixed"], [-1, "bad"]];
const PR_OPTS = [["he", "he/him"], ["she", "she/her"], ["they", "they/them"], ["it", "it/its"]];
const selectHtml = (name, opts, cur, label) => `<label class="ge-field"><span class="dial-label">${esc(label)}</span><select name="${name}" ${geKey(name)}>${opts.map(([v, n]) => `<option value="${esc(v)}" ${String(cur) === String(v) ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>`;

function grammarEditHtml(at) {
  if (geBlocked()) return "";
  const cur = at.ph.w[at.k];
  const head = state.pick[state.sel.slot] && locate(state.sel.slot, state.pick[state.sel.slot], [...state.sel.path.slice(0, -1), "n"]);
  const names = { head: head ? pron(word(at.schema, head.ph, "n").t, person()).replace(/\{\w+\}/g, "…") : "", phrase: flat(tokens(at.schema, at.ph, person(), at.schema)) };
  if (names.phrase.length > 28) names.phrase = "…" + names.phrase.slice(-26).replace(/^\S*\s/, "");
  const v = slotEdit(G, at.schema, at.k, cur, names);
  if (!v) return "";
  const tabs = [["words", "Words"], ["word", "This word"], ["slots", "Slots"]];
  const step = ge.step && undoTop() === ge.step ? ge.step : null;
  if (!step) ge.forkedFrom = "";
  const note = step ? `<p class="ge-note" role="status">${ge.forkedFrom ? `<b>You're now editing your own copy of ${esc(ge.forkedFrom)}.</b> ` : ""}${esc(cap(step.label))}. <button class="ge-undo" data-ge="undo" ${geKey("undo")}>Undo</button></p>` : "";
  const err = ge.err ? `<p class="bf-error ge-err" role="alert">${esc(cap(ge.err))}.</p>` : "";
  // A relation slot's word is the nested phrase itself ({who}'s): nothing to add or tag there.
  const nest = partOf(at.schema, at.k).relation && ge.tab !== "slots" ? `<p class="ge-help">The ${esc(v.slot)} slot holds a whole other phrase: whose ${esc(names.head || "one")} this is. Tune that phrase, or change the slots.</p>` : "";
  const body = nest || (ge.tab === "word" ? wordTabHtml(v) : ge.tab === "slots" ? slotsTabHtml(v, at) : wordsTabHtml(v, at));
  const yours = library[G.id] ? "" : `<p class="ge-help">Changes go into your own copy of ${esc(G.name)}; the original stays as it is.</p>`;
  return `<details class="pk-edit"${ge.open ? " open" : ""}>
      <summary ${geKey("summary")}>Change the grammar here <span class="pv-of">${esc(v.where)}</span></summary>
      ${note}${err}
      <div class="ge-tabs" role="tablist" aria-label="Change the grammar">${tabs.map(([k, n]) => `<button role="tab" aria-selected="${ge.tab === k}" data-ge="tab" data-tab="${k}" ${geKey(`tab-${k}`)}>${n}</button>`).join("")}</div>
      <div class="ge-body" role="tabpanel">${body}</div>
      ${yours}
    </details>`;
}

// Words: add one to this slot, retire this one, bring a retired one back.
function wordsTabHtml(v, at) {
  const d = ge.draft;
  const e = wordEntry(G, at.schema, at.k, d);
  const chk = addCheck(G, e);
  const w = v.word;
  const retire = !w ? `<p class="ge-help">‘${esc(wordText(at.schema, at.ph, at.k))}’ is your own word, from your word bank.</p>`
    : w.retired ? `<p class="ge-help">‘${esc(w.t)}’ is retired: it stays in pieces that have it, but isn't offered. <button class="ge-btn" data-ge="restore" data-i="${w.i}" ${geKey("restore-cur")}>Bring it back</button></p>`
    : v.retireWhy ? `<p class="ge-help">‘${esc(w.t)}’ stays: ${esc(v.retireWhy)}.</p>`
    : `<p class="ge-row"><button class="ge-btn" data-ge="retire" data-i="${w.i}" ${geKey("retire")}>Never offer ‘${esc(w.t)}’ again</button></p>`;
  const back = v.retired.filter((x) => x.i !== w?.i);
  return `<form class="ge-add" data-ge-form="add" autocomplete="off">
      <label class="ge-field ge-text"><span class="dial-label">Add a word to ${esc(v.slot)}</span>
        <input name="ge-t" maxlength="60" value="${esc(d.t || "")}" placeholder="a new ${esc(v.slot)}" ${geKey("ge-t")}></label>
      <div class="ge-tags-row">
        ${segHtml("ge-tier", TIER_OPTS, d.tier ?? 1, "tier")}
        ${v.needs.mood ? segHtml("ge-v", MOOD_OPTS, d.v ?? 0, "v") : ""}
        ${v.dets ? selectHtml("ge-det", v.dets.map((x) => [x, x]), d.det ?? w?.det ?? v.dets[0], "Starts with") : ""}
        ${v.needs.pronouns ? selectHtml("ge-pr", PR_OPTS, d.pr ?? "they", "Pronouns") : ""}
      </div>
      <p class="ge-check" aria-live="polite">${chk.error ? `<span class="ge-bad">${esc(cap(chk.error))}.</span>` : chk.note ? esc(cap(chk.note)) + "." : ""}</p>
      <button class="primary ge-go" type="submit" ${geKey("add")}>Add to the grammar</button>
    </form>
    ${retire}
    ${back.length ? `<p class="ge-help">Retired here: ${back.map((x) => `<button class="ge-chip" data-ge="restore" data-i="${x.i}" ${geKey(`restore-${x.i}`)} aria-label="Bring back ${esc(x.t)}">${esc(x.t)} ↺</button>`).join(" ")}</p>` : ""}`;
}

// This word: its register, mood, starting word, pronouns and free tags.
function wordTabHtml(v) {
  const w = v.word;
  if (!w) return `<p class="ge-help">This is your own word, from your word bank: change it there, or add it to the grammar under Words.</p>`;
  return `<div class="ge-word">
      <p class="ge-help">‘${esc(w.t)}’ in ${esc(v.where)}. Changes save as you make them.</p>
      <div class="ge-field"><span class="dial-label">Register</span>${segHtml("ge-wtier", TIER_OPTS, w.tier, "wtier")}</div>
      ${v.needs.mood ? `<div class="ge-field"><span class="dial-label">Mood</span>${segHtml("ge-wv", MOOD_OPTS, w.v, "wv")}</div>` : ""}
      <div class="ge-tags-row">
        ${v.dets ? selectHtml("ge-wdet", v.dets.map((x) => [x, x]), w.det, "Starts with") : ""}
        ${v.needs.pronouns ? selectHtml("ge-wpr", PR_OPTS, w.pr, "Pronouns") : ""}
      </div>
      <div class="ge-field"><span class="dial-label">Tags</span>
        <span class="ge-chips">${w.tags.map((t) => `<span class="ge-chip on">${esc(t)}<button class="ge-x" data-ge="untag" data-tag="${esc(t)}" ${geKey(`untag-${t}`)} aria-label="Remove tag ${esc(t)}">✕</button></span>`).join("") || `<span class="ge-help">none yet</span>`}</span>
      </div>
      ${w.tags.length >= TAGS_MAX ? "" : `<form class="ge-inline" data-ge-form="tag" autocomplete="off">
        <input name="ge-tag" maxlength="24" value="${esc(ge.tagDraft)}" placeholder="a tag, like family" aria-label="Add a tag" ${geKey("ge-tag")}>
        <button type="submit" ${geKey("tag-add")}>Tag</button>
      </form>`}
      <p class="ge-help">Sideways moves prefer words that share a tag.</p>
    </div>`;
}

// Slots: this slot's starting words, the card's optional slots, and slots to add.
function slotsTabHtml(v, at) {
  const card = v.card;
  const offer = v.offers.find((o) => o.key === ge.offer);
  const sd = ge.slotDraft;
  return `${v.dets ? `<div class="ge-field"><span class="dial-label">${esc(v.slot)} starts with</span>
        <span class="ge-chips">${v.dets.map((x) => `<span class="ge-chip on">${esc(x)}${v.dets.length > 1 ? `<button class="ge-x" data-ge="undet" data-det="${esc(x)}" ${geKey(`undet-${x}`)} aria-label="Stop offering ${esc(x)}">✕</button>` : ""}</span>`).join("")}</span></div>
      <form class="ge-inline" data-ge-form="det" autocomplete="off">
        <input name="ge-det-new" maxlength="12" value="${esc(ge.detDraft)}" placeholder="another, like my" aria-label="Add a starting word" ${geKey("ge-det-new")}>
        <button type="submit" ${geKey("det-add")}>Add</button>
      </form>` : ""}
    ${v.slots.length ? `<div class="ge-field"><span class="dial-label">Optional slots in ${esc(card)}</span>
      <ul class="ge-slots">${v.slots.map((s) => `<li><span>${esc(s.name)}${s.here ? " <i>(this one)</i>" : ""}</span>${s.why ? `<span class="ge-help">stays: ${esc(s.why)}</span>` : `<button class="ge-btn" data-ge="unslot" data-k="${esc(s.k)}" ${geKey(`unslot-${s.k}`)}>Remove</button>`}</li>`).join("")}</ul></div>` : ""}
    ${v.offers.length ? `<div class="ge-offers">${v.offers.map((o) => `<button class="ge-btn ge-offer" data-ge="offer" data-offer="${o.key}" aria-expanded="${o.key === ge.offer}" ${geKey(`offer-${o.key}`)}>${esc(o.label)}</button>`).join("")}</div>` : `<p class="ge-help">${esc(card)} has all the slots it can take around its head word.</p>`}
    ${offer?.needsWord ? `<form class="ge-add" data-ge-form="slot" autocomplete="off">
        <label class="ge-field ge-text"><span class="dial-label">Its first word (a ${esc(offer.def.name)})</span>
          <input name="ge-st" maxlength="60" value="${esc(sd.t || "")}" placeholder="${offer.key === "describe" ? "ugly" : "with a limp"}" ${geKey("ge-st")}></label>
        ${segHtml("ge-stier", TIER_OPTS, sd.tier ?? 1, "stier")}
        <button class="primary ge-go" type="submit" ${geKey("slot-add")}>Add the slot</button>
      </form>` : ""}
    <p class="ge-help">A new slot is optional, so pieces made before it still read the same.</p>`;
}

// ---------- events ----------
const inEdit = (el) => el instanceof Element && el.closest("#picker .pk-edit");
function geAt() {
  const s = state.sel;
  if (!s || s.beat) return null;
  const at = state.pick[s.slot] && locate(s.slot, state.pick[s.slot], s.path);
  return at && at.k in at.ph.w ? at : null;
}
function geTags(at, tags) {
  const v = at.ph.w[at.k];
  if (Number.isInteger(v)) editHere("setWordTags", at.schema, at.k, v, tags);
}

document.addEventListener("click", (e) => {
  const t = e.target instanceof Element && e.target.closest("button[data-ge]");
  if (!t || !inEdit(t)) return;
  // The section redraws as it acts, so the page's own click handler (app.js) would find this
  // button gone from the picker and close it: the click stops here.
  e.stopImmediatePropagation();
  const at = geAt();
  if (!at) return;
  const d = t.dataset;
  if (d.ge === "tab") { ge.tab = d.tab; ge.err = ""; renderPicker(); }
  else if (d.ge === "undo") {
    // Undo from inside the sheet (the phone's thumb bar sits under it), staying on the word.
    const sel = state.sel;
    undo();
    if (!state.sel && sel) { state.sel = sel; render(); }
  }
  else if (d.ge === "retire") editHere("removeWord", at.schema, at.k, +d.i);
  else if (d.ge === "restore") editHere("restoreWord", at.schema, at.k, +d.i);
  else if (d.ge === "untag") { const w = slotEdit(G, at.schema, at.k, at.ph.w[at.k]).word; geTags(at, { tags: w.tags.filter((x) => x !== d.tag) }); }
  else if (d.ge === "undet") editHere("setDeterminers", at.schema, at.k, partOf(at.schema, at.k).det.filter((x) => x !== d.det));
  else if (d.ge === "offer") {
    const o = slotOffers(G, at.schema).find((x) => x.key === d.offer);
    if (o && !o.needsWord) { ge.offer = null; editHere("addSlot", at.schema, o.def, o.position); }
    else { ge.offer = ge.offer === d.offer ? null : d.offer; renderPicker(); }
  }
  else if (d.ge === "unslot") {
    const sel = state.sel;
    // Removing the slot you're on moves you to the card's head word.
    const onIt = sel.path[sel.path.length - 1] === d.k;
    if (editHere("removeSlot", at.schema, d.k) && onIt) { state.sel = { ...sel, path: [...sel.path.slice(0, -1), "n"], occ: 0 }; render(); }
  }
});

document.addEventListener("submit", (e) => {
  const f = e.target;
  if (!(f instanceof HTMLFormElement) || !inEdit(f)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const at = geAt();
  if (!at) return;
  const kind = f.dataset.geForm;
  if (kind === "add") {
    const entry = wordEntry(G, at.schema, at.k, ge.draft);
    if (!entry.t) { ge.err = "type a word first"; renderPicker(); f.querySelector("input[name=ge-t]")?.focus(); return; }
    if (editHere("addWord", at.schema, at.k, entry)) { ge.draft = { ...ge.draft, t: "" }; renderPicker(); }
  } else if (kind === "tag") {
    const w = slotEdit(G, at.schema, at.k, at.ph.w[at.k]).word;
    const tag = cleanWord(ge.tagDraft);
    if (w && tag && editHere("setWordTags", at.schema, at.k, at.ph.w[at.k], { tags: [...w.tags, tag] })) { ge.tagDraft = ""; renderPicker(); }
  } else if (kind === "det") {
    const det = cleanWord(ge.detDraft);
    if (det && editHere("setDeterminers", at.schema, at.k, [...partOf(at.schema, at.k).det, det])) { ge.detDraft = ""; renderPicker(); }
  } else if (kind === "slot") {
    const o = slotOffers(G, at.schema).find((x) => x.key === ge.offer);
    const t = cleanWord(ge.slotDraft.t);
    if (!o) return;
    if (!t) { ge.err = "type the slot's first word"; renderPicker(); return; }
    if (editHere("addSlot", at.schema, { ...o.def, pool: [{ t, tier: +(ge.slotDraft.tier ?? 1) }] }, o.position)) { ge.offer = null; ge.slotDraft = {}; renderPicker(); }
  }
}, true);

// Typing is kept across redraws (a jam can redraw the picker while you type).
document.addEventListener("input", (e) => {
  const el = e.target;
  if (!inEdit(el)) return;
  if (el.name === "ge-t") { ge.draft.t = el.value; geLiveCheck(); }
  else if (el.name === "ge-st") ge.slotDraft.t = el.value;
  else if (el.name === "ge-tag") ge.tagDraft = el.value;
  else if (el.name === "ge-det-new") ge.detDraft = el.value;
});
// The add form says, as you type, whether the word can go in (without redrawing the sheet).
function geLiveCheck() {
  const at = geAt();
  const out = document.querySelector("#picker .ge-check");
  if (!at || !out) return;
  const chk = addCheck(G, wordEntry(G, at.schema, at.k, ge.draft));
  out.innerHTML = chk.error ? `<span class="ge-bad">${esc(cap(chk.error))}.</span>` : chk.note ? esc(cap(chk.note)) + "." : "";
  if (ge.err) { ge.err = ""; document.querySelector("#picker .ge-err")?.remove(); }
}
document.addEventListener("change", (e) => {
  const el = e.target;
  if (!inEdit(el)) return;
  const at = geAt();
  if (!at) return;
  const n = el.name;
  if (n === "ge-tier") ge.draft.tier = +el.value;
  else if (n === "ge-v") ge.draft.v = +el.value;
  else if (n === "ge-det") ge.draft.det = el.value;
  else if (n === "ge-pr") ge.draft.pr = el.value;
  else if (n === "ge-stier") ge.slotDraft.tier = +el.value;
  else if (n === "ge-wtier") geTags(at, { tier: +el.value });
  else if (n === "ge-wv") geTags(at, { v: +el.value });
  else if (n === "ge-wdet") geTags(at, { det: el.value });
  else if (n === "ge-wpr") geTags(at, { pr: el.value });
  if (["ge-tier", "ge-v", "ge-det", "ge-pr"].includes(n)) geLiveCheck();
});
document.addEventListener("toggle", (e) => {
  if (e.target instanceof Element && e.target.matches("#picker .pk-edit")) {
    ge.open = e.target.open;
    if (ge.open && isSheet()) setTimeout(() => e.target.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }
}, true);
