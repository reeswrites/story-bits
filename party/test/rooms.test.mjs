// End-to-end check of a jam against a running server: the dev server by default (npm run dev,
// port 8799), or the deployed one with ROOMS_HOST=story-bits-rooms.<subdomain>.workers.dev.
// Disconnects reach a deployed jam a few seconds late, hence the long wait on host handoff.
//
// Covers: roles from invite keys; together mode (whole piece, patches, presence, view-only is
// refused); comments; workshop (start, hidden copies, critique notes, claps with cap and no
// self-claps, rules, stored round); host handoff; forget; retention; delete; origin check.
import assert from "node:assert/strict";

const HOST = process.env.ROOMS_HOST || "localhost:8799";
const code = "T" + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z0-9]/g, "X");
const proto = /^(localhost|127\.0\.0\.1)/.test(HOST) ? "ws" : "wss";
const base = `${proto}://${HOST}/parties/story-room/${code}`;

function player(pid, key = "", origin = "http://localhost:4290") {
  const ws = new WebSocket(key ? `${base}?k=${key}` : base, { headers: { Origin: origin } });
  const p = { pid, ws, last: null, you: null, doc: null, rev: 0, presence: [], waiters: [] };
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.t === "state") { p.last = m.room; p.you = m.you; }
    if (m.t === "doc") { p.doc = m.doc; p.rev = m.rev; }
    if (m.t === "patch") { for (const [k, v] of Object.entries(m.set)) { const [a, b] = k.split("."); if (b) (p.doc[a] ||= {})[b] = v; else p.doc[a] = v; } p.rev = m.rev; }
    if (m.t === "presence") p.presence = m.list;
    if (m.t === "deleted") p.deleted = true;
    p.waiters = p.waiters.filter((w) => !w(m));
  });
  p.open = new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
  p.send = (m) => ws.send(JSON.stringify(m));
  p.until = (pred, ms = 4000) => new Promise((res, rej) => {
    if (pred(p)) return res(p);
    const t = setTimeout(() => rej(new Error(`timeout waiting on ${pred}`)), ms);
    p.waiters.push(() => pred(p) && (clearTimeout(t), res(p), true));
  });
  return p;
}

// Owner opens a new jam and gets the keys.
const a = player("player-aaaa-1");
await a.open;
await a.until((p) => p.you?.role === "edit" && p.last?.keys, 15000); // a fresh deploy can cold-start slowly
a.send({ t: "hello", pid: a.pid, name: "Ana" });
await a.until((p) => p.last.host === a.pid && p.last.owner === a.pid);
const { edit, comment } = a.last.keys;

const b = player("player-bbbb-2", edit);     // editor
const c = player("player-cccc-3", comment);  // commenter
const v = player("player-vvvv-4");           // viewer (no key)
await Promise.all([b.open, c.open, v.open]);
b.send({ t: "hello", pid: b.pid, name: "Ben" });
c.send({ t: "hello", pid: c.pid, name: "<i>Cy</i>" });
v.send({ t: "hello", pid: v.pid, name: "Vi" });
await a.until((p) => p.last.players.length === 4);
await Promise.all([b, c, v].map((p) => p.until((q) => q.you)));
assert.equal(b.you.role, "edit");
assert.equal(c.you.role, "comment");
assert.equal(v.you.role, "view");
assert.equal(c.last.keys, null, "only editors see invite keys");
assert.equal(a.last.players.find((x) => x.id === c.pid).name, "Cy", "names are cleaned");

// Together: the owner puts up a piece; patches flow; viewers and commenters can't edit.
a.send({ t: "doc", doc: { v: 3, g: "story-bits", f: "bit", p: { who: { w: { n: 1 } } }, d: 1, s: 7, l: 2, b: {} } });
await v.until((p) => p.doc?.g === "story-bits");
b.send({ t: "patch", set: { "p.who": { w: { n: 2 } }, "b.turn": 4 } });
await a.until((p) => p.doc?.p?.who?.w?.n === 2 && p.doc.b.turn === 4);
v.send({ t: "patch", set: { "p.who": { w: { n: 9 } } } });
c.send({ t: "patch", set: { "p.who": { w: { n: 9 } } } });
b.send({ t: "patch", set: { "evil.x.y": 1 } });
await new Promise((r) => setTimeout(r, 500));
assert.equal(a.doc.p.who.w.n, 2, "viewers and commenters can't edit; bad paths are refused");

// Presence and comments.
c.send({ t: "presence", sel: "who|n" });
await a.until((p) => p.presence.some((x) => x.pid === c.pid && x.sel === "who|n"));
c.send({ t: "comment", at: "who|n", quote: "your dentist", text: "funnier as the barber?" });
v.send({ t: "comment", at: "who|n", text: "viewers can't comment" });
await a.until((p) => p.last.comments.length === 1);
const cid = a.last.comments[0].id;
b.send({ t: "resolve", id: cid, done: true });
await c.until((p) => p.last.comments[0]?.resolved);

// Workshop with rules: no move limit, claps on.
a.send({ t: "mode", mode: "workshop" });
a.send({ t: "rules", moves: 0, claps: true });
await b.until((p) => p.last.mode === "workshop" && p.last.rules.moves === 0);
a.send({ t: "start", c: { h: "Ana", n: 0, s: { fake: 1 } } });
await b.until((p) => p.last.phase === "play");
a.send({ t: "submit", me: { who: "a" } });
b.send({ t: "submit", me: { who: "b" } });
c.send({ t: "submit", me: { who: "c" } }); // commenters critique; they don't submit
await a.until((p) => p.last.players.filter((x) => x.submitted).length === 2);
await new Promise((r) => setTimeout(r, 300));
assert.equal(a.last.players.filter((x) => x.submitted).length, 2);
assert.equal(a.last.entries.length, 0, "copies stay hidden until the reveal");
a.send({ t: "vote" });
await c.until((p) => p.last.phase === "vote" && p.last.entries.length === 2);
c.send({ t: "comment", entry: b.pid, text: "the turn lands" });
b.send({ t: "clap", to: b.pid }); // self: ignored
for (let i = 0; i < 7; i++) c.send({ t: "clap", to: b.pid }); // capped at 5
a.send({ t: "clap", to: b.pid });
await a.until((p) => p.last.entries.find((e) => e.id === b.pid)?.claps === 6);
a.send({ t: "end" });
await b.until((p) => p.last.phase === "results");
assert.equal(b.last.stored, 1);
assert.deepEqual(b.last.history[0].top, ["Ben"]);

// Host handoff: the owner leaves; an editor takes over (not the commenter).
a.ws.close();
await b.until((p) => p.last.host === b.pid, 15000);
b.send({ t: "forget" });
await c.until((p) => p.last.stored === 0 && p.last.comments.length === 0);

// Retention is the host's call; a non-host can't change it. Then the host deletes the jam.
assert.equal(c.last.retain, "1y", "kept a year by default");
c.send({ t: "retain", value: "30d" });
b.send({ t: "retain", value: "keep" });
await c.until((p) => p.last.retain === "keep");
b.send({ t: "retain", value: "forever-and-ever" });
await new Promise((r) => setTimeout(r, 300));
assert.equal(c.last.retain, "keep", "only known retention values");
c.send({ t: "delete" }); // not host: ignored
await new Promise((r) => setTimeout(r, 300));
assert.ok(!c.deleted);
b.send({ t: "delete" });
await c.until((p) => p.deleted);

// Origin check.
const evil = player("player-eeee-5", "", "https://example.com");
await assert.rejects(evil.open, "foreign origin is refused");

for (const p of [b, c, v]) p.ws.close();
console.log(`ok: jam ${code}: roles, together (doc, patches, guards, presence), comments, workshop (rules, hidden copies, notes, claps), history, host handoff, forget, retention, delete, origin check`);
