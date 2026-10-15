// Story Bits page: event wiring and boot. Everything else is split by concern into ui-core.js,
// render.js, picker.js, controls.js, game.js and bank.js, loaded before this (see index.html).
// The engine (phrases, the dial, beats, snapshots, links) is in engine.js. See docs/design.md.

// ---------- events ----------
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
