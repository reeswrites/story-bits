// End-to-end check of spaces against a running server (same hosts as rooms.test.mjs).
//
// Covers: create (owner keys, kept until deleted by default); roles from keys (owner, edit,
// comment, view, none); private spaces refuse keyless reads; grammars as immutable versions
// (publish, stale base refused, old versions still readable); word packs, pieces, cast; comments
// (yours, or an editor's to delete); lore; owner-only settings (name, public, retention) and
// known retention values only; public spaces readable by id alone; remove; export with every
// version; a jam linked to a space (needs an edit key; relays context; lore from the jam; rounds
// into the space's jam history); delete, and a deleted id is never reused; origin check.
import assert from "node:assert/strict";

const HOST = process.env.ROOMS_HOST || "localhost:8799";
const local = /^(localhost|127\.0\.0\.1)/.test(HOST);
const http = `${local ? "http" : "https"}://${HOST}`;
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newId = (n = 8) => Array.from({ length: n }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");
const ORIGIN = "http://localhost:4290";

const id = newId();
const url = `${http}/parties/story-space/${id}`;
async function call(body, origin = ORIGIN) {
  const res = await fetch(url, { method: "POST", headers: { Origin: origin, "content-type": "text/plain" }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => null), cors: res.headers.get("access-control-allow-origin") };
}
async function get(q = "", origin = ORIGIN) {
  const res = await fetch(`${url}${q}`, { headers: { Origin: origin } });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// A tiny grammar: the space never interprets it, but keep it realistic.
const gram = (name, words) => ({ id: "tiny-poem", name, maxDepth: 0, cards: [{ key: "image", label: "Image" }], schemas: { image: { parts: [{ k: "n", name: "image", pool: words.map((t) => ({ t, tier: 0 })) }] } }, line: "{image}.", rules: { landing: false, pairs: [], dialLabels: ["a", "b", "c"], dialNotes: ["a", "b", "c"] }, forms: { one: { name: "One", beats: {}, stanzas: [{ name: "Line", slots: ["image"], paras: [] }] } } });

// Create: the creator gets every key; kept until deleted by default.
let r = await call({ op: "create", name: "Thursday <b>group</b>" });
assert.equal(r.status, 201, JSON.stringify(r.body));
assert.equal(r.cors, ORIGIN);
const sp = r.body.space;
assert.equal(sp.name, "Thursday group", "names are cleaned");
assert.equal(sp.retain, "keep", "spaces are kept until deleted by default");
assert.equal(sp.expiresAt, null);
assert.equal(sp.role, "owner");
const { owner, edit, comment, view } = sp.keys;
assert.ok(owner && edit && comment && view);
assert.equal((await call({ op: "create", name: "again" })).status, 409, "an id can't be created twice");

// Private: no key, no read. Roles from keys.
assert.equal((await get()).status, 403, "a private space needs a key to view");
assert.equal((await call({ op: "get" })).status, 403);
assert.equal((await get(`?k=${view}`)).body.space.role, "view");
assert.equal((await get(`?k=${view}`)).body.space.keys, null, "viewers see no keys");
const ed = (await get(`?k=${edit}`)).body.space;
assert.equal(ed.role, "edit");
assert.equal(ed.keys.owner, undefined, "editors never see the owner key");

// Grammars are versions: publish v1, then v2 from v1; a stale base is refused.
r = await call({ op: "put", k: edit, name: "Ana", item: { kind: "grammar", base: 0, data: gram("Tiny", ["moth", "lamp"]) } });
assert.equal(r.status, 200, JSON.stringify(r.body));
let g = r.body.space.items.find((x) => x.kind === "grammar");
assert.equal(g.head, 1);
assert.equal(g.data.name, "Tiny", "a grammar comes with its head version");
r = await call({ op: "put", k: edit, item: { kind: "grammar", base: 1, data: gram("Tiny", ["lamp"]) } });
assert.equal(r.body.space.items.find((x) => x.kind === "grammar").head, 2);
r = await call({ op: "put", k: edit, item: { kind: "grammar", base: 1, data: gram("Tiny", ["stale"]) } });
assert.equal(r.status, 409, "publishing from an old version is refused, not overwritten");
assert.equal((await call({ op: "put", k: comment, item: { kind: "grammar", base: 2, data: gram("Tiny", ["x"]) } })).status, 403, "commenters can't publish");
assert.equal((await call({ op: "put", k: edit, item: { kind: "grammar", base: 0, data: { ...gram("Bad", ["x"]), id: "Not A Slug" } } })).status, 400);
const v1 = await get(`?k=${view}&gv=tiny-poem@1`);
assert.deepEqual(v1.body.doc.schemas.image.parts[0].pool.map((w) => w.t), ["moth", "lamp"], "old versions never change");
assert.equal((await get(`?k=${view}&gv=tiny-poem@9`)).status, 404);

// Word packs, pieces (pinned to a version), cast; an item keeps its kind.
r = await call({ op: "put", k: edit, name: "Ben", item: { kind: "words", name: "Moths", data: { g: "tiny-poem", words: [{ g: "tiny-poem", s: "image", k: "n", t: "moth wing", tier: 1 }] } } });
const words = r.body.space.items.find((x) => x.kind === "words");
assert.equal(words.by, "Ben");
r = await call({ op: "put", k: edit, item: { kind: "piece", name: "lamp.", data: { v: 4, g: "tiny-poem", gs: id, gv: 1, f: "one", p: { image: { w: { n: 1 } } }, d: 0, s: 1, l: 1, b: {} } } });
const piece = r.body.space.items.find((x) => x.kind === "piece");
assert.equal(piece.data.gv, 1);
r = await call({ op: "put", k: edit, item: { id: piece.id, kind: "cast", name: "x", data: {} } });
assert.equal(r.status, 400, "an item keeps its kind");
r = await call({ op: "put", k: edit, item: { kind: "cast", name: "your uncle", data: { g: "story-bits", who: { w: { n: 3 } }, bits: ["your uncle got a boating license"] } } });
assert.ok(r.body.space.items.some((x) => x.kind === "cast"));

// Comments: commenters may; viewers may not; your own or an editor's to delete.
assert.equal((await call({ op: "comment", k: view, item: piece.id, text: "no" })).status, 403);
r = await call({ op: "comment", k: comment, pid: "pid-commenter-1", name: "Cy", item: piece.id, text: "this <i>lamp</i> line" });
let c = r.body.space.comments[0];
assert.equal(c.text, "this lamp line");
assert.equal(c.mine, true);
assert.equal(c.pid, undefined, "comment authors aren't exposed");
assert.equal((await call({ op: "uncomment", k: comment, pid: "pid-someone-2", id: c.id })).status, 403, "not yours");
r = await call({ op: "uncomment", k: edit, id: c.id });
assert.equal(r.body.space.comments.length, 0, "editors can delete any comment");

// Lore: kept phrases, no duplicates.
r = await call({ op: "lore", k: edit, name: "Ana", entry: { text: "your uncle", card: "who", label: "Who", g: "story-bits", ph: { w: { n: 3 } } } });
await call({ op: "lore", k: edit, entry: { text: "Your Uncle", card: "who" } });
assert.equal((await get(`?k=${view}`)).body.space.lore.length, 1);
assert.equal((await call({ op: "lore", k: comment, entry: { text: "nope" } })).status, 403);

// Settings are the owner's; retention values are known ones only.
assert.equal((await call({ op: "settings", k: edit, public: true })).status, 403);
assert.equal((await call({ op: "settings", k: owner, retain: "forever-and-ever" })).status, 400);
r = await call({ op: "settings", k: owner, retain: "30d", name: "Thursdays" });
assert.equal(r.body.space.retain, "30d");
assert.ok(r.body.space.expiresAt > Date.now() + 29 * 864e5, "a time-based space shows when it would go");
r = await call({ op: "settings", k: owner, retain: "keep", public: true });
assert.equal(r.body.space.expiresAt, null);

// Public: readable by id alone, view only.
const pub = await get();
assert.equal(pub.status, 200);
assert.equal(pub.body.space.role, "view");
assert.equal(pub.body.space.keys, null);
assert.equal((await get("?gv=tiny-poem@2")).body.ver, 2, "public versions by id alone");
assert.equal((await call({ op: "put", item: { kind: "words", name: "spam", data: {} } })).status, 403, "public is view only");

// Remove: an editor (or the owner) takes an item down; its comments go with it.
await call({ op: "comment", k: comment, item: words.id, text: "nice" });
r = await call({ op: "remove", k: owner, id: words.id });
assert.ok(!r.body.space.items.some((x) => x.id === words.id));
assert.ok(!r.body.space.comments.some((x) => x.item === words.id));

// Export: everything, every version.
r = await call({ op: "export", k: edit });
assert.deepEqual(Object.keys(r.body.dump.versions["tiny-poem"]), ["1", "2"]);
assert.equal(r.body.dump.keys, undefined, "exports carry no keys");
assert.equal((await call({ op: "export", k: comment })).status, 403);

// A jam in the space: the host links it with an edit key; everyone in the jam gets the context.
const wsBase = `${local ? "ws" : "wss"}://${HOST}/parties/story-room/`;
const code = "S" + newId(5);
function player(pid, key = "") {
  const ws = new WebSocket(`${wsBase}${code}${key ? `?k=${key}` : ""}`, { headers: { Origin: ORIGIN } });
  const p = { pid, ws, last: null, ctx: undefined, errors: [], waiters: [] };
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.t === "state") { p.last = m.room; p.you = m.you; }
    if (m.t === "space") p.ctx = m.ctx;
    if (m.t === "error") p.errors.push(m.error);
    p.waiters = p.waiters.filter((w) => !w(m));
  });
  p.open = new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
  p.send = (m) => ws.send(JSON.stringify(m));
  p.until = (pred, ms = 6000) => new Promise((res, rej) => {
    if (pred(p)) return res(p);
    const t = setTimeout(() => rej(new Error(`timeout waiting on ${pred}`)), ms);
    p.waiters.push(() => pred(p) && (clearTimeout(t), res(p), true));
  });
  return p;
}
const host = player("player-host-0001");
await host.open;
await host.until((p) => p.last?.keys, 15000);
host.send({ t: "hello", pid: host.pid, name: "Ana" });
await host.until((p) => p.you?.pid && p.last.host === p.you.pid);
const guest = player("player-guest-002", host.last.keys.comment);
await guest.open;
guest.send({ t: "hello", pid: guest.pid, name: "Cy" });
await host.until((p) => p.last.players.length === 2);

host.send({ t: "space", id, k: comment });
await host.until((p) => p.errors.length === 1);
assert.equal(host.last.space, null, "linking needs the space's edit key");
host.send({ t: "space", id, k: edit });
await guest.until((p) => p.ctx?.id === id && p.last?.space?.id === id);
assert.equal(guest.ctx.name, "Thursdays");
assert.equal(guest.ctx.grammars[0].ver, 2);
assert.equal(guest.ctx.lore.length, 1);
assert.ok(!JSON.stringify(guest.last).includes(edit), "the jam never passes on the space's keys");

// Lore kept in the jam lands in the space.
guest.send({ t: "lore", entry: { text: "the lighthouse keeper", card: "who", label: "Who" } });
await host.until((p) => p.ctx?.lore?.length === 2);
const lore = (await get(`?k=${comment}`)).body.space.lore;
assert.equal(lore[1].jam, code);
assert.equal((await get()).body.space.lore[1].jam, undefined, "public viewers aren't sent jam codes");
assert.equal(host.ctx.lore[1].jam, undefined, "nor is anyone in a jam");
assert.equal(lore[1].by, "Cy");

// A finished workshop round goes into the space's jam history.
host.send({ t: "mode", mode: "workshop" });
await host.until((p) => p.last.mode === "workshop");
host.send({ t: "start", c: { h: "Ana", n: 0, s: { fake: 1 } } });
await host.until((p) => p.last.phase === "play");
host.send({ t: "submit", me: { who: "a" } });
await host.until((p) => p.last.players.some((x) => x.submitted));
host.send({ t: "vote" });
await host.until((p) => p.last.phase === "vote");
host.send({ t: "end" });
await host.until((p) => p.last.phase === "results");
await new Promise((res) => setTimeout(res, 300));
const jams = (await get(`?k=${comment}`)).body.space.jams;
assert.equal(jams[0].code, code);
assert.equal((await get()).body.space.jams[0].code, undefined, "public viewers aren't sent jam codes");
assert.equal(jams[0].rounds.length, 1);
assert.deepEqual(jams[0].rounds[0].names, ["Ana"]);

// Unlink: the context goes away for everyone.
host.send({ t: "unspace" });
await guest.until((p) => p.ctx === null && p.last.space === null);
host.send({ t: "delete" });
for (const p of [host, guest]) p.ws.close();

// Delete: the owner only; the id is never reused.
assert.equal((await call({ op: "delete", k: edit })).status, 403);
r = await call({ op: "delete", k: owner });
assert.equal(r.body.deleted, true);
assert.equal((await get()).status, 404);
assert.equal((await call({ op: "create", name: "squatter" })).status, 409, "a deleted id is never reused");

// Origin check, and ids must be 8 characters.
assert.equal((await call({ op: "get" }, "https://example.com")).status, 403);
assert.equal((await fetch(`${http}/parties/story-space/SHORT`, { headers: { Origin: ORIGIN } })).status, 404);

console.log(`ok: space ${id}: create, roles, private reads, grammar versions (stale base refused, old versions kept), words, pieces, cast, comments, lore, settings, public by id, remove, export, jam link (context relay, lore, rounds, unlink), delete (id not reused), origin check`);
