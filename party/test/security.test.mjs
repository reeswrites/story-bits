// Security checks against a running server (same hosts as rooms.test.mjs). See docs/security.md.
//
// Covers: nobody can take someone's place by copying their id (host, owner, comments); one
// person per connection; ids a page sends never come back out; malformed and oversized messages
// are dropped without breaking the jam; patch paths can't reach prototypes; retention only takes
// its own values ("toString" isn't one); claps and notes can't aim at "__proto__"; message floods
// are throttled; delete-now wipes everything and a new opener gets new keys. Spaces: public
// viewers aren't sent jam codes; reads with keys work by POST; retention values are checked;
// oversized lore phrases are dropped; no Origin, no answer.
import assert from "node:assert/strict";

const HOST = process.env.ROOMS_HOST || "localhost:8799";
const local = /^(localhost|127\.0\.0\.1)/.test(HOST);
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newId = (n = 8) => Array.from({ length: n }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join("");
const ORIGIN = "http://localhost:4290";
const code = "X" + newId(7);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function player(pid, key = "", headers = { Origin: ORIGIN }) {
  const ws = new WebSocket(`${local ? "ws" : "wss"}://${HOST}/parties/story-room/${code}${key ? `?k=${key}` : ""}`, { headers });
  const p = { pid, ws, last: null, you: null, doc: null, raw: [], errors: [], waiters: [] };
  ws.addEventListener("message", (e) => {
    p.raw.push(e.data);
    const m = JSON.parse(e.data);
    if (m.t === "state") { p.last = m.room; p.you = m.you; }
    if (m.t === "doc") p.doc = m.doc;
    if (m.t === "patch") for (const [k, v] of Object.entries(m.set)) { const [a, b] = k.split("."); if (b) (p.doc[a] ||= {})[b] = v; else p.doc[a] = v; }
    if (m.t === "error") p.errors.push(m.error);
    if (m.t === "deleted") p.deleted = true;
    p.waiters = p.waiters.filter((w) => !w(m));
  });
  p.closed = new Promise((res) => ws.addEventListener("close", res));
  p.open = new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
  p.send = (m) => ws.send(typeof m === "string" ? m : JSON.stringify(m));
  p.until = (pred, ms = 6000) => new Promise((res, rej) => {
    if (pred(p)) return res(p);
    const t = setTimeout(() => rej(new Error(`timeout waiting on ${pred}`)), ms);
    p.waiters.push(() => pred(p) && (clearTimeout(t), res(p), true));
  });
  return p;
}

// ---------- jams ----------
const a = player("secret-owner-aaaa");
await a.open;
await a.until((p) => p.last?.keys, 15000);
a.send({ t: "hello", pid: a.pid, name: "Ana" });
await a.until((p) => p.you?.pid && p.last.host === p.you.pid);
const { edit, comment } = a.last.keys;
const ownerId = a.you.pid;
a.send({ t: "doc", doc: { v: 3, g: "story-bits", p: { who: { w: { n: 1 } } }, b: {} } });
a.send({ t: "comment", at: "who|n", text: "mine" });
await a.until((p) => p.last.comments.length === 1);

// A viewer copies the owner's id from what the jam shows them, and tries to be them.
const v = player("secret-viewer-vvvv");
await v.open;
v.send({ t: "hello", pid: ownerId, name: "Not Ana" });
await v.until((p) => p.you?.pid);
assert.notEqual(v.you.pid, ownerId, "an id copied from the jam is someone else's public id, not theirs");
assert.equal(v.last.host, ownerId, "the owner stays host");
v.send({ t: "uncomment", id: a.last.comments[0].id });
v.send({ t: "retain", value: "30d" });
v.send({ t: "delete" });
v.send({ t: "mode", mode: "workshop" });
await wait(500);
assert.equal(a.last.comments.length, 1, "can't delete someone else's comment");
assert.equal(a.last.retain, "1y");
assert.equal(a.last.mode, "together");
assert.ok(!a.deleted && !v.deleted, "a viewer can't delete the jam");

// One person per connection: a second hello with another id is ignored.
const before = a.last.players.length;
v.send({ t: "hello", pid: "secret-viewer-other", name: "Two" });
await wait(400);
assert.equal(a.last.players.length, before, "a connection can't add more people");

// The ids pages send never leave the server.
const e = player("secret-editor-eeee", edit);
await e.open;
e.send({ t: "hello", pid: e.pid, name: "Eve" });
await a.until((p) => p.last.players.length === before + 1);
await wait(300);
for (const p of [a, v, e]) for (const raw of p.raw) for (const secret of [a.pid, v.pid, e.pid]) assert.ok(!raw.includes(secret), "page ids are never sent out");

// Malformed and unexpected messages are dropped; the jam keeps working.
for (const junk of ["not json", "[]", "null", "42", '{"t":5}', '{"t":"patch","set":[1,2]}', '{"t":"hello","pid":{"x":1}}', '{"t":"comment","text":{"toString":1}}']) e.send(junk);
e.send("x".repeat(300 * 1024));
e.send({ t: "doc", doc: { big: "y".repeat(250 * 1024) } }); // over the piece cap
await wait(500);
e.send({ t: "sync" });
await e.until((p) => p.doc?.g === "story-bits");
assert.equal(e.doc.big, undefined, "an oversized piece is refused");

// Patches can't reach prototypes or invent paths.
e.send({ t: "patch", set: { "b.__proto__": { polluted: 1 } } });
e.send({ t: "patch", set: { "p.constructor": 1 } });
e.send({ t: "patch", set: { "p.": 1 } });
e.send({ t: "patch", set: { "b.turn": 4 } });
await a.until((p) => p.doc?.b?.turn === 4);
assert.equal(Object.keys(a.doc.p).join(), "who", "bad patch paths are refused");

// Retention takes only its own values.
a.send({ t: "retain", value: "toString" });
a.send({ t: "retain", value: "constructor" });
a.send({ t: "retain", value: { x: 1 } });
await wait(400);
assert.equal(a.last.retain, "1y", "inherited names aren't retention values");

// Claps and notes can't aim at "__proto__".
a.send({ t: "mode", mode: "workshop" });
a.send({ t: "start", c: { h: "Ana", n: 0, s: { fake: 1 } } });
await e.until((p) => p.last.phase === "play");
e.send({ t: "submit", me: { who: "e" } });
await a.until((p) => p.last.players.some((x) => x.submitted));
a.send({ t: "vote" });
await a.until((p) => p.last.phase === "vote");
a.send({ t: "clap", to: "__proto__" });
a.send({ t: "comment", entry: "__proto__", text: "note" });
a.send({ t: "clap", to: e.you.pid });
await a.until((p) => p.last.entries[0]?.claps === 1);
assert.equal(a.last.players.find((x) => x.id === ownerId).clapsLeft, 4, "only the real clap counted");
assert.ok(!a.last.comments.some((c) => c.entry === "__proto__"), "a note on __proto__ isn't attached to anything");

// Floods are throttled: past the budget, messages are dropped and the sender is told once.
for (let i = 0; i < 120; i++) v.send({ t: "presence", sel: `who|n${i}` });
await v.until((p) => p.errors.some((x) => /slow down/i.test(x)));
assert.equal(v.errors.filter((x) => /slow down/i.test(x)).length, 1, "told once, not per message");

// Delete now: everything goes, everyone is told, and the code starts over with new keys.
a.send({ t: "lobby" });
a.send({ t: "delete" });
await Promise.all([v.until((p) => p.deleted), e.until((p) => p.deleted)]);
await Promise.all([a.closed, v.closed, e.closed]);
const n = player("secret-newcomer-nnnn", edit); // the old edit key
await n.open;
await n.until((p) => p.last, 8000);
assert.equal(n.you.role, "edit", "the first one in after a delete opens a new jam");
assert.notEqual(n.last.keys.edit, edit, "with new keys");
assert.equal(n.last.comments.length, 0);
assert.equal(n.last.stored, 0);
assert.equal(n.doc, null, "and no piece");
n.send({ t: "delete" }); // not joined (no hello): ignored; the empty jam is dropped on its own
n.ws.close();

// No Origin, no jam.
await assert.rejects(player("secret-noorigin-1", "", {}).open, "a connection without an Origin is refused");

// ---------- spaces ----------
const sid = newId();
const url = `${local ? "http" : "https"}://${HOST}/parties/story-space/${sid}`;
async function call(body, headers = { Origin: ORIGIN }) {
  const res = await fetch(url, { method: "POST", headers: { ...headers, "content-type": "text/plain" }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => null) };
}
let r = await call({ op: "create", name: "Sec", retain: "toString" });
assert.equal(r.status, 201);
assert.equal(r.body.space.retain, "keep", "inherited names aren't retention values");
const k = r.body.space.keys;
assert.equal((await call({ op: "settings", k: k.owner, retain: "constructor" })).status, 400);
assert.equal((await call({ op: "settings", k: k.owner, retain: "__proto__" })).status, 400);

// Reads with a key go by POST (keys stay out of URLs).
assert.equal((await call({ op: "get" })).status, 403);
r = await call({ op: "get", k: k.view });
assert.equal(r.body.space.role, "view");
const tiny = { id: "tiny-sec", name: "Tiny", maxDepth: 0, cards: [{ key: "image", label: "Image" }], schemas: { image: { parts: [{ k: "n", name: "image", pool: [{ t: "moth", tier: 0 }] }] } }, line: "{image}.", rules: { landing: false, pairs: [], dialLabels: ["a", "b", "c"], dialNotes: ["a", "b", "c"] }, forms: { one: { name: "One", beats: {}, stanzas: [{ name: "Line", slots: ["image"], paras: [] }] } } };
await call({ op: "put", k: k.edit, item: { kind: "grammar", base: 0, data: tiny } });
r = await call({ op: "gv", k: k.view, gv: "tiny-sec@1" });
assert.equal(r.body.doc.id, "tiny-sec", "a grammar version by POST with a key");
assert.equal((await call({ op: "gv", gv: "tiny-sec@1" })).status, 403, "not without one, while private");

// Lore: an oversized phrase payload is dropped (the text is kept).
r = await call({ op: "lore", k: k.edit, entry: { text: "a long one", card: "image", ph: { w: { n: "z".repeat(4000) } } } });
assert.equal(r.body.space.lore[0].ph, undefined, "oversized phrase payloads aren't stored");

// Public: viewers by id see no jam codes.
await call({ op: "settings", k: k.owner, public: true });
const res = await fetch(url, { headers: { Origin: ORIGIN } });
assert.equal(res.status, 200);
const pub = (await res.json()).space;
assert.ok(pub.jams.every((j) => j.code === undefined) && pub.lore.every((l) => l.jam === undefined), "public viewers aren't sent jam codes");

// No Origin, no answer; then clean up.
assert.equal((await call({ op: "get", k: k.view }, {})).status, 403, "requests without an Origin are refused");
assert.equal((await call({ op: "delete", k: k.owner })).body.deleted, true);

console.log(`ok: security: jam ${code} (id spoofing, one id per connection, page ids never sent, malformed and oversized messages, patch paths, retention values, __proto__ claps and notes, flood throttle, delete now), space ${sid} (retention values, POST reads, lore size, public jam codes, origin)`);
