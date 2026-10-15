// Live rooms for Story Bits.
//
// One Durable Object per room code (partyserver, Cloudflare's successor to PartyKit). The room
// runs the round: lobby → play (everyone tunes the same challenge in their own copy) → vote
// (copies side by side, claps) → results. It is the one authority on phase, host and claps.
//
// The room never interprets stories: challenges and copies are opaque JSON, size-capped here
// and parsed by every client with the same checks it uses for links (parseChallenge /
// parseCopy in app.js). Treat everything a client sends as untrusted.
//
// What's stored, in this object's storage, in your Cloudflare account:
//   room   — current round: phase, challenge, players' nicknames, copies, claps
//   rounds — finished rounds (up to MAX_ROUNDS): challenge, each copy with its nickname and claps
// No accounts, emails or IPs. A room with no activity for EXPIRE_MS deletes itself, and the
// host can wipe its history at any time ("forget").

import { Server, routePartykitRequest } from "partyserver";

const MAX_PLAYERS = 16;
const MAX_MSG = 64 * 1024;
const MAX_STORY = 24 * 1024;
const MAX_ROUNDS = 50;
const CLAPS_EACH = 5;
const EXPIRE_MS = 30 * 24 * 60 * 60 * 1000;

const clean = (s, n) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/[{}<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const fits = (x, max) => {
  try { return !!x && typeof x === "object" && JSON.stringify(x).length <= max; } catch { return false; }
};
const fresh = () => ({ phase: "lobby", round: 0, challenge: null, players: {}, entries: {}, claps: {}, host: null });

export class StoryRoom extends Server {
  static options = { hibernate: true };

  async onStart() {
    this.room = (await this.ctx.storage.get("room")) || fresh();
    this.rounds = (await this.ctx.storage.get("rounds")) || [];
  }

  // Players with an open connection (a closing connection may still be listed; skip it).
  online() {
    const ids = new Set();
    for (const c of this.getConnections()) if (c.id !== this.closing && c.state?.pid) ids.add(c.state.pid);
    return ids;
  }

  // Host is whoever made the room, until they leave; then the earliest-joined player still here.
  fixHost() {
    const on = this.online();
    if (this.room.host && on.has(this.room.host)) return;
    const next = Object.entries(this.room.players).filter(([id]) => on.has(id)).sort((a, b) => a[1].joined - b[1].joined)[0];
    this.room.host = next ? next[0] : null;
  }

  view() {
    const r = this.room;
    const on = this.online();
    const reveal = r.phase === "vote" || r.phase === "results";
    const got = {};
    for (const given of Object.values(r.claps)) for (const [to, n] of Object.entries(given)) got[to] = (got[to] || 0) + n;
    return {
      t: "state",
      room: {
        code: this.name,
        phase: r.phase,
        round: r.round,
        host: r.host,
        challenge: r.challenge,
        clapsEach: CLAPS_EACH,
        players: Object.entries(r.players).sort((a, b) => a[1].joined - b[1].joined).map(([id, p]) => ({
          id, name: p.name, online: on.has(id), submitted: !!r.entries[id],
          clapsLeft: CLAPS_EACH - Object.values(r.claps[id] || {}).reduce((a, b) => a + b, 0),
        })),
        // Copies stay hidden until the vote, so nobody plays to someone else's version.
        entries: reveal ? Object.entries(r.entries).map(([id, e]) => ({ id, name: e.name, me: e.me, claps: got[id] || 0 })) : [],
        history: this.rounds.slice(-10).reverse().map((h) => ({ at: h.at, round: h.round, top: h.top })),
        stored: this.rounds.length,
      },
    };
  }

  async save() {
    await this.ctx.storage.put("room", this.room);
    await this.ctx.storage.setAlarm(Date.now() + EXPIRE_MS);
    this.broadcast(JSON.stringify(this.view()));
  }

  async onAlarm() {
    await this.ctx.storage.deleteAll();
    this.room = fresh();
    this.rounds = [];
  }

  onConnect(conn) {
    conn.send(JSON.stringify(this.view()));
  }

  async onClose(conn) {
    this.closing = conn.id;
    const before = this.room.host;
    this.fixHost();
    if (this.room.host !== before) await this.ctx.storage.put("room", this.room);
    this.broadcast(JSON.stringify(this.view()), [conn.id]);
    this.closing = null;
  }

  async onMessage(conn, raw) {
    if (typeof raw !== "string" || raw.length > MAX_MSG) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== "object") return;
    const r = this.room;

    if (m.t === "hello") {
      const pid = typeof m.pid === "string" && /^[\w-]{8,64}$/.test(m.pid) ? m.pid : null;
      if (!pid) return;
      if (!r.players[pid] && Object.keys(r.players).length >= MAX_PLAYERS) {
        conn.send(JSON.stringify({ t: "error", error: "This room is full." }));
        return;
      }
      conn.setState({ pid });
      r.players[pid] = { name: clean(m.name, 24) || r.players[pid]?.name || "", joined: r.players[pid]?.joined || Date.now() };
      if (!r.host) r.host = pid;
      this.fixHost();
      return this.save();
    }

    const pid = conn.state?.pid;
    if (!pid || !r.players[pid]) return;
    const isHost = pid === r.host;

    switch (m.t) {
      case "name":
        r.players[pid].name = clean(m.name, 24);
        if (r.entries[pid]) r.entries[pid].name = r.players[pid].name;
        return this.save();

      case "start": // host: everyone gets this challenge
        if (!isHost || !fits(m.c, MAX_STORY)) return;
        Object.assign(r, { phase: "play", round: r.round + 1, challenge: m.c, entries: {}, claps: {} });
        return this.save();

      case "submit": // your copy; resubmitting replaces it
        if (r.phase !== "play" || !fits(m.me, MAX_STORY)) return;
        r.entries[pid] = { name: r.players[pid].name, me: m.me };
        return this.save();

      case "vote": // host: reveal the copies
        if (!isHost || r.phase !== "play" || !Object.keys(r.entries).length) return;
        r.phase = "vote";
        return this.save();

      case "clap": { // a few claps each, never for your own copy
        if (r.phase !== "vote" || typeof m.to !== "string" || !r.entries[m.to] || m.to === pid) return;
        const given = (r.claps[pid] ||= {});
        if (Object.values(given).reduce((a, b) => a + b, 0) >= CLAPS_EACH) return;
        given[m.to] = (given[m.to] || 0) + 1;
        return this.save();
      }

      case "end": { // host: results, and the round goes in the record
        if (!isHost || r.phase !== "vote") return;
        r.phase = "results";
        const got = {};
        for (const given of Object.values(r.claps)) for (const [to, n] of Object.entries(given)) got[to] = (got[to] || 0) + n;
        const entries = Object.entries(r.entries).map(([id, e]) => ({ name: e.name, me: e.me, claps: got[id] || 0 }));
        const best = Math.max(0, ...entries.map((e) => e.claps));
        this.rounds.push({
          at: Date.now(), round: r.round, challenge: r.challenge, entries,
          top: best ? entries.filter((e) => e.claps === best).map((e) => e.name || "someone") : [],
        });
        this.rounds = this.rounds.slice(-MAX_ROUNDS);
        await this.ctx.storage.put("rounds", this.rounds);
        return this.save();
      }

      case "lobby": // host: back to the lobby for another round
        if (!isHost) return;
        Object.assign(r, { phase: "lobby", challenge: null, entries: {}, claps: {} });
        return this.save();

      case "forget": // host: wipe this room's stored rounds
        if (!isHost) return;
        this.rounds = [];
        await this.ctx.storage.delete("rounds");
        return this.save();
    }
  }
}

// Only these pages may open a room; localhost is always allowed for development.
function allowed(origin, env) {
  if (!origin) return false;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).includes(origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") return new Response("Story Bits rooms. Open a room from the site.", { headers: { "content-type": "text/plain" } });
    // Room codes are short and public-ish; keep them to a fixed alphabet.
    const m = url.pathname.match(/^\/parties\/story-room\/([A-Z0-9]{4,8})$/);
    if (!m) return new Response("Not found", { status: 404 });
    return (
      (await routePartykitRequest(request, env, {
        onBeforeConnect: (req) => (allowed(req.headers.get("Origin"), env) ? undefined : new Response("Forbidden", { status: 403 })),
        onBeforeRequest: () => new Response("Rooms are WebSocket only.", { status: 400 }),
      })) || new Response("Not found", { status: 404 })
    );
  },
};
