// Story Bits page, the controls: folds and menus, the first-run hint, reload-starts-fresh and
// Back to your last piece, switching grammar, form and length.

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
  for (const c of SLOTS.slice(1)) pickLazy(c.key, () => randomPhrase(c.key));
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
