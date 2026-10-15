// End-to-end check of a room against a running server: the dev server by default (npm run dev,
// port 8799), or the deployed one with ROOMS_HOST=story-bits-rooms.<subdomain>.workers.dev.
// Disconnects reach a deployed room a few seconds late, hence the long wait on host handoff.
// Three players: host starts a round, two submit, everyone claps, host ends; the round is stored.
// Also checks the rules: no self-claps, clap cap, host-only actions, origin check.
import assert from "node:assert/strict";

const HOST = process.env.ROOMS_HOST || "localhost:8799";
const code = "T" + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z0-9]/g, "X");
const proto = /^(localhost|127\.0\.0\.1)/.test(HOST) ? "ws" : "wss";
const url = `${proto}://${HOST}/parties/story-room/${code}`;

function player(pid, name, origin = "http://localhost:4290") {
  const ws = new WebSocket(url, { headers: { Origin: origin } });
  const p = { pid, ws, last: null, waiters: [] };
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.t === "state") p.last = m.room;
    p.waiters = p.waiters.filter((w) => !w(m));
  });
  p.open = new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
  p.send = (m) => ws.send(JSON.stringify(m));
  // Resolve once a state matching pred arrives (or is already current).
  p.until = (pred, ms = 3000) => new Promise((res, rej) => {
    if (p.last && pred(p.last)) return res(p.last);
    const t = setTimeout(() => rej(new Error(`timeout waiting on ${pred}`)), ms);
    p.waiters.push((m) => m.t === "state" && pred(m.room) && (clearTimeout(t), res(m.room), true));
  });
  return p;
}

const a = player("player-aaaa-1", "Ana"), b = player("player-bbbb-2", "Ben"), c = player("player-cccc-3", "Cy");
await Promise.all([a.open, b.open, c.open]);
a.send({ t: "hello", pid: a.pid, name: "Ana" });
await a.until((r) => r.host === a.pid);
b.send({ t: "hello", pid: b.pid, name: "Ben" });
c.send({ t: "hello", pid: c.pid, name: "<b>Cy</b>" });
let r = await a.until((r) => r.players.length === 3);
assert.equal(r.players.find((p) => p.id === c.pid).name, "Cy", "names are cleaned");

b.send({ t: "start", c: { n: 3 } }); // not host: ignored
a.send({ t: "start", c: { h: "Ana", n: 3, s: { fake: true } } });
r = await b.until((r) => r.phase === "play");
assert.equal(r.round, 1);
assert.equal(r.entries.length, 0);

b.send({ t: "submit", me: { who: "b" } });
c.send({ t: "submit", me: { who: "c" } });
r = await a.until((r) => r.players.filter((p) => p.submitted).length === 2);
assert.equal(r.entries.length, 0, "copies stay hidden until the vote");

a.send({ t: "vote" });
r = await c.until((r) => r.phase === "vote");
assert.equal(r.entries.length, 2);

b.send({ t: "clap", to: b.pid }); // self-clap: ignored
for (let i = 0; i < 7; i++) a.send({ t: "clap", to: c.pid }); // over the cap: only 5 count
c.send({ t: "clap", to: b.pid });
r = await a.until((r) => r.entries.find((e) => e.id === c.pid)?.claps === 5 && r.entries.find((e) => e.id === b.pid)?.claps === 1);
await new Promise((res) => setTimeout(res, 200));
r = a.last;
assert.equal(r.entries.find((e) => e.id === b.pid).claps, 1, "no self-claps");
assert.equal(r.players.find((p) => p.id === a.pid).clapsLeft, 0);

a.send({ t: "end" });
r = await b.until((r) => r.phase === "results");
assert.equal(r.stored, 1);
assert.deepEqual(r.history[0].top, ["Cy"]);

// Host leaves: the next player still here takes over.
a.ws.close();
r = await b.until((r) => r.host === b.pid, 15000);
b.send({ t: "forget" });
r = await c.until((r) => r.stored === 0);

// Origin check: a page we don't know can't open the room.
const evil = player("player-eeee-4", "Eve", "https://example.com");
await assert.rejects(evil.open, "foreign origin is refused");

b.ws.close(); c.ws.close();
console.log(`ok: room ${code}: round, hidden copies, claps (cap, no self), stored history, host handoff, forget, origin check`);
