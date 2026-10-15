// Jams: optional shared sessions on the room server (party/: partyserver on Cloudflare).
// See docs/design.md. Loaded before app.js; everything here runs at call time.
//
//   together — one shared piece. Editors tune it live: every change goes out as a small patch
//              (per card, per beat, per setting). Commenters and viewers see it change; everyone
//              sees who's looking at which word.
//   workshop — the host starts everyone from the same piece; each person tunes their own copy;
//              the copies are revealed side by side for critique (notes, and claps if on).
//
// Roles come from the invite link: edit (~edit key), comment (~comment key), or view (no key).
// Everything the jam sends is checked with the same parsers links use.
//
// A jam can open inside a space (spaces.js): the host links it, and the jam relays the space's
// grammars, lore and cast to everyone here. Kept phrases go to the space's lore; at a workshop
// reveal, a copy that brings one back is marked as a callback.

const ROOMS_PROD = "story-bits-rooms.peregrine-rd.workers.dev";
const ROOMS_HOST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? `${location.hostname}:8799` : ROOMS_PROD;
const ROOM_CODE = /^[A-Z0-9]{4,8}$/;
const ROOM_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
// Eight characters: a jam's code is enough to watch it, so it shouldn't be guessable.
const newRoomCode = () => Array.from({ length: 8 }, () => ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]).join("");
const ROLE_RANK = { view: 0, comment: 1, edit: 2 };
const ROLE_NAMES = { edit: "editor", comment: "commenter", view: "viewer" };

// One id per tab (so two tabs on one laptop are two people), kept across reloads.
function playerId() {
  try {
    let id = sessionStorage.getItem("story-bits-player");
    if (!id) { id = "p-" + crypto.randomUUID(); sessionStorage.setItem("story-bits-player", id); }
    return id;
  } catch { return (window.__pid ||= "p-" + crypto.randomUUID()); }
}
const NAME_KEY = "story-bits-name";
const savedName = () => { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } };

// Someone who hasn't typed a name gets a friendly, stable stand-in (the same in the jam bar, on
// comments, on presence tags and on reveal cards), derived from their id in the jam.
const NICK_A = ["Amber", "Brisk", "Cedar", "Dapper", "Ember", "Fennel", "Gentle", "Hazel", "Indigo", "Juniper", "Kind", "Lucky", "Mossy", "Nimble", "Olive", "Plucky"];
const NICK_B = ["Heron", "Otter", "Finch", "Badger", "Wren", "Lynx", "Moth", "Newt", "Pika", "Quail", "Robin", "Stoat", "Tern", "Vole", "Yak", "Hare"];
const nickFor = (id) => { const h = [...String(id || "?")].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7); return `${NICK_A[h % 16]} ${NICK_B[(h >>> 4) % 16]}`; };
const whoName = (name, id) => cleanName(name || "") || nickFor(id);
const initialOf = (n) => (String(n).trim()[0] || "?").toUpperCase();

// Your id in this jam, as the jam shows it to everyone (a hash of playerId(), which stays secret:
// whoever sends it is you).
const jamMe = () => state.room?.you?.pid || "";
const jamData = () => state.room?.data;
const jamRole = () => state.room?.you?.role || "view";
const jamCan = (need) => !!state.room && ROLE_RANK[jamRole()] >= ROLE_RANK[need];
const isRoomHost = () => !!jamData() && !!jamMe() && jamData().host === jamMe();
const roomMe = () => jamData()?.players.find((p) => p.id === jamMe());
const roomSend = (m) => { const ws = state.room?.ws; if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
const inTogether = () => !!state.room && jamData()?.mode === "together";
const jamReadOnly = () => inTogether() && jamRole() !== "edit";
const jamLink = (role) => {
  const keys = jamData()?.keys;
  const key = role === "edit" ? keys?.edit : role === "comment" ? keys?.comment : "";
  return `${location.origin}${location.pathname}#jam=${state.room.code}${key ? `~${key}` : ""}`;
};

function openRoom(code, key = "") {
  if (!ROOMS_HOST || !ROOM_CODE.test(code)) return;
  if (state.room) leaveRoom(true);
  if (state.game) leaveGame();
  state.room = { code, key, ws: null, data: null, you: null, doc: null, lastSent: null, lastSel: null, presence: [], open: false, tries: 0, phase: null, round: 0, applying: false, spaceCtx: null, queue: Promise.resolve() };
  document.body.classList.add("in-room");
  connectRoom();
  renderRoomBar();
  history.replaceState(null, "", toHash());
}
function connectRoom() {
  const room = state.room;
  if (!room) return;
  const proto = /^(localhost|127\.0\.0\.1)/.test(ROOMS_HOST) ? "ws" : "wss";
  const ws = new WebSocket(`${proto}://${ROOMS_HOST}/parties/story-room/${room.code}${room.key ? `?k=${encodeURIComponent(room.key)}` : ""}`);
  room.ws = ws;
  ws.addEventListener("open", () => { room.tries = 0; ws.send(JSON.stringify({ t: "hello", pid: playerId(), name: savedName() })); renderRoomBar(); });
  // Messages are handled in order; a piece pinned to a grammar version the page hasn't seen
  // waits for that version to be fetched.
  ws.addEventListener("message", (e) => {
    let m;
    try { m = JSON.parse(e.data); } catch { return; }
    room.queue = room.queue.then(async () => {
      if (m.t === "space") takeSpaceCtx(room, m.ctx);
      else if (m.t === "doc" || m.t === "state") await prefetchRefs(m.t === "doc" ? m.doc : m.room);
      if (state.room === room) onRoomMessage(room, m);
    }).catch(() => {});
  });
  ws.addEventListener("close", () => {
    if (state.room !== room) return;
    room.ws = null;
    renderRoomBar();
    // Reconnect with backoff; the jam keeps the piece, your copy and comments.
    setTimeout(() => state.room === room && connectRoom(), Math.min(8000, 500 * 2 ** room.tries++));
  });
}
// The space this jam is in, as the jam relays it: its grammar versions are checked and kept like
// any other; lore and cast are checked where they're used.
function takeSpaceCtx(room, ctx) {
  if (!ctx || typeof ctx !== "object" || !SPACE_ID.test(ctx.id)) { room.spaceCtx = null; return; }
  const grammars = (Array.isArray(ctx.grammars) ? ctx.grammars : []).map((g) => g && Number.isInteger(g.ver) && g.doc?.id === g.gid && { gid: g.gid, ver: g.ver, doc: addVersion(ctx.id, g.ver, g.doc, ctx.public) }).filter((g) => g && g.doc);
  room.spaceCtx = {
    id: ctx.id, name: cleanWord(ctx.name).slice(0, 60) || "a space", public: !!ctx.public, grammars,
    lore: (Array.isArray(ctx.lore) ? ctx.lore : []).filter((l) => l && typeof l.text === "string" && l.text),
    cast: Array.isArray(ctx.cast) ? ctx.cast : [],
  };
}
function onRoomMessage(room, m) {
  if (m.t === "space") { renderRoomBar(); render(); return; }
  if (m.t === "state" && m.room && typeof m.room === "object") syncRoom(m.room, m.you);
  else if (m.t === "doc" && m.doc) { room.doc = m.doc; applyDoc(); }
  else if (m.t === "patch" && m.set && typeof m.set === "object") {
    if (!room.doc) { roomSend({ t: "sync" }); return; }
    patchInto(room.doc, m.set);
    if (m.by === jamMe()) return; // our own change, already on screen
    applyDoc();
  }
  else if (m.t === "presence" && Array.isArray(m.list)) { room.presence = m.list; paintPeers(); renderRoomBar(); }
  else if (m.t === "error") toast(String(m.error || "The jam said no."));
  else if (m.t === "deleted") { leaveRoom(); toast("The host deleted this jam."); }
}
function leaveRoom(quiet) {
  const room = state.room;
  if (!room) return;
  state.room = null;
  room.ws?.close();
  document.body.classList.remove("in-room", "room-compare", "jam-readonly", "room-host", "room-lobby");
  if (state.game) leaveGame();
  state.compare = null;
  $("#compare").hidden = true;
  $("#room-bar").hidden = true;
  if (!quiet) render();
}

// ---------- together: one shared piece ----------
// The piece as the jam holds it: a link snapshot without anyone's pins.
const docOf = () => { const s = clone(snapshot()); delete s.pn; return s; };
function patchInto(doc, set) {
  for (const [path, val] of Object.entries(set)) {
    const [top, sub] = path.split(".");
    if (sub === undefined) { if (val === null) delete doc[top]; else doc[top] = val; }
    else { doc[top] = doc[top] && typeof doc[top] === "object" ? doc[top] : {}; if (val === null) delete doc[top][sub]; else doc[top][sub] = val; }
  }
}
// What changed between two pieces, as patch paths; "whole" when the grammar itself changed.
function diffDoc(a, b) {
  if (a.g !== b.g || a.gs !== b.gs || a.gv !== b.gv || JSON.stringify(a.gx) !== JSON.stringify(b.gx)) return "whole";
  const set = {};
  for (const k of ["v", "f", "d", "s", "l"]) if (!same(a[k], b[k])) set[k] = b[k];
  for (const top of ["p", "b"]) {
    for (const k of new Set([...Object.keys(a[top] || {}), ...Object.keys(b[top] || {})])) {
      if (!same(a[top]?.[k], b[top]?.[k])) set[`${top}.${k}`] = b[top]?.[k] ?? null;
    }
  }
  return set;
}
// Show the shared piece, keeping your own pins and selection.
function applyDoc() {
  const room = state.room;
  if (!room?.doc || !inTogether()) return;
  const parsed = parseSnapshot(room.doc);
  if (!parsed) return;
  const keep = { pins: state.pins, sel: state.sel };
  const before = G;
  room.applying = true;
  try {
    applySnapshot(parsed);
    Object.assign(state, keep);
    // A different grammar: your selection and pins were in the old one (unless it's a version or
    // copy of it, as when an editor changes the grammar from the picker; render drops what's gone).
    if (G !== before) { if (!kinGrammars(G, before)) { state.sel = null; state.pins = []; } renderBankForm(); renderBank(); renderShelf(); renderLibrary(); }
    render();
  } finally {
    room.applying = false;
  }
  room.lastSent = docOf();
}
// Before a render: someone who can't edit has no changes to keep; put the shared piece back.
function jamBeforeRender() {
  const room = state.room;
  if (!room || room.applying || !jamReadOnly() || !room.doc || !room.lastSent) return;
  if (same(docOf(), room.lastSent)) return;
  const parsed = parseSnapshot(room.doc);
  if (!parsed) return;
  const keep = { pins: state.pins, sel: state.sel };
  applySnapshot(parsed);
  Object.assign(state, keep);
  toast(jamRole() === "comment" ? "You're commenting in this jam: leave a note on the word instead." : "You're viewing this jam. Ask for an edit link to change it.");
}
// After a render: editors send what they changed; everyone says where they're looking.
function jamAfterRender() {
  const room = state.room;
  if (!room) return;
  if (inTogether() && jamRole() === "edit" && !room.applying && room.ws?.readyState === 1 && room.data) {
    const now = docOf();
    if (!room.doc && !room.data.rev) {
      // A new together jam: this piece is where it starts.
      roomSend({ t: "doc", doc: now });
      room.doc = clone(now);
      room.lastSent = clone(now);
    } else if (room.doc && room.lastSent) {
      const set = diffDoc(room.lastSent, now);
      if (set === "whole") { roomSend({ t: "doc", doc: now }); room.doc = clone(now); }
      else if (Object.keys(set).length) { roomSend({ t: "patch", set }); patchInto(room.doc, set); }
      room.lastSent = clone(now);
    }
  }
  const sel = state.sel ? (state.sel.beat ? `beat|${state.sel.beat}` : `${state.sel.slot}|${state.sel.path.join(".")}`) : null;
  if (sel !== room.lastSel) { room.lastSel = sel; roomSend({ t: "presence", sel }); }
  paintPeers();
  paintNotes();
}

// ---------- presence and comments on the page ----------
const hue = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
function anchorEls(at) {
  if (!at) return [];
  const [slot, p] = at.split("|");
  if (slot === "beat") return [...document.querySelectorAll(`.beat[data-beat="${CSS.escape(p)}"]`)];
  return [...document.querySelectorAll(`.word[data-slot="${CSS.escape(slot)}"][data-path="${CSS.escape(p)}"]`)];
}
function paintPeers() {
  document.querySelectorAll(".peer").forEach((el) => { el.classList.remove("peer"); delete el.dataset.peer; el.style.removeProperty("--peer"); });
  if (!state.room) return;
  for (const p of state.room.presence) {
    if (p.pid === jamMe() || !p.sel) continue;
    for (const el of anchorEls(p.sel)) {
      if (el.classList.contains("peer")) continue;
      el.classList.add("peer");
      el.dataset.peer = whoName(p.name, p.pid);
      el.style.setProperty("--peer", `hsl(${hue(p.pid)} 65% 45%)`);
    }
  }
}
const openNotes = () => (jamData()?.comments || []).filter((c) => !c.entry);
function paintNotes() {
  document.querySelectorAll(".noted").forEach((el) => { el.classList.remove("noted"); el.removeAttribute("data-notes"); });
  if (!state.room) return;
  const counts = {};
  for (const c of openNotes()) if (!c.resolved && c.at) counts[c.at] = (counts[c.at] || 0) + 1;
  for (const [at, n] of Object.entries(counts)) for (const el of anchorEls(at)) { el.classList.add("noted"); el.dataset.notes = n; }
}

// Comments in the picker: the notes on this word or beat, and a box to add one.
function jamPickerHtml(at, quote) {
  if (!state.room) return "";
  const here = openNotes().filter((c) => c.at === at);
  const list = here.map((c) => noteHtml(c)).join("");
  const form = jamCan("comment") ? `<form class="jam-note-form" data-note-at="${esc(at)}" data-note-quote="${esc(quote)}" autocomplete="off">
      <input name="note" maxlength="600" placeholder="Comment on “${esc(quote.slice(0, 40))}”" aria-label="Comment">
      <button type="submit">Comment</button></form>` : "";
  return `<div class="jam-notes">${list ? `<h4 class="dial-label">Comments</h4>${list}` : ""}${form}</div>`;
}
function noteHtml(c, showQuote = false) {
  const mine = !!jamMe() && c.pid === jamMe();
  return `<div class="note${c.resolved ? " resolved" : ""}">
    ${showQuote && c.quote ? `<button class="note-quote" data-jc-show="${esc(c.at || "")}">“${esc(c.quote)}”</button>` : ""}
    <p><b>${esc(whoName(c.name, c.pid))}</b> ${esc(c.text)}</p>
    <div class="note-actions">
      ${jamCan("comment") ? `<button data-jc-resolve="${esc(c.id)}" data-done="${c.resolved ? "" : "1"}">${c.resolved ? "Reopen" : "Resolve"}</button>` : ""}
      ${mine || isRoomHost() ? `<button data-jc-delete="${esc(c.id)}">Delete</button>` : ""}
    </div>
  </div>`;
}
function showAnchor(at) {
  if (!at) return;
  const [slot, p] = at.split("|");
  if (slot === "beat") { if (stanza().paras.flat().includes(p)) selectBeat(p); }
  else { const el = anchorEls(at)[0]; if (el) select(slot, p.split("."), el); }
  selectedEl()?.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---------- workshop ----------
function clapDisabled(e) {
  if (!state.room) return false;
  const d = jamData();
  return d?.phase !== "vote" || e.id === jamMe() || !jamCan("comment") || (roomMe()?.clapsLeft ?? 0) <= 0;
}
const clapsOn = () => !state.room || !!jamData()?.rules?.claps;
// Notes on one copy, and a box to add one (comment and edit roles).
function jamCardHtml(e) {
  if (!state.room || !e.id) return "";
  const d = jamData();
  const notes = (d?.comments || []).filter((c) => c.entry === e.id && c.round === d.round);
  const form = d?.phase === "vote" && jamCan("comment") && e.id !== jamMe() ? `<form class="jam-note-form" data-note-entry="${esc(e.id)}" autocomplete="off">
      <input name="note" maxlength="600" placeholder="A note for ${esc(whoName(e.name, e.id))}" aria-label="Note">
      <button type="submit">Add</button></form>` : "";
  return notes.length || form ? `<div class="jam-notes">${notes.map((c) => noteHtml(c)).join("")}${form}</div>` : "";
}

// The jam's view arrives on every change. Bring the page in line with its mode and phase.
function syncRoom(d, you) {
  const room = state.room;
  room.data = d;
  room.you = you || room.you;
  // The owner opened the jam without a key; keep the edit key so a reload stays an editor.
  if (!room.key && d.keys?.edit && jamRole() === "edit") { room.key = d.keys.edit; history.replaceState(null, "", toHash()); }
  const fresh = room.phase !== d.phase || room.round !== d.round || room.mode !== d.mode;
  room.phase = d.phase;
  room.round = d.round;
  room.mode = d.mode;
  // Opened from a space: once this tab is the host, link the jam to it.
  if (room.pendingSpace && isRoomHost()) { roomSend({ t: "space", id: room.pendingSpace.id, k: room.pendingSpace.k }); room.pendingSpace = null; }
  if (!d.space && room.spaceCtx) room.spaceCtx = null;
  document.body.classList.toggle("jam-readonly", jamReadOnly());
  if (d.mode === "together") {
    if (state.game) leaveGame();
    if (state.compare) { state.compare = null; $("#compare").hidden = true; }
    if (room.doc && fresh) applyDoc();
  } else {
    const c = d.challenge && parseChallenge(d.challenge);
    if (d.phase === "play" && c && jamCan("edit")) {
      if (!state.game || challengeId(state.game.c) !== challengeId(c)) startGame(c, undefined, savedName());
      if (state.compare) { state.compare = null; $("#compare").hidden = true; }
    } else if (state.game) leaveGame();
    if ((d.phase === "vote" || d.phase === "results") && c) {
      const entries = (d.entries || []).map((e) => {
        const cp = parseCopy({ c: d.challenge, me: e.me, name: whoName(e.name, e.id) });
        return cp && { id: e.id, name: cp.name, me: cp.me, votes: Number(e.claps) || 0 };
      }).filter(Boolean);
      state.compare = { c, entries };
      $("#compare").hidden = false;
      renderCompare();
      if (fresh) $("#compare").scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (state.compare) { state.compare = null; $("#compare").hidden = true; }
  }
  renderRoomBar();
  render();
}

function renderRoomBar() {
  const bar = $("#room-bar");
  const room = state.room;
  if (!room) { bar.hidden = true; return; }
  bar.hidden = false;
  const d = room.data;
  const me = roomMe();
  const role = jamRole();
  const host = d?.players.find((p) => p.id === d.host);
  const looking = (pid) => room.presence.find((x) => x.pid === pid)?.sel;
  const players = (d?.players || []).map((p) => `<li class="${p.online ? "" : "away"}" style="--peer: hsl(${hue(p.id)} 65% 45%)">${p.id === d.host ? `<span title="host">★</span> ` : ""}${esc(whoName(p.name, p.id))}${p.id === jamMe() ? " (you)" : ""} <span class="role">${ROLE_NAMES[p.role] || "viewer"}</span>${d.mode === "workshop" && d.phase === "play" && p.submitted ? ` <span class="ok">sent</span>` : ""}${d.mode === "workshop" && d.phase === "vote" && d.rules.claps && p.role !== "view" ? ` <span class="claps">${p.clapsLeft} 👏</span>` : ""}${d.mode === "together" && looking(p.id) && p.id !== jamMe() ? ` <span class="looking">on a word</span>` : ""}</li>`).join("");
  let body = "";
  let act = ""; // the host's phase action, kept in the strip so it's one tap away
  if (isRoomHost() && d) {
    if (d.mode === "workshop" && d.phase === "lobby") act = `<button id="rb-start" class="primary">Start round</button>`;
    else if (d.mode === "workshop" && d.phase === "play") act = `<button id="rb-vote" class="primary" ${d.players.some((p) => p.submitted) ? "" : "disabled"}>Reveal</button>`;
    else if (d.mode === "workshop" && d.phase === "vote") act = `<button id="rb-end" class="primary">End round</button>`;
    else if (d.mode === "workshop" && d.phase === "results") act = `<button id="rb-lobby" class="primary">Next round</button>`;
  }
  if (!d) body = `<p class="rb-phase">${room.ws ? "Joining…" : "Connecting…"}</p>`;
  else if (d.mode === "together") {
    const open = openNotes().filter((c) => !c.resolved);
    const done = openNotes().filter((c) => c.resolved);
    body = `<p class="rb-phase">${role === "edit" ? "Together: everyone tunes this one piece live. Your changes go to everyone; anyone looking at a word shows up on it." : role === "comment" ? "Together: you're commenting. Tap any word or beat to leave a note on it." : "Together: you're watching. The piece changes as others tune it."}</p>
      <details class="rb-history" ${open.length ? "open" : ""}><summary>${open.length} open comment${open.length === 1 ? "" : "s"}${done.length ? `, ${done.length} resolved` : ""}</summary>
        <div class="jam-thread">${open.map((c) => noteHtml(c, true)).join("") || `<p class="empty">No comments yet${jamCan("comment") ? ". Tap a word to leave one." : "."}</p>`}
        ${done.length ? `<details><summary>Resolved</summary>${done.map((c) => noteHtml(c, true)).join("")}</details>` : ""}</div>
      </details>`;
  } else if (d.phase === "lobby") body = isRoomHost()
    ? `<p class="rb-phase">Workshop: set up a piece (Rules holds the grammar, form, length and dial), then start a round. Everyone gets the same start, tunes their own copy, and the copies come back for critique.</p>
       <div class="cp-row">
         <label class="bf-field"><span class="dial-label">Move limit</span><select id="rb-moves">${[0, 1, 2, 3, 4, 5].map((n) => `<option value="${n}" ${n === d.rules.moves ? "selected" : ""}>${n ? `${n} move${n === 1 ? "" : "s"}` : "no limit"}</option>`).join("")}</select></label>
         <label class="lib-check"><input type="checkbox" id="rb-claps" ${d.rules.claps ? "checked" : ""}> Claps (a winner)</label>
       </div>
       <div class="cp-row"><button id="rb-daily" class="ghost">Start with today's bit</button></div>`
    : `<p class="rb-phase">Workshop: waiting for ${esc(host ? whoName(host.name, host.id) : "the host")} to start a round.${role === "comment" ? " You're a critic this time: you'll read and comment on everyone's copies." : ""}</p>`;
  else if (d.phase === "play") {
    const writers = d.players.filter((p) => p.online && p.role === "edit");
    const sent = d.players.filter((p) => p.submitted).length;
    body = `<p class="rb-phase">Round ${d.round}: ${role === "edit" ? `tune your copy below, then send it.` : "the writers are tuning their copies."} ${sent} of ${writers.length} sent. ${d.rules.moves ? `Limit: ${d.rules.moves} move${d.rules.moves === 1 ? "" : "s"}.` : "No move limit."}</p>`;
  } else if (d.phase === "vote") body = `<p class="rb-phase">Critique: read every copy against the original, leave notes${d.rules.claps ? `, and clap for your favorites (${me?.clapsLeft ?? 0} of ${d.clapsEach} left, not your own)` : ""}.</p>`;
  else if (d.phase === "results") {
    const best = Math.max(0, ...d.entries.map((e) => e.claps));
    const winners = d.rules.claps ? d.entries.filter((e) => best && e.claps === best).map((e) => whoName(e.name, e.id)) : [];
    body = `<p class="rb-phase">${winners.length ? `<b>${esc(winners.join(" & "))}</b> took round ${d.round} with ${best} 👏.` : `Round ${d.round} is done.`} Saved to the jam's history with everyone's notes.</p>`;
  }
  const history = d?.mode === "workshop" && d.history?.length ? `<details class="rb-history"><summary>${d.stored} stored round${d.stored === 1 ? "" : "s"}</summary><ol>${d.history.map((h) => `<li>Round ${h.round}${h.top.length ? `: ${esc(h.top.join(" & "))}` : ""}</li>`).join("")}</ol></details>` : "";
  const invites = d?.keys ? `<div class="rb-invites"><span class="dial-label">Invite</span>
      <button class="ghost" data-invite="edit">Edit link</button><button class="ghost" data-invite="comment">Comment link</button><button class="ghost" data-invite="view">View link</button></div>` : "";
  const ctx = room.spaceCtx;
  const linkable = isRoomHost() && d && !d.space ? spaces.list.filter((s) => spaces.data[s.id] && spaceCan(s.id, "edit")) : [];
  const spaceBlock = d?.space ? `<details class="rb-history rb-space" ${ctx?.lore.length ? "open" : ""}><summary>In space “${esc(ctx?.name || d.space.name)}” · ${ctx?.lore.length || 0} kept phrase${ctx?.lore.length === 1 ? "" : "s"}</summary>
      ${ctx?.grammars.length ? `<p class="sp-sub">Its grammars: ${ctx.grammars.map((g) => `<button class="ghost" data-jam-gram="${esc(g.gid)}">${esc(g.doc.name)} v${g.ver}</button>`).join(" ")}</p>` : ""}
      ${ctx?.lore.length ? `<ul class="sp-lore">${ctx.lore.map((l) => `<li><button class="sp-lore-use" data-sp-lore="${esc(l.id)}">“${esc(cleanWord(l.text))}”</button><span class="sp-sub">${esc(cleanWord(l.label || ""))}${l.by ? ` · ${esc(cleanWord(l.by))}` : ""}</span></li>`).join("")}</ul>` : `<p class="empty">No lore yet. Tap a word, then <i>Keep as lore</i>.</p>`}
      <p class="rb-fine">Kept phrases go to the space. Bring one back in a workshop copy and it's marked as a callback.${isRoomHost() ? ` <button class="ghost subtle" id="rb-unspace">Take this jam out of the space</button>` : ""}</p>
    </details>` : linkable.length ? `<div class="cp-row rb-space"><label class="bf-field"><span class="dial-label">Open in a space</span><select id="rb-space-pick">${linkable.map((s) => `<option value="${s.id}">${esc(spaces.data[s.id].name)}</option>`).join("")}</select></label><button class="ghost" id="rb-space">Link</button></div>` : "";
  // Keep a half-typed name through the re-render that every presence message causes.
  const ae = document.activeElement;
  const keepFocus = ae && bar.contains(ae) && ae.matches?.("input") && ae.id ? { id: ae.id, value: ae.value, at: ae.selectionStart } : null;
  const online = (d?.players || []).filter((p) => p.online);
  const faces = online.slice(0, 4).map((p) => { const n = whoName(p.name, p.id); return `<span class="rb-face" style="--peer: hsl(${hue(p.id)} 65% 45%)" title="${esc(n)}${p.id === jamMe() ? " (you)" : ""}">${esc(initialOf(n))}</span>`; }).join("") + (online.length > 4 ? `<span class="rb-face more">+${online.length - 4}</span>` : "");
  const nOpen = d?.mode === "together" ? openNotes().filter((c) => !c.resolved).length : 0;
  const asking = !!d && !!me && !me.name && !savedName() && !room.nameAsked && !askedBefore(room.code);
  bar.classList.toggle("open", !!room.open);
  bar.innerHTML = `
    <div class="rb-strip">
      <span class="rb-id"><span class="rb-code">${esc(room.code)}</span><span class="rb-role">${role === "edit" ? "editor" : role === "comment" ? "commenter" : "viewer"}${room.ws ? "" : ` <span class="rb-off">· offline</span>`}</span></span>
      <span class="rb-faces" aria-label="${online.length} here">${faces}</span>
      ${nOpen ? `<span class="rb-count" title="open comments">💬 ${nOpen}</span>` : ""}
      <span class="rb-act">${act}</span>
      <button id="rb-toggle" class="rb-toggle ghost" aria-expanded="${room.open ? "true" : "false"}" aria-label="${room.open ? "Hide jam details" : "Show jam details"}">${room.open ? "▴" : "▾"}</button>
    </div>
    ${asking ? `<form class="rb-ask" id="rb-ask"><label><span class="dial-label">Your name in this jam</span><input id="rb-ask-name" maxlength="${NAME_MAX}" value="${esc(savedName())}" placeholder="${esc(nickFor(jamMe()))}" autocomplete="nickname"></label><button class="primary" type="submit">Join</button><button class="ghost subtle" type="button" id="rb-ask-skip">Skip</button></form>` : ""}
    <div class="rb-more">
    <div class="rb-top">
      <div><span class="eyebrow">Jam · you're ${role === "edit" ? "an editor" : role === "comment" ? "a commenter" : "a viewer"}</span></div>
      <div class="rb-actions">
        ${isRoomHost() && d ? `<span class="seg rb-mode"><label><input type="radio" name="rb-mode" value="together" ${d.mode === "together" ? "checked" : ""}>together</label><label><input type="radio" name="rb-mode" value="workshop" ${d.mode === "workshop" ? "checked" : ""}>workshop</label></span>` : d ? `<span class="rb-modename">${esc(d.mode)}</span>` : ""}
        <button id="rb-leave" class="ghost subtle">Leave</button>
      </div>
    </div>
    ${invites}
    ${spaceBlock}
    <label class="gb-name rb-name"><span class="dial-label">Your name</span><input id="rb-name" maxlength="${NAME_MAX}" value="${esc(me?.name ?? savedName())}" placeholder="${esc(nickFor(jamMe()))}"></label>
    <ul class="rb-players">${players}</ul>
    ${body}
    ${history}
    ${isRoomHost() && d ? `<div class="rb-keep">
      <label class="bf-field"><span class="dial-label">Keep this jam</span><select id="rb-retain">
        ${[["30d", "for a month after it's last used"], ["1y", "for a year after it's last used"], ["keep", "until I delete it"]].map(([v, t]) => `<option value="${v}" ${d.retain === v ? "selected" : ""}>${t}</option>`).join("")}
      </select></label>
      ${d.stored || d.comments.length ? `<button id="rb-forget" class="ghost subtle">Forget history and comments</button>` : ""}
      <button id="rb-delete" class="ghost subtle">Delete this jam</button>
    </div>` : ""}
    <p class="rb-fine">This jam keeps its piece, comments and finished rounds (nicknames only) so you can come back. ${d ? ({ "30d": "It's kept for a month after it's last used", "1y": "It's kept for a year after it's last used", keep: "It's kept until the host deletes it" })[d.retain] || "It's kept for a year after it's last used" : "How long it's kept is the host's call"}; the host can wipe or delete it any time.</p>
    </div>`;
  if (keepFocus) { const el = bar.querySelector(`#${keepFocus.id}`); if (el) { el.value = keepFocus.value; el.focus(); try { el.setSelectionRange(keepFocus.at, keepFocus.at); } catch {} } }
  document.body.classList.toggle("room-host", isRoomHost());
  document.body.classList.toggle("room-lobby", d?.phase === "lobby" && d?.mode === "workshop");
}

// ---------- events ----------
document.addEventListener("click", (e) => {
  if (!(e.target instanceof Element) || !state.room) return;
  const t = e.target.closest("button");
  if (!t) return;
  const d = t.dataset;
  if (d.invite) {
    const what = { edit: "Anyone with it can tune the piece.", comment: "Anyone with it can comment and clap, not edit.", view: "Anyone with it can watch." }[d.invite];
    copy(jamLink(d.invite), `${cap(d.invite)} link copied. ${what}`);
  }
  else if (t.id === "rb-leave") leaveRoom();
  else if (t.id === "rb-toggle") { state.room.open = !state.room.open; renderRoomBar(); }
  else if (t.id === "rb-ask-skip") { askedName(); renderRoomBar(); }
  else if (t.id === "rb-space") { const id = $("#rb-space-pick").value; roomSend({ t: "space", id, k: spaceEntry(id)?.k || "" }); }
  else if (t.id === "rb-unspace") roomSend({ t: "unspace" });
  else if (d.jamGram) { const g = state.room.spaceCtx?.grammars.find((x) => x.gid === d.jamGram); if (g && !jamReadOnly()) switchGrammar(g.doc); }
  else if (t.id === "rb-start" || t.id === "rb-daily") {
    const n = jamData().rules.moves;
    const c = t.id === "rb-daily" ? { ...dailyChallenge(), n } : { h: whoName(roomMe()?.name, jamMe()), n, s: fixedSnapshot() };
    roomSend({ t: "start", c });
  }
  else if (t.id === "rb-vote") roomSend({ t: "vote" });
  else if (t.id === "rb-end") roomSend({ t: "end" });
  else if (t.id === "rb-lobby") roomSend({ t: "lobby" });
  else if (t.id === "rb-delete") { if (confirm("Delete this jam for everyone: the piece, comments and history? This can't be undone.")) roomSend({ t: "delete" }); }
  else if (t.id === "rb-forget") { if (confirm("Forget every stored round and comment in this jam? This can't be undone.")) roomSend({ t: "forget" }); }
  else if (t.id === "gb-send") { roomSend({ t: "submit", me: fixedSnapshot() }); toast("Sent to the jam."); }
  else if (d.jcResolve) roomSend({ t: "resolve", id: d.jcResolve, done: !!d.done });
  else if (d.jcDelete) roomSend({ t: "uncomment", id: d.jcDelete });
  else if (d.jcShow !== undefined) showAnchor(d.jcShow);
});
document.addEventListener("submit", (e) => {
  const f = e.target;
  if (!(f instanceof HTMLFormElement) || !f.matches(".jam-note-form")) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const text = cleanText(f.elements.note.value);
  if (!text) return;
  if (f.dataset.noteEntry) roomSend({ t: "comment", entry: f.dataset.noteEntry, text });
  else roomSend({ t: "comment", at: f.dataset.noteAt, quote: f.dataset.noteQuote, text });
  f.elements.note.value = "";
}, true);
document.addEventListener("change", (e) => {
  const el = e.target;
  if (!(el instanceof Element) || !state.room) return;
  if (el.name === "rb-mode") roomSend({ t: "mode", mode: el.value });
  else if (el.id === "rb-retain") roomSend({ t: "retain", value: el.value });
  else if (el.id === "rb-moves" || el.id === "rb-claps") roomSend({ t: "rules", moves: +$("#rb-moves").value, claps: $("#rb-claps").checked });
});
let nameTimer;
document.addEventListener("input", (e) => {
  if (!(e.target instanceof Element) || e.target.id !== "rb-name" || !state.room) return;
  const n = cleanName(e.target.value);
  try { localStorage.setItem(NAME_KEY, n); } catch {}
  clearTimeout(nameTimer);
  nameTimer = setTimeout(() => roomSend({ t: "name", name: n }), 300);
});

const askedBefore = (code) => { try { return !!sessionStorage.getItem(`story-bits-asked-${code}`); } catch { return false; } };
// Asked once per jam in this tab: Join saves the name, Skip keeps the stand-in.
function askedName() {
  const room = state.room;
  if (!room) return;
  room.nameAsked = true;
  try { sessionStorage.setItem(`story-bits-asked-${room.code}`, "1"); } catch {}
}
document.addEventListener("submit", (e) => {
  if (!(e.target instanceof HTMLFormElement) || e.target.id !== "rb-ask" || !state.room) return;
  e.preventDefault();
  const n = cleanName($("#rb-ask-name").value);
  if (n) { try { localStorage.setItem(NAME_KEY, n); } catch {} roomSend({ t: "name", name: n }); }
  askedName();
  renderRoomBar();
});
