// Story Bits page, drawing the piece: render(), the headline and story, and the mad-lib part
// labels and marks. Reads state; the picker and controls call render() after they change it.

// ---------- parts: the mad-lib labels ----------
// Every tunable word sits on a dotted blank, like a Mad Libs page. In the headline, a small
// label under each card's phrase names the part (from the grammar: WHO, WHAT HAPPENED; IMAGE,
// PLACE), and nested phrases get their own card's label too (THING inside WHAT HAPPENED). Labels show on a first visit and
// fade once you've tuned a few words; Show parts (in Rules) turns them on or off for good.
const PARTS_KEY = "story-bits-parts"; // "on" | "off" | absent (automatic)
const TUNES_KEY = "story-bits-tunes";
const PARTS_AFTER = 3;
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
    l.textContent = card.label;
    ph.prepend(l);
  });
  // A nested phrase's label gives way where it would sit on another ("lost" is too short to hold
  // WHAT HAPPENED before "a dog" starts), so every label that shows can be read.
  const ls = [...root.querySelectorAll(".part-label")];
  const at = new Map(ls.map((l) => [l, l.getBoundingClientRect()]));
  const hits = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  for (const l of ls) if (l.parentElement.classList.contains("nested") && ls.some((m) => m !== l && !m.hidden && hits(at.get(l), at.get(m)))) l.hidden = true;
}
// What the marks on words mean, at the foot of the picker.
const marksHtml = () => `<p class="pk-marks"><span class="mk-blank">dotted</span> can change · <span class="mk-pin">underlined</span> pinned${state.room ? ` · <span class="mk-note">wavy</span> has a comment · <span class="mk-peer">outlined</span> someone's on it` : ""}</p>`;


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
  // Show parts names this grammar's own cards: (who, what happened…), (image, motion…).
  const partsNote = $(".parts-toggle .menu-note");
  if (partsNote) partsNote.textContent = `label each part of the ${(G.headline || "The line").replace(/^the\s+/i, "").toLowerCase()} (${SLOTS.slice(0, 2).map((c) => c.label.toLowerCase()).join(", ")}…)`;
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
