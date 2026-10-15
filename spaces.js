// Spaces: persistent shared folders for a group, on the room server (party/src/space.js). A space
// holds grammars, word packs, kept pieces, cast, lore (kept phrases), comments and jam history.
// See docs/design.md ("Spaces"). Loaded after jam.js, before app.js; everything here runs at
// call time.
//
// Local-first: nothing leaves the browser unless you create or join a space and put something in
// it. The spaces you've joined, and their keys, are listed in this browser only.
//
// Grammars in a space are immutable versions. A piece made with one pins it (v4 links: gs = the
// space, gv = the version). Everything a space sends is checked here with the same checks links
// use (checkGrammar, checkEntry, parseSnapshot) before the page touches it.
// The grammar-version registry (SPACE_ID, srcOf, refOf, addVersion, knownVersion) is in engine.js.

const newSpaceId = () => Array.from({ length: 8 }, () => ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]).join("");
const SPACE_PROTO = /^(localhost|127\.0\.0\.1)/.test(ROOMS_HOST) ? "http" : "https";
const spaceUrl = (id) => `${SPACE_PROTO}://${ROOMS_HOST}/parties/story-space/${id}`;
const SPACE_ROLE_RANK = { view: 0, comment: 1, edit: 2, owner: 3 };
const SPACE_RETAIN_NAMES = { keep: "until I delete it", "1y": "for a year after it's last used", "30d": "for a month after it's last used" };

// ---------- fetching grammar versions ----------
async function fetchVersion(sp, gid, ver) {
  if (knownVersion({ gs: sp, gv: ver }, gid)) return knownVersion({ gs: sp, gv: ver }, gid);
  const mine = spaces.list.find((s) => s.id === sp);
  try {
    // Keys go in a POST body, never the URL; a public space answers a plain GET.
    const res = mine?.k
      ? await fetch(spaceUrl(sp), { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ op: "gv", gv: `${gid}@${ver}`, k: mine.k }) })
      : await fetch(`${spaceUrl(sp)}?${new URLSearchParams({ gv: `${gid}@${ver}` })}`);
    if (!res.ok) return null;
    const out = await res.json();
    // Without a key, a space only answers if it's public.
    return out?.doc?.id === gid ? addVersion(sp, ver, out.doc, !mine?.k || mine.public) : null;
  } catch { return null; }
}
// Fetch every grammar version a payload (a piece, a challenge, a set of copies) points at, so the
// synchronous parsers can resolve it. Pieces that carry gx still open without this.
async function prefetchRefs(x, depth = 0) {
  if (!x || typeof x !== "object" || depth > 6) return;
  const ref = refOf(x);
  const jobs = [];
  if (ref && typeof x.g === "string" && !knownVersion(ref, x.g)) jobs.push(fetchVersion(ref.gs, x.g, ref.gv));
  for (const v of Object.values(x)) if (v && typeof v === "object") jobs.push(prefetchRefs(v, depth + 1));
  await Promise.all(jobs);
}
// Every link payload in some text (a pasted group chat), prefetched.
async function prefetchText(text) {
  const jobs = [];
  for (const m of String(text).matchAll(/#(?:s|p|c|cmp)=([A-Za-z0-9_-]+)/g)) { try { jobs.push(prefetchRefs(JSON.parse(unb64(m[1])))); } catch {} }
  await Promise.all(jobs);
}

// ---------- my spaces (this browser) ----------
const SPACES_KEY = "story-bits-spaces";
function loadMySpaces() {
  try {
    return (JSON.parse(localStorage.getItem(SPACES_KEY)) || []).filter((s) => s && SPACE_ID.test(s.id) && typeof s.k === "string");
  } catch { return []; }
}
function saveMySpaces() {
  try { localStorage.setItem(SPACES_KEY, JSON.stringify(spaces.list)); } catch {}
}
// One id per browser for your comments in spaces (jams use one per tab).
function spacePid() {
  try {
    let id = localStorage.getItem("story-bits-me");
    if (!id) { id = "m-" + crypto.randomUUID(); localStorage.setItem("story-bits-me", id); }
    return id;
  } catch { return (window.__me ||= "m-" + crypto.randomUUID()); }
}

// list: spaces you've joined ({ id, name, k, role, public, retain, expiresAt }); data: each one's
// last view, checked; active: the one shown; visiting: a space opened by link, not joined yet.
const spaces = { list: loadMySpaces(), data: {}, active: null, visiting: null, error: "", open: null, gone: {}, target: {} };
const spaceEntry = (id) => spaces.list.find((s) => s.id === id) || (spaces.visiting?.id === id ? spaces.visiting : null);
const spaceRole = (id) => spaces.data[id]?.role || spaceEntry(id)?.role || "view";
const spaceCan = (id, need) => SPACE_ROLE_RANK[spaceRole(id)] >= SPACE_ROLE_RANK[need];
const activeSpace = () => (spaces.active && spaces.data[spaces.active]) || null;

async function spaceCall(id, body) {
  const res = await fetch(spaceUrl(id), { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(out.error || `The space said no (${res.status}).`); e.status = res.status; throw e; }
  return out;
}
// Check a space's view before using any of it: grammars must pass checkGrammar (and not take a
// built-in's id); everything else is checked again where it's used.
function checkSpace(v) {
  if (!v || typeof v !== "object" || !SPACE_ID.test(v.id) || !Array.isArray(v.items)) return null;
  const items = [];
  let dropped = 0;
  for (const it of v.items) {
    if (!it || typeof it.id !== "string" || !["grammar", "words", "piece", "cast"].includes(it.kind) || !it.data || typeof it.data !== "object") { dropped++; continue; }
    if (it.kind === "grammar") {
      const doc = Number.isInteger(it.head) && it.data.id === it.gid ? addVersion(v.id, it.head, it.data, v.public) : null;
      if (!doc) { dropped++; continue; }
      items.push({ ...it, data: doc });
    } else items.push(it);
  }
  const str = (x, n) => cleanWord(x).slice(0, n);
  return {
    id: v.id, name: str(v.name, 60) || "A space", public: !!v.public, role: SPACE_ROLE_RANK[v.role] !== undefined ? v.role : "view",
    retain: SPACE_RETAIN_NAMES[v.retain] ? v.retain : "keep", expiresAt: Number.isFinite(v.expiresAt) ? v.expiresAt : null,
    keys: v.keys && typeof v.keys === "object" ? v.keys : null, items, dropped,
    comments: (Array.isArray(v.comments) ? v.comments : []).filter((c) => c && typeof c.text === "string" && typeof c.item === "string"),
    lore: (Array.isArray(v.lore) ? v.lore : []).filter((l) => l && typeof l.text === "string" && l.text),
    // Viewers aren't sent jam codes (a code is enough to watch a jam).
    jams: (Array.isArray(v.jams) ? v.jams : []).filter((j) => j && (j.code === undefined || ROOM_CODE.test(j.code))),
  };
}
// Take a view from the server: check it, and keep what this browser lists about it current.
function takeSpace(raw) {
  const v = checkSpace(raw);
  if (!v) return null;
  spaces.data[v.id] = v;
  const mine = spaces.list.find((s) => s.id === v.id);
  if (mine) { Object.assign(mine, { name: v.name, role: v.role, public: v.public, retain: v.retain, expiresAt: v.expiresAt }); saveMySpaces(); }
  return v;
}

async function loadSpace(id, k) {
  // A POST, so the key and your comment id stay out of URLs (and any log of them).
  const res = await fetch(spaceUrl(id), { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ op: "get", pid: spacePid(), ...(k && { k }) }) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(out.error || "That space couldn't be opened."); e.status = res.status; throw e; }
  return takeSpace(out.space);
}
async function refreshSpace(id) {
  try { await loadSpace(id, spaceEntry(id)?.k); delete spaces.gone[id]; }
  catch (e) { if (e.status === 404 || e.status === 403) spaces.gone[id] = e.message; else spaces.error = e.message; }
  renderSpaces();
}
async function refreshAllSpaces() {
  await Promise.all(spaces.list.map((s) => loadSpace(s.id, s.k).then(() => delete spaces.gone[s.id]).catch((e) => { if (e.status === 404 || e.status === 403) spaces.gone[s.id] = e.message; })));
  if (!spaces.active && spaces.list.length) spaces.active = spaces.list[0].id;
  renderSpaces();
  renderLibrary();
  render();
}

// An op on a space, as you (your key, your name, your comment id). Re-renders on success.
async function spaceOp(id, op, extra = {}) {
  spaces.error = "";
  try {
    const out = await spaceCall(id, { op, k: spaceEntry(id)?.k || "", pid: spacePid(), name: savedName(), ...extra });
    if (out.space) takeSpace(out.space);
    return out;
  } catch (e) {
    spaces.error = e.message;
    toast(e.message);
    return null;
  } finally {
    renderSpaces();
    renderLibrary();
  }
}

async function createSpace(name) {
  for (let tries = 0; tries < 4; tries++) {
    const id = newSpaceId();
    try {
      const out = await spaceCall(id, { op: "create", name: cleanWord(name).slice(0, 60) || "Our space" });
      const v = takeSpace(out.space);
      spaces.list.unshift({ id, name: v.name, k: out.space.keys.owner, role: "owner", public: false, retain: v.retain, expiresAt: null });
      saveMySpaces();
      spaces.active = id;
      toast(`Made “${v.name}”. It's kept until you delete it. Invite people from its edit, comment or view link.`);
      renderSpaces();
      renderLibrary();
      return v;
    } catch (e) { if (e.status !== 409) { toast(e.message); return null; } }
  }
  toast("Couldn't find a free id for the space. Try again.");
  return null;
}
function joinVisiting() {
  const s = spaces.visiting;
  if (!s) return;
  if (!spaces.list.some((x) => x.id === s.id)) spaces.list.unshift({ ...s, name: spaces.data[s.id]?.name || s.name || s.id, role: spaces.data[s.id]?.role || s.role });
  spaces.visiting = null;
  saveMySpaces();
  toast("Added to your spaces. Its link and key are kept in this browser.");
  renderSpaces();
  renderLibrary();
}
function leaveSpace(id) {
  const s = spaces.list.find((x) => x.id === id);
  if (!s) return;
  const owner = s.role === "owner";
  if (!confirm(owner ? `Forget “${s.name}” in this browser? You're its owner: without its owner link (copy it first) nobody can change its settings or delete it. The space itself stays.` : `Forget “${s.name}” in this browser? The space stays for everyone else; you'd need its link to come back.`)) return;
  spaces.list = spaces.list.filter((x) => x.id !== id);
  delete spaces.data[id];
  if (spaces.active === id) spaces.active = spaces.list[0]?.id || null;
  saveMySpaces();
  renderSpaces();
  renderLibrary();
  render();
}

// ---------- grammars: use, fork, publish ----------
const spaceGrammar = (id, gid) => spaces.data[id]?.items.find((it) => it.kind === "grammar" && it.gid === gid) || null;
function useSpaceGrammar(id, gid) {
  const it = spaceGrammar(id, gid);
  if (it) switchGrammar(it.data);
}
function forkFromSpace(id, gid) {
  const it = spaceGrammar(id, gid);
  if (!it) return;
  const copy = plain(it.data);
  copy.name = `${it.data.name}`.slice(0, 40);
  copy.id = freshId(copy.name);
  copy.forkedFrom = gid;
  // Where it came from, so publishing it back can add a version instead of a second grammar.
  copy.upstream = `${id}/${gid}@${it.head}`;
  library[copy.id] = copy;
  saveLibrary();
  switchGrammar(copy.id);
  renderLibrary();
  toast(`“${copy.name}” is in your library now, from version ${it.head}. Edit it there; publish it back as a new version when you're ready.`);
}
// "SPACE/gid@n" -> its parts, if well-formed.
function upstreamOf(g) {
  const m = /^([A-Z0-9]{8})\/([a-z][a-z0-9-]{1,39})@(\d{1,4})$/.exec(g?.upstream || "");
  return m ? { sp: m[1], gid: m[2], ver: +m[3] } : null;
}
// Publish one of your grammars to a space: as the next version of what it was forked from, or
// as a grammar of its own.
async function publishGrammar(localId, spaceId, asVersion) {
  const g = library[localId];
  if (!g || !spaceCan(spaceId, "edit")) return;
  const up = upstreamOf(g);
  const data = plain(g);
  let base = 0;
  if (asVersion && up && up.sp === spaceId) { data.id = up.gid; base = up.ver; }
  const out = await spaceOp(spaceId, "put", { item: { kind: "grammar", base, data } });
  if (!out) return;
  const it = spaceGrammar(spaceId, data.id);
  if (it) { library[localId] = { ...g, upstream: `${spaceId}/${data.id}@${it.head}` }; saveLibrary(); }
  toast(`Published “${g.name}” to ${spaces.data[spaceId].name} as version ${it?.head ?? 1}. Pieces made with older versions keep theirs.`);
  renderLibrary();
}

// ---------- pieces, words, cast ----------
const pieceName = () => { try { return bitLine(context()).slice(0, 80); } catch { return "A piece"; } };
async function keepPiece(id) {
  const data = clone(snapshot());
  delete data.pn;
  if (await spaceOp(id, "put", { item: { kind: "piece", name: pieceName(), data } })) toast(`Kept in ${spaces.data[id].name}${srcOf.get(G) ? `, pinned to version ${srcOf.get(G).ver} of ${G.name}` : ""}.`);
}
async function openPiece(id, itemId, toVer) {
  const it = spaces.data[id]?.items.find((x) => x.id === itemId);
  if (!it) return;
  const data = toVer ? { ...it.data, gv: toVer, gx: undefined } : it.data;
  await prefetchRefs(data);
  if (state.room && jamReadOnly()) { toast("You're not an editor in this jam."); return; }
  if (state.game) leaveGame();
  const before = G;
  if (!loadSnapshot(data)) { toast(toVer ? `This piece doesn't fit version ${toVer}: its words moved. It stays on its own version.` : "That piece couldn't be opened (its grammar is gone)."); return; }
  state.sel = null;
  if (G !== before) { renderBankForm(); renderBank(); renderCast(); renderLibrary(); }
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function putWords(id) {
  const words = bank.filter((e) => gOf(e) === G.id);
  if (!words.length) { toast(`Your word bank has no words for ${G.name} yet.`); return; }
  if (await spaceOp(id, "put", { item: { kind: "words", name: `${words.length} word${words.length === 1 ? "" : "s"} for ${G.name}`, data: { g: G.id, words } } })) toast(`Put ${words.length} words in ${spaces.data[id].name}.`);
}
function takeWords(id, itemId) {
  const it = spaces.data[id]?.items.find((x) => x.id === itemId);
  const words = Array.isArray(it?.data.words) ? it.data.words.filter((e) => e && typeof e === "object") : [];
  const n = addToBank(words);
  toast(n ? `Added ${n} word${n === 1 ? "" : "s"} to your word bank.` : "Those words are already in your bank, or don't fit a grammar you have.");
  renderBank();
  updateBankForm();
  render();
}
async function putCast(id) {
  const here = castHere();
  if (!here.length) { toast("Keep a character first (k), then put them in the space."); return; }
  const have = (spaces.data[id]?.items || []).filter((x) => x.kind === "cast");
  for (const { c } of here) {
    const prev = have.find((x) => x.data?.who && castKey({ g: x.data.g, who: x.data.who }) === castKey(c));
    const name = cleanWord(flat(tokens(G.pronouns, c.who, word(G.pronouns, c.who, "n"), G.pronouns))).slice(0, 80);
    const src = srcOf.get(G);
    await spaceOp(id, "put", { item: { ...(prev && { id: prev.id }), kind: "cast", name, data: { g: c.g, ...(src && { gs: src.sp, gv: src.ver }), who: c.who, bits: c.bits.slice(0, 50) } } });
  }
  toast(`The cast is in ${spaces.data[id]?.name}.`);
}
function takeCast(id, itemId) {
  const it = spaces.data[id]?.items.find((x) => x.id === itemId);
  const d = it?.data;
  if (!d || d.g !== G.id || !G.pronouns || !validPhrase(G.pronouns, d.who, 0)) { toast("That character is from another grammar. Switch to it first."); return; }
  const entry = { g: d.g, who: clone(d.who), bits: (Array.isArray(d.bits) ? d.bits : []).filter((b) => typeof b === "string").map((b) => cleanWord(b).slice(0, 300)) };
  const c = cast.find((x) => castKey(x) === castKey(entry));
  if (c) c.bits = [...new Set([...c.bits, ...entry.bits])];
  else cast.unshift(entry);
  saveCast();
  renderCast();
  toast("They're in your cast now.");
}

// ---------- lore: kept phrases ----------
// Where a kept phrase goes: the jam's space if you're in one, else the space you have open (if
// you can edit it).
function loreTarget() {
  if (state.room?.spaceCtx) return jamCan("comment") ? { jam: true, name: state.room.spaceCtx.name } : null;
  const s = activeSpace();
  return s && spaceCan(s.id, "edit") ? { id: s.id, name: s.name } : null;
}
// The lore in reach: the jam's space, or the space you have open.
const currentLore = () => (state.room?.spaceCtx?.lore || activeSpace()?.lore || []).filter((l) => l && typeof l.text === "string");
async function keepLore(slot) {
  const t = loreTarget();
  if (!t || !state.pick[slot]) return;
  const entry = { text: phraseText(slot), card: slot, label: SLOTS.find((c) => c.key === slot)?.label || slot, g: G.id, ph: clone(state.pick[slot]) };
  if (t.jam) roomSend({ t: "lore", entry });
  else if (!(await spaceOp(t.id, "lore", { entry }))) return;
  toast(`Kept “${entry.text}” as ${t.name}'s lore. Use it again and it's a callback.`);
}
function useLore(l) {
  if (!l.ph || l.g !== G.id || !SCHEMAS[l.card] || !validPhrase(l.card, l.ph, 0)) { toast(`“${l.text}” is from another grammar; type it in as your own words instead.`); return; }
  if (state.room && jamReadOnly()) { toast("You're not an editor in this jam."); return; }
  if (!stanza().slots.includes(l.card)) { toast("That card isn't in this stanza. Make the piece longer."); return; }
  state.pick[l.card] = clone(l.ph);
  state.pins = state.pins.filter((p) => !p.startsWith(l.card + "|")).concat(Object.keys(l.ph.w).map((k) => `${l.card}|${k}`));
  state.sel = null;
  render();
}
// Callbacks: kept phrases a copy uses that its start didn't. Text match, so it survives versions.
const plainText = (html) => html.replace(/<[^>]*>/g, " ").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").toLowerCase();
function callbacksIn(copyHtml, startHtml) {
  const copyT = plainText(copyHtml), startT = plainText(startHtml);
  return currentLore().filter((l) => { const t = l.text.toLowerCase(); return copyT.includes(t) && !startT.includes(t); });
}

// ---------- comments, settings, export ----------
const commentsOn = (s, itemId) => s.comments.filter((c) => c.item === itemId);
async function setRetain(id, value) {
  if (value !== "keep" && !confirm(`Keep “${spaces.data[id].name}” ${SPACE_RETAIN_NAMES[value]}? If nobody opens it for that long, it and everything in it are deleted for everyone. Export a copy if you want one either way.`)) { renderSpaces(); return; }
  await spaceOp(id, "settings", { retain: value });
}
async function setPublic(id, on) {
  if (on && !confirm(`Make “${spaces.data[id].name}” public? Anyone with its id can then view everything in it (not change it). Remove anything you don't want seen first.`)) { renderSpaces(); return; }
  if (await spaceOp(id, "settings", { public: on })) toast(on ? "Public. Its view link is short, and so are links to pieces made with its grammars." : "Private again. Only people with an invite link can open it.");
}
async function deleteSpace(id) {
  const s = spaces.data[id];
  if (!confirm(`Delete “${s.name}” for everyone, now: its grammars, pieces, words, cast, lore, comments and jam history? This can't be undone. Export a copy first if you want one.`)) return;
  const out = await spaceOp(id, "delete");
  if (!out?.deleted) return;
  spaces.list = spaces.list.filter((x) => x.id !== id);
  delete spaces.data[id];
  spaces.active = spaces.list[0]?.id || null;
  saveMySpaces();
  toast("Deleted.");
  renderSpaces();
  renderLibrary();
}
async function exportSpace(id) {
  const out = await spaceOp(id, "export");
  if (!out?.dump) return;
  const file = { storyBitsSpace: 1, exported: new Date().toISOString(), ...out.dump };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 1)], { type: "application/json" }));
  a.download = `story-bits-space-${slugify(out.dump.name || id)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Saved the whole space, every grammar version included, to a file.");
}
// A new space from an exported file: grammars version by version (so pieces' pins still hold),
// then words, pieces, cast and lore. Comments and jam history belong to the old space.
async function importSpace(file) {
  let dump;
  try { dump = JSON.parse(await file.text()); } catch { toast("That file isn't a Story Bits space."); return; }
  if (!dump?.storyBitsSpace || !Array.isArray(dump.items)) { toast("That file isn't a Story Bits space."); return; }
  const v = await createSpace(`${cleanWord(dump.name) || "A space"}`);
  if (!v) return;
  const old = SPACE_ID.test(dump.id) ? dump.id : null;
  const repin = (data) => (old && data?.gs === old ? { ...data, gs: v.id } : data);
  let skipped = 0;
  for (const it of dump.items) {
    if (it?.kind === "grammar") {
      const vers = dump.versions?.[it.gid] || {};
      for (let n = 1; n <= it.head; n++) {
        if (!vers[n] || checkGrammar(vers[n]) || vers[n].id !== it.gid) { skipped += it.head - n + 1; break; }
        if (!(await spaceOp(v.id, "put", { item: { kind: "grammar", base: n - 1, data: vers[n] } }))) { skipped++; break; }
      }
    } else if (["words", "piece", "cast"].includes(it?.kind)) {
      if (!(await spaceOp(v.id, "put", { item: { kind: it.kind, name: it.name, data: repin(it.data) } }))) skipped++;
    }
  }
  for (const l of Array.isArray(dump.lore) ? dump.lore : []) await spaceOp(v.id, "lore", { entry: l });
  toast(`Made “${v.name}” from the file${skipped ? ` (${skipped} thing${skipped === 1 ? "" : "s"} didn't check out)` : ""}.`);
}

// ---------- links ----------
const spaceInvite = (id, role) => {
  const keys = spaces.data[id]?.keys;
  return `${location.origin}${location.pathname}#space=${id}~${keys?.[role] || ""}`;
};
const publicLink = (id, what = "") => `${location.origin}${location.pathname}#sp=${id}${what ? `/${what}` : ""}`;
// A grammar's link: short if it's in a public space, else the whole grammar.
function spaceGrammarLink(id, gid) {
  const s = spaces.data[id];
  const it = spaceGrammar(id, gid);
  return s.public ? publicLink(id, gid) : grammarLink(it.data);
}
// "#space=ID~key" (an invite) or "#sp=ID", "#sp=ID/gid", "#sp=ID/i12" (public).
async function receiveSpace(kind, data) {
  const [id, rest = ""] = kind === "space" ? data.split("~") : data.split("/");
  if (!SPACE_ID.test(id)) return false;
  const k = kind === "space" ? rest : spaces.list.find((s) => s.id === id)?.k || "";
  try {
    const v = await loadSpace(id, k);
    if (!spaces.list.some((s) => s.id === id)) spaces.visiting = { id, k, name: v.name, role: v.role, public: v.public, retain: v.retain, expiresAt: v.expiresAt };
    else if (kind === "space" && k) { const mine = spaces.list.find((s) => s.id === id); if (SPACE_ROLE_RANK[v.role] > SPACE_ROLE_RANK[mine.role] || !mine.k) Object.assign(mine, { k, role: v.role }); saveMySpaces(); }
    spaces.active = id;
    if (kind === "sp" && rest) {
      if (/^i\d+$/.test(rest)) { await openPiece(id, rest); }
      else if (spaceGrammar(id, rest)) { useSpaceGrammar(id, rest); toast(`Using “${spaceGrammar(id, rest).data.name}” from ${v.name}. Fork it to keep a copy.`); }
    }
    return true;
  } catch (e) { toast(e.message); return false; }
}

// ---------- the library: local and space grammars side by side ----------
function spaceLibraryHtml() {
  const cols = [];
  for (const s of [...spaces.list, ...(spaces.visiting ? [spaces.visiting] : [])]) {
    const v = spaces.data[s.id];
    if (!v) continue;
    const gs = v.items.filter((it) => it.kind === "grammar");
    const cards = gs.map((it) => {
      const g = it.data;
      const using = srcOf.get(G)?.sp === s.id && G.id === it.gid;
      return `<article class="gram space-gram${using ? " active" : ""}">
        <header><h3>${esc(g.name)}</h3><span class="count">v${it.head}</span></header>
        <p class="gram-desc">${esc(g.description || "")}</p>
        <p class="gram-meta">${g.cards.map((c) => esc(c.label)).join(" · ")} — ${Object.keys(g.forms).length} form${Object.keys(g.forms).length === 1 ? "" : "s"}${it.by ? ` · by ${esc(it.by)}` : ""}</p>
        <div class="person-actions">
          ${using ? `<span class="crown">in use${srcOf.get(G).ver !== it.head ? ` (v${srcOf.get(G).ver})` : ""}</span>` : `<button class="ghost" data-sp-use="${esc(it.gid)}" data-sp="${s.id}">Use</button>`}
          <button class="ghost" data-sp-fork="${esc(it.gid)}" data-sp="${s.id}">Fork to mine</button>
          <button class="ghost" data-sp-glink="${esc(it.gid)}" data-sp="${s.id}">${v.public ? "Copy short link" : "Copy link"}</button>
        </div>
      </article>`;
    }).join("");
    cols.push(`<div class="lib-col"><h3 class="lib-col-h"><span class="dial-label">${v.public ? "Public space" : "Space"}</span> ${esc(v.name)}</h3>${cards || `<p class="empty">No grammars here yet.${spaceCan(s.id, "edit") ? " Publish one of yours." : ""}</p>`}</div>`);
  }
  return cols.join("");
}
// On one of your grammars: publish it to a space you can edit.
function publishControlHtml(g) {
  const targets = spaces.list.filter((s) => spaces.data[s.id] && spaceCan(s.id, "edit"));
  if (!targets.length) return "";
  const up = upstreamOf(g);
  const pick = targets.find((s) => s.id === spaces.target[g.id]) || targets.find((s) => s.id === up?.sp) || targets[0];
  const head = up && spaceGrammar(up.sp, up.gid)?.head;
  return `<div class="lib-publish">
    <select data-sp-target="${esc(g.id)}" aria-label="Space to publish to">${targets.map((s) => `<option value="${s.id}" ${s.id === pick.id ? "selected" : ""}>${esc(spaces.data[s.id].name)}</option>`).join("")}</select>
    ${up && up.sp === pick.id && head ? `<button class="ghost" data-sp-publish="${esc(g.id)}" data-as-version="1" title="Forked from version ${up.ver}">Publish as v${head + 1}</button>` : ""}
    <button class="ghost" data-sp-publish="${esc(g.id)}">${up && up.sp === pick.id ? "Publish as new" : "Publish ↑"}</button>
  </div>`;
}

// ---------- the Spaces section ----------
const when = (ts) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
function expiryHtml(v) {
  if (!v.expiresAt) return `<span class="sp-keep">Kept until the owner deletes it.</span>`;
  const days = Math.ceil((v.expiresAt - Date.now()) / 864e5);
  const soon = days <= (v.retain === "30d" ? 10 : 30);
  return `<span class="sp-keep${soon ? " soon" : ""}">${soon ? "⚠ " : ""}Deleted ${when(v.expiresAt)} (in ${days} day${days === 1 ? "" : "s"}) unless someone opens it.</span>`;
}
function itemHtml(s, it) {
  const v = s;
  const can = (r) => spaceCan(v.id, r);
  const notes = commentsOn(v, it.id);
  const open = spaces.open === it.id;
  let body = "", acts = "";
  if (it.kind === "piece") {
    const ref = refOf(it.data);
    const gi = ref && v.items.find((x) => x.kind === "grammar" && x.gid === it.data.g);
    const gname = gi?.data.name || (GRAMMARS[it.data.g]?.name) || it.data.gx?.name || it.data.g;
    body = `<p class="sp-sub">${esc(gname || "")}${ref ? ` v${ref.gv}` : ""}${it.by ? ` · kept by ${esc(it.by)}` : ""}</p>`;
    acts = `<button class="ghost" data-sp-open="${esc(it.id)}">Open</button>${gi && ref.gv !== gi.head ? `<button class="ghost" data-sp-open="${esc(it.id)}" data-to="${gi.head}">Open in v${gi.head}</button>` : ""}${v.public ? `<button class="ghost" data-sp-plink="${esc(it.id)}">Copy link</button>` : ""}`;
  } else if (it.kind === "grammar") {
    body = `<p class="sp-sub">v${it.head}${it.by ? ` · by ${esc(cleanWord(it.by))}` : ""}${it.updated ? ` · ${when(it.updated)}` : ""}</p>`;
  } else if (it.kind === "words") {
    const ws = Array.isArray(it.data.words) ? it.data.words.filter((e) => e && typeof e.t === "string") : [];
    body = `<p class="sp-words">${ws.slice(0, 12).map((e) => `<span>${esc(cleanWord(e.t))}</span>`).join("")}${ws.length > 12 ? ` <span>+${ws.length - 12}</span>` : ""}</p>`;
    acts = `<button class="ghost" data-sp-takewords="${esc(it.id)}">Add to my bank</button>`;
  } else if (it.kind === "cast") {
    const bits = Array.isArray(it.data.bits) ? it.data.bits.filter((b) => typeof b === "string") : [];
    body = `<ul class="sp-bits">${bits.slice(0, 4).map((b) => `<li>${esc(cleanWord(b))}</li>`).join("")}</ul>`;
    acts = `<button class="ghost" data-sp-takecast="${esc(it.id)}">Add to my cast</button>`;
  }
  return `<li class="sp-item">
    <div class="sp-item-top"><b>${esc(cleanWord(it.name))}</b>
      <span class="sp-acts">${acts}<button class="ghost" data-sp-notes="${esc(it.id)}" aria-expanded="${open}">💬 ${notes.length}</button>${can("edit") ? `<button class="bw-x" data-sp-remove="${esc(it.id)}" aria-label="Remove ${esc(cleanWord(it.name))}">✕</button>` : ""}</span></div>
    ${body}
    ${open ? `<div class="jam-notes">${notes.map((c) => `<div class="note"><p><b>${esc(cleanWord(c.name) || "someone")}</b> ${esc(cleanWord(c.text))}</p>${c.mine || can("edit") ? `<div class="note-actions"><button data-sp-uncomment="${esc(c.id)}">Delete</button></div>` : ""}</div>`).join("")}
      ${can("comment") ? `<form class="jam-note-form" data-sp-comment="${esc(it.id)}" autocomplete="off"><input name="note" maxlength="600" placeholder="A note on this" aria-label="Comment"><button type="submit">Comment</button></form>` : ""}</div>` : ""}
  </li>`;
}
function renderSpaces() {
  const el = $("#spaces-body");
  if (!el) return;
  const all = [...spaces.list, ...(spaces.visiting ? [spaces.visiting] : [])];
  const tabs = all.length ? `<div class="lib-tabs sp-tabs" role="tablist">${all.map((s) => `<button role="tab" aria-selected="${s.id === spaces.active}" data-sp-tab="${s.id}">${esc(spaces.data[s.id]?.name || s.name || s.id)}${spaces.gone[s.id] ? " (gone)" : ""}${s === spaces.visiting ? " (visiting)" : ""}</button>`).join("")}<button role="tab" aria-selected="${!spaces.active}" data-sp-tab="">+ New</button></div>` : "";
  const v = activeSpace();
  let body;
  if (!spaces.active || !all.some((s) => s.id === spaces.active)) {
    body = `<form class="lib-add sp-new" data-sp-create autocomplete="off">
        <input name="name" maxlength="60" placeholder="Name a space (Thursday group, the poem club)" aria-label="Space name">
        <button class="primary">Create a space</button>
      </form>
      <p class="help">A space is kept until you delete it. Make it public later to publish what's in it.</p>
      <div class="cp-row"><label class="ghost sp-file">Make one from an exported file<input type="file" accept=".json,application/json" data-sp-import hidden></label></div>`;
  } else if (spaces.gone[spaces.active]) {
    body = `<p class="empty">${esc(spaces.gone[spaces.active])}</p><div class="cp-row"><button class="ghost subtle" data-sp-leave="${spaces.active}">Forget it here</button></div>`;
  } else if (!v) {
    body = `<p class="rb-phase">Opening…</p>`;
  } else {
    const can = (r) => spaceCan(v.id, r);
    const of = (k) => v.items.filter((it) => it.kind === k);
    const visiting = spaces.visiting?.id === v.id;
    const list = (k, title, empty, add) => `<h4 class="dial-label">${title} <span class="count">${of(k).length}</span></h4>
      ${of(k).length ? `<ul class="sp-items">${of(k).map((it) => itemHtml(v, it)).join("")}</ul>` : `<p class="empty">${empty}</p>`}${can("edit") && add ? `<div class="cp-row">${add}</div>` : ""}`;
    const lore = v.lore.length ? `<ul class="sp-lore">${v.lore.map((l) => `<li><button class="sp-lore-use" data-sp-lore="${esc(l.id)}" title="Use this phrase${l.label ? ` as the ${esc(l.label.toLowerCase())}` : ""}">“${esc(cleanWord(l.text))}”</button><span class="sp-sub">${esc(cleanWord(l.label || ""))}${l.by ? ` · ${esc(cleanWord(l.by))}` : ""}${l.jam ? ` · jam ${esc(l.jam)}` : ""}</span>${can("edit") ? `<button class="bw-x" data-sp-unlore="${esc(l.id)}" aria-label="Forget this phrase">✕</button>` : ""}</li>`).join("")}</ul>` : `<p class="empty">No lore yet. Tap a word, then <i>Keep as lore</i>, to keep the phrase it's in; reusing one later is a callback.</p>`;
    const jams = v.jams.length ? `<ol class="sp-jams">${v.jams.slice().reverse().map((j) => `<li>${j.code ? `Jam <b>${esc(j.code)}</b>` : "A jam"} · ${when(j.at)}${Array.isArray(j.rounds) && j.rounds.length ? ` · ${j.rounds.length} round${j.rounds.length === 1 ? "" : "s"}${j.rounds.filter((r) => r.top?.length).slice(-1).map((r) => `, last won by ${esc(r.top.map(cleanWord).join(" & "))}`).join("")}` : ""}</li>`).join("")}</ol>` : `<p class="empty">No jams here yet.</p>`;
    const invites = v.keys ? `<div class="rb-invites"><span class="dial-label">Invite</span>
        <button class="ghost" data-sp-invite="edit">Edit link</button><button class="ghost" data-sp-invite="comment">Comment link</button><button class="ghost" data-sp-invite="view">View link</button>${v.public ? `<button class="ghost" data-sp-invite="public">Public link</button>` : ""}${v.role === "owner" ? `<button class="ghost subtle" data-sp-invite="owner" title="Keep this somewhere safe: it's how you manage the space from another browser">Owner link</button>` : ""}</div>` : v.public ? `<div class="rb-invites"><button class="ghost" data-sp-invite="public">Copy public link</button></div>` : "";
    body = `${visiting ? `<div class="lib-incoming"><p><b>You're visiting “${esc(v.name)}”${v.role !== "view" ? ` as ${v.role === "owner" ? "its owner" : `a${v.role === "edit" ? "n editor" : " commenter"}`}` : ""}.</b> Add it to your spaces to keep its link in this browser.</p><div class="cp-row"><button class="primary" data-sp-join>Add to my spaces</button></div></div>` : ""}
      <div class="sp-head">
        <div><span class="eyebrow">${v.public ? "Public space" : "Private space"} · you're ${v.role === "owner" ? "the owner" : v.role === "edit" ? "an editor" : v.role === "comment" ? "a commenter" : "a viewer"}</span><span class="rb-code">${esc(v.id)}</span></div>
        <div class="rb-actions">${can("edit") ? `<button class="ghost live-btn" data-sp-jam>Start a jam here</button>` : ""}<button class="ghost subtle" data-sp-refresh>Refresh</button></div>
      </div>
      <p class="sp-meta">${expiryHtml(v)}${v.dropped ? ` ${v.dropped} item${v.dropped === 1 ? "" : "s"} didn't check out and are hidden.` : ""}</p>
      ${invites}
      ${list("grammar", "Grammars", "No grammars yet. Publish one of yours from the Grammars list above.", "")}
      ${of("grammar").length ? `<p class="bf-hint">Use, fork and share these from the Grammars list above, beside yours.</p>` : ""}
      ${list("piece", "Kept pieces", "No pieces kept here yet.", `<button class="ghost" data-sp-keep>Keep this piece here</button>`)}
      ${list("words", "Word packs", "No word packs yet.", `<button class="ghost" data-sp-putwords>Put my ${esc(G.name)} words here</button>`)}
      ${G.pronouns || of("cast").length ? list("cast", "Cast", "No characters yet.", G.pronouns ? `<button class="ghost" data-sp-putcast>Put my cast here</button>` : "") : ""}
      <h4 class="dial-label">Lore <span class="count">${v.lore.length}</span></h4>${lore}
      <h4 class="dial-label">Jams</h4>${jams}
      ${v.role === "owner" ? `<div class="rb-keep sp-settings">
        <label class="bf-field"><span class="dial-label">Name</span><input data-sp-name value="${esc(v.name)}" maxlength="60"></label>
        <label class="lib-check"><input type="checkbox" data-sp-public ${v.public ? "checked" : ""}> Public: anyone with its id can view it</label>
        <label class="bf-field"><span class="dial-label">Keep this space</span><select data-sp-retain>${Object.entries(SPACE_RETAIN_NAMES).map(([k, t]) => `<option value="${k}" ${v.retain === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <button class="ghost subtle" data-sp-delete>Delete this space</button>
      </div>` : ""}
      <div class="cp-row">${can("edit") ? `<button class="ghost" data-sp-export>Export to a file</button>` : ""}${visiting ? "" : `<button class="ghost subtle" data-sp-leave="${v.id}">Forget it in this browser</button>`}</div>
      <p class="rb-fine">This space keeps its grammars (every version), pieces, words, cast, lore, comments (nicknames only) and a summary of its jams, on the room server. ${v.retain === "keep" ? "It's kept until the owner deletes it" : `It's kept ${SPACE_RETAIN_NAMES[v.retain]}`}; the owner can delete it any time.</p>`;
  }
  el.innerHTML = tabs + body;
}

// ---------- events ----------
document.addEventListener("click", (e) => {
  if (!(e.target instanceof Element)) return;
  const t = e.target.closest("button");
  if (!t) return;
  const d = t.dataset;
  const id = d.sp || spaces.active;
  if (d.spUse) useSpaceGrammar(id, d.spUse);
  else if (d.spFork) forkFromSpace(id, d.spFork);
  else if (d.spGlink) copy(spaceGrammarLink(id, d.spGlink), spaces.data[id].public ? "Short link copied. It opens this version of the grammar." : "Link copied (the whole grammar: this space is private).");
  else if (d.spPublish) publishGrammar(d.spPublish, document.querySelector(`[data-sp-target="${CSS.escape(d.spPublish)}"]`)?.value, !!d.asVersion);
  else if (d.spTab !== undefined) { spaces.active = d.spTab || null; renderSpaces(); if (spaces.active && !spaces.gone[spaces.active]) refreshSpace(spaces.active); }
  else if (d.spJoin !== undefined) joinVisiting();
  else if (d.spRefresh !== undefined) refreshSpace(id);
  else if (d.spLeave) leaveSpace(d.spLeave);
  else if (d.spInvite) {
    const v = spaces.data[id];
    const what = { edit: "Anyone with it can add and change things here.", comment: "Anyone with it can read and comment.", view: "Anyone with it can read.", owner: "This is the owner's link. Keep it private: it can delete the space.", public: "Anyone with it can view this space." }[d.spInvite];
    copy(d.spInvite === "public" ? publicLink(v.id) : spaceInvite(v.id, d.spInvite), `${cap(d.spInvite)} link copied. ${what}`);
  }
  else if (d.spKeep !== undefined) keepPiece(id);
  else if (d.spOpen) openPiece(id, d.spOpen, d.to ? +d.to : undefined);
  else if (d.spPlink) copy(publicLink(id, d.spPlink), "Link copied. It opens this piece from the public space.");
  else if (d.spPutwords !== undefined) putWords(id);
  else if (d.spTakewords) takeWords(id, d.spTakewords);
  else if (d.spPutcast !== undefined) putCast(id);
  else if (d.spTakecast) takeCast(id, d.spTakecast);
  else if (d.spRemove) { const it = spaces.data[id]?.items.find((x) => x.id === d.spRemove); if (it && confirm(`Remove “${cleanWord(it.name)}” from ${spaces.data[id].name}${it.kind === "grammar" ? ", with every version" : ""}? Its comments go too.`)) spaceOp(id, "remove", { id: d.spRemove }); }
  else if (d.spNotes) { spaces.open = spaces.open === d.spNotes ? null : d.spNotes; renderSpaces(); }
  else if (d.spUncomment) spaceOp(id, "uncomment", { id: d.spUncomment });
  else if (d.spLore) { const l = currentLore().find((x) => x.id === d.spLore); if (l) useLore(l); }
  else if (d.spUnlore) spaceOp(id, "unlore", { id: d.spUnlore });
  else if (d.spDelete !== undefined) deleteSpace(id);
  else if (d.spExport !== undefined) exportSpace(id);
  else if (d.spJam !== undefined) {
    const k = spaceEntry(id)?.k;
    openRoom(newRoomCode());
    state.room.pendingSpace = { id, k };
  }
  else if (d.act === "lore" && state.sel && !state.sel.beat) keepLore(state.sel.slot);
});
document.addEventListener("submit", (e) => {
  const f = e.target;
  if (!(f instanceof HTMLFormElement)) return;
  if (f.dataset.spCreate !== undefined) { e.preventDefault(); e.stopImmediatePropagation(); createSpace(f.elements.name.value); }
  else if (f.dataset.spComment) {
    e.preventDefault();
    e.stopImmediatePropagation();
    const text = cleanWord(f.elements.note.value);
    if (text) spaceOp(spaces.active, "comment", { item: f.dataset.spComment, text });
  }
}, true);
document.addEventListener("change", (e) => {
  const el = e.target;
  if (!(el instanceof Element)) return;
  const id = spaces.active;
  if (el.matches("[data-sp-retain]")) setRetain(id, el.value);
  else if (el.matches("[data-sp-public]")) setPublic(id, el.checked);
  else if (el.matches("[data-sp-name]")) spaceOp(id, "settings", { name: el.value });
  else if (el.matches("[data-sp-target]")) { spaces.target[el.dataset.spTarget] = el.value; renderLibrary(); }
  else if (el.matches("[data-sp-import]") && el.files?.[0]) importSpace(el.files[0]);
});
