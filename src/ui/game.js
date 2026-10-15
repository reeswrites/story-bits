// Story Bits page, the friends game: challenges, passing a copy around, the game bar, and
// compare (copies side by side, drafts compare).

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

// One line (who it's from, the moves) and the actions; how it works folds away, so the piece is
// on the first screen of a phone.
function renderGameBar() {
  const bar = $("#game-bar");
  if (!state.game) { bar.hidden = true; return; }
  const { c, name } = state.game;
  const used = movesUsed();
  const howOpen = !!bar.querySelector(".gb-how[open]");
  bar.hidden = false;
  const how = c.n ? `Make it yours in <b>${c.n}</b> move${c.n === 1 ? "" : "s"}. Any word or beat you change is a move; put it back to get the move back.` : `Make it yours. No move limit: everything you change shows up highlighted at the reveal.`;
  bar.innerHTML = `
    <div class="gb-top">
      <p class="gb-title"><span class="eyebrow">${c.d ? `Today's bit · ${esc(c.h)}` : `Challenge${c.h ? ` from ${esc(c.h)}` : ""}`}</span></p>
      ${c.n ? `<div class="gb-moves" aria-label="${used} of ${c.n} moves used">${Array.from({ length: c.n }, (_, i) => `<span class="${i < used ? "on" : ""}"></span>`).join("")}<b>${used}/${c.n}</b></div>` : `<div class="gb-moves"><b>${used} change${used === 1 ? "" : "s"}</b></div>`}
    </div>
    ${state.room ? `<div class="gb-row">
      <button id="gb-send" class="primary" ${jamCan("edit") ? "" : "hidden"}>${roomMe()?.submitted ? "Update my version" : "Send my version"}</button>
      <details class="gb-how"${howOpen ? " open" : ""}><summary>How it works</summary>
        <p class="gb-note">${how} ${roomMe()?.submitted ? "Sent. You can keep tuning and send again until the host reveals." : "Everyone's copies stay hidden until the host reveals them."}</p>
      </details>
    </div>` : `<div class="gb-row">
      <button id="gb-submit" class="primary">Copy my version</button>
      <button id="gb-compare" class="ghost">Compare</button>
      <details class="gb-how"${howOpen ? " open" : ""}><summary>How it works</summary>
        <p class="gb-note">${how} Copy your version and paste it back to whoever sent the challenge; Compare puts the versions side by side.</p>
        <div class="gb-row">
          <label class="gb-name"><span class="dial-label">Your name</span><input id="gb-name" maxlength="${NAME_MAX}" value="${esc(name)}" placeholder="so they know it's you"></label>
          <button id="gb-leave" class="ghost subtle">Leave challenge</button>
        </div>
      </details>
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
  gluePunct(el);
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
  gluePunct(el);
  $("#compare-empty").hidden = true;
  $("#cmp-count").textContent = `${cmp.entries.length + 1} versions · swipe`;
}
function compareLink() {
  const cmp = state.compare;
  return linkTo("cmp", { c: cmp.c, e: cmp.entries.map((e) => ({ name: e.name, me: e.me })) });
}
