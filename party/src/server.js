// Jams for Story Bits: shared sessions, one Durable Object per jam code (partyserver,
// Cloudflare's successor to PartyKit). See docs/design.md.
//
// Two modes:
//   together — one shared piece. Editors change it with small patches (per card, per beat, per
//              setting), so two people on different cards never collide; the same card is
//              last-write-wins. Everyone sees who's looking at which word (presence).
//   workshop — everyone tunes their own copy of the same start, then the copies go side by side
//              for critique. Optional rules turn it into a game: a move limit and claps.
// Comments anchor to a word or beat address ("who|d", "beat|turn"), or to a workshop copy.
//
// Roles come from the invite key in the connection URL (?k=): edit, comment, or view (no key).
// The first connection to a new jam is its owner and gets the keys.
//
// The jam never interprets pieces or grammars: they're opaque JSON, size-capped here, and every
// client checks what it receives with the same parsers it uses for links. Treat everything a
// client sends as untrusted.
//
// What's stored, in this object's storage, in the owner's Cloudflare account: the shared piece,
// comments (with nicknames), finished workshop rounds (up to MAX_ROUNDS: the start, each copy,
// its claps and notes). No accounts, emails or IPs. A jam with no activity for EXPIRE_MS deletes
// itself, and the host can wipe its history and comments at any time ("forget").

import { Server, routePartykitRequest } from "partyserver";

const MAX_PLAYERS = 24;
const MAX_MSG = 256 * 1024;
const MAX_DOC = 240 * 1024;
const MAX_STORY = 240 * 1024;
const MAX_ROUNDS = 50;
const MAX_COMMENTS = 400;
const CLAPS_EACH = 5;
const EXPIRE_MS = 30 * 24 * 60 * 60 * 1000;
const ROLE_RANK = { view: 0, comment: 1, edit: 2 };
// Top-level fields of a piece a patch may set, and which of them take a sub-key (p.who, b.turn).
const PATCH_TOP = new Set(["v", "g", "gx", "f", "d", "s", "l", "b", "p"]);
const PATCH_SUB = new Set(["b", "p"]);

const clean = (s, n) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/[{}<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const size = (x) => { try { return JSON.stringify(x).length; } catch { return Infinity; } };
const fits = (x, max) => !!x && typeof x === "object" && size(x) <= max;
const token = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
const fresh = () => ({
  mode: "together", owner: null, host: null, keys: null,
  doc: null, rev: 0, comments: [], seq: 0,
  rules: { moves: 3, claps: true },
  phase: "lobby", round: 0, challenge: null, players: {}, entries: {}, claps: {},
});

export class StoryRoom extends Server {
  static options = { hibernate: true };

  async onStart() {
    this.room = { ...fresh(), ...((await this.ctx.storage.get("room")) || {}) };
    this.rounds = (await this.ctx.storage.get("rounds")) || [];
  }

  // Connections still open (a closing one may still be listed; skip it).
  conns() {
    return [...this.getConnections()].filter((c) => c.id !== this.closing);
  }
  online() {
    return new Set(this.conns().map((c) => c.state?.pid).filter(Boolean));
  }
  roleOf(pid) {
    let best = "view";
    for (const c of this.conns()) if (c.state?.pid === pid && ROLE_RANK[c.state.role] > ROLE_RANK[best]) best = c.state.role;
    return best;
  }

  // Host: the owner while they're here; otherwise the earliest-joined editor still here.
  fixHost() {
    const on = this.online();
    const r = this.room;
    if (r.owner && on.has(r.owner)) { r.host = r.owner; return; }
    if (r.host && on.has(r.host) && this.roleOf(r.host) === "edit") return;
    const next = Object.entries(r.players).filter(([id]) => on.has(id) && this.roleOf(id) === "edit").sort((a, b) => a[1].joined - b[1].joined)[0];
    r.host = next ? next[0] : null;
  }

  claps() {
    const got = {};
    for (const given of Object.values(this.room.claps)) for (const [to, n] of Object.entries(given)) got[to] = (got[to] || 0) + n;
    return got;
  }

  view(conn) {
    const r = this.room;
    const on = this.online();
    const role = conn.state?.role || "view";
    const reveal = r.phase === "vote" || r.phase === "results";
    const got = this.claps();
    return {
      t: "state",
      you: { pid: conn.state?.pid || null, role },
      room: {
        code: this.name, mode: r.mode, host: r.host, owner: r.owner, rev: r.rev,
        rules: r.rules, clapsEach: CLAPS_EACH,
        // Invite keys only for editors: they can bring people in.
        keys: role === "edit" ? r.keys : null,
        phase: r.phase, round: r.round, challenge: r.challenge,
        players: Object.entries(r.players).sort((a, b) => a[1].joined - b[1].joined).map(([id, p]) => ({
          id, name: p.name, online: on.has(id), role: on.has(id) ? this.roleOf(id) : p.role || "view",
          submitted: !!r.entries[id],
          clapsLeft: CLAPS_EACH - Object.values(r.claps[id] || {}).reduce((a, b) => a + b, 0),
        })),
        // Copies stay hidden until the reveal, so nobody plays to someone else's version.
        entries: reveal ? Object.entries(r.entries).map(([id, e]) => ({ id, name: e.name, me: e.me, claps: got[id] || 0 })) : [],
        comments: r.comments,
        history: this.rounds.slice(-10).reverse().map((h) => ({ at: h.at, round: h.round, top: h.top })),
        stored: this.rounds.length,
      },
    };
  }

  broadcastState() {
    for (const c of this.conns()) c.send(JSON.stringify(this.view(c)));
  }
  presence() {
    const list = this.conns().filter((c) => c.state?.pid).map((c) => ({ pid: c.state.pid, name: this.room.players[c.state.pid]?.name || "", sel: c.state.sel || null }));
    this.broadcast(JSON.stringify({ t: "presence", list }));
  }

  async save(withState = true) {
    await this.ctx.storage.put("room", this.room);
    await this.ctx.storage.setAlarm(Date.now() + EXPIRE_MS);
    if (withState) this.broadcastState();
  }

  async onAlarm() {
    await this.ctx.storage.deleteAll();
    this.room = fresh();
    this.rounds = [];
  }

  async onConnect(conn, ctx) {
    const r = this.room;
    const k = new URL(ctx.request.url).searchParams.get("k") || "";
    let role = "view";
    if (!r.keys) {
      // A new jam: whoever opens it owns it.
      r.keys = { edit: token(), comment: token() };
      role = "edit";
      await this.ctx.storage.put("room", r);
    } else if (k && k === r.keys.edit) role = "edit";
    else if (k && k === r.keys.comment) role = "comment";
    conn.setState({ role, pid: null, sel: null, owner: role === "edit" && !r.owner });
    conn.send(JSON.stringify(this.view(conn)));
    if (r.doc) conn.send(JSON.stringify({ t: "doc", rev: r.rev, doc: r.doc }));
  }

  async onClose(conn) {
    this.closing = conn.id;
    const before = this.room.host;
    this.fixHost();
    if (this.room.host !== before) await this.ctx.storage.put("room", this.room);
    this.broadcastState();
    this.presence();
    this.closing = null;
  }

  async onMessage(conn, raw) {
    if (typeof raw !== "string" || raw.length > MAX_MSG) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== "object") return;
    const r = this.room;
    const role = conn.state?.role || "view";
    const can = (need) => ROLE_RANK[role] >= ROLE_RANK[need];

    if (m.t === "hello") {
      const pid = typeof m.pid === "string" && /^[\w-]{8,64}$/.test(m.pid) ? m.pid : null;
      if (!pid) return;
      if (!r.players[pid] && Object.keys(r.players).length >= MAX_PLAYERS) {
        conn.send(JSON.stringify({ t: "error", error: "This jam is full." }));
        return;
      }
      conn.setState((s) => ({ ...s, pid }));
      if (conn.state.owner && !r.owner) r.owner = pid;
      const prev = r.players[pid];
      r.players[pid] = {
        name: clean(m.name, 24) || prev?.name || "",
        joined: prev?.joined || Date.now(),
        role: ROLE_RANK[role] > ROLE_RANK[prev?.role || "view"] ? role : prev?.role || role,
      };
      this.fixHost();
      await this.save();
      this.presence();
      return;
    }

    const pid = conn.state?.pid;
    if (!pid || !r.players[pid]) return;
    const isHost = pid === r.host;

    switch (m.t) {
      case "name":
        r.players[pid].name = clean(m.name, 24);
        if (r.entries[pid]) r.entries[pid].name = r.players[pid].name;
        await this.save();
        return this.presence();

      case "presence": // where you are: a word or beat address, or null. Not stored.
        conn.setState((s) => ({ ...s, sel: typeof m.sel === "string" ? m.sel.slice(0, 120) : null }));
        return this.presence();

      // ----- together -----
      case "doc": { // editors: replace the whole shared piece (e.g. "use my piece")
        if (!can("edit") || !fits(m.doc, MAX_DOC)) return;
        r.doc = m.doc;
        r.rev++;
        await this.save(false);
        return this.broadcast(JSON.stringify({ t: "doc", rev: r.rev, doc: r.doc, by: pid }));
      }
      case "patch": { // editors: set a few fields of the shared piece
        if (!can("edit") || !r.doc || !m.set || typeof m.set !== "object") return;
        const next = structuredClone(r.doc);
        for (const [path, val] of Object.entries(m.set)) {
          const [top, sub, extra] = path.split(".");
          if (extra !== undefined || !PATCH_TOP.has(top) || (sub !== undefined && !PATCH_SUB.has(top))) return;
          if (sub === undefined) { if (val === null) delete next[top]; else next[top] = val; }
          else {
            if (!next[top] || typeof next[top] !== "object") next[top] = {};
            if (val === null) delete next[top][sub]; else next[top][sub] = val;
          }
        }
        if (!fits(next, MAX_DOC)) return;
        r.doc = next;
        r.rev++;
        await this.save(false);
        return this.broadcast(JSON.stringify({ t: "patch", rev: r.rev, set: m.set, by: pid }));
      }
      case "sync": // anyone: send me the whole piece again
        if (r.doc) conn.send(JSON.stringify({ t: "doc", rev: r.rev, doc: r.doc }));
        return;

      // ----- comments -----
      case "comment": {
        if (!can("comment") || r.comments.length >= MAX_COMMENTS) return;
        const text = clean(m.text, 600);
        if (!text) return;
        const entry = typeof m.entry === "string" && r.entries[m.entry] ? m.entry : undefined;
        r.comments.push({
          id: `c${++r.seq}`, at: typeof m.at === "string" ? m.at.slice(0, 120) : null, quote: clean(m.quote, 200),
          text, name: r.players[pid].name, pid, ts: Date.now(), resolved: false,
          ...(entry && { entry, round: r.round }),
        });
        return this.save();
      }
      case "resolve": {
        const c = r.comments.find((x) => x.id === m.id);
        if (!c || !can("comment")) return;
        c.resolved = !!m.done;
        return this.save();
      }
      case "uncomment": { // your own, or the host's call
        const i = r.comments.findIndex((x) => x.id === m.id);
        if (i < 0 || (r.comments[i].pid !== pid && !isHost)) return;
        r.comments.splice(i, 1);
        return this.save();
      }

      // ----- host settings -----
      case "mode":
        if (!isHost || !["together", "workshop"].includes(m.mode)) return;
        r.mode = m.mode;
        if (m.mode === "together") Object.assign(r, { phase: "lobby", challenge: null, entries: {}, claps: {} });
        return this.save();
      case "rules":
        if (!isHost) return;
        r.rules = {
          moves: Number.isInteger(m.moves) && m.moves >= 0 && m.moves <= 9 ? m.moves : r.rules.moves,
          claps: typeof m.claps === "boolean" ? m.claps : r.rules.claps,
        };
        return this.save();

      // ----- workshop -----
      case "start": // host: everyone gets this start
        if (!isHost || r.mode !== "workshop" || !fits(m.c, MAX_STORY)) return;
        Object.assign(r, { phase: "play", round: r.round + 1, challenge: m.c, entries: {}, claps: {} });
        return this.save();
      case "submit": // writers: your copy; resubmitting replaces it
        if (!can("edit") || r.phase !== "play" || !fits(m.me, MAX_STORY)) return;
        r.entries[pid] = { name: r.players[pid].name, me: m.me };
        return this.save();
      case "vote": // host: reveal the copies for critique
        if (!isHost || r.phase !== "play" || !Object.keys(r.entries).length) return;
        r.phase = "vote";
        return this.save();
      case "clap": { // if claps are on: a few each, never for your own copy
        if (!r.rules.claps || !can("comment") || r.phase !== "vote" || typeof m.to !== "string" || !r.entries[m.to] || m.to === pid) return;
        const given = (r.claps[pid] ||= {});
        if (Object.values(given).reduce((a, b) => a + b, 0) >= CLAPS_EACH) return;
        given[m.to] = (given[m.to] || 0) + 1;
        return this.save();
      }
      case "end": { // host: close the critique; the round goes in the record
        if (!isHost || r.phase !== "vote") return;
        r.phase = "results";
        const got = this.claps();
        const entries = Object.entries(r.entries).map(([id, e]) => ({
          name: e.name, me: e.me, claps: got[id] || 0,
          notes: r.comments.filter((c) => c.entry === id && c.round === r.round).map((c) => ({ name: c.name, text: c.text })),
        }));
        const best = Math.max(0, ...entries.map((e) => e.claps));
        this.rounds.push({
          at: Date.now(), round: r.round, challenge: r.challenge, rules: r.rules, entries,
          top: r.rules.claps && best ? entries.filter((e) => e.claps === best).map((e) => e.name || "someone") : [],
        });
        this.rounds = this.rounds.slice(-MAX_ROUNDS);
        await this.ctx.storage.put("rounds", this.rounds);
        return this.save();
      }
      case "lobby": // host: back to the start for another round
        if (!isHost) return;
        Object.assign(r, { phase: "lobby", challenge: null, entries: {}, claps: {} });
        return this.save();
      case "forget": // host: wipe stored rounds and comments
        if (!isHost) return;
        this.rounds = [];
        r.comments = [];
        await this.ctx.storage.delete("rounds");
        return this.save();
    }
  }
}

// Only these pages may open a jam; localhost is always allowed for development.
function allowed(origin, env) {
  if (!origin) return false;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).includes(origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") return new Response("Story Bits jams. Open one from the site.", { headers: { "content-type": "text/plain" } });
    // Jam codes are short and public-ish; keep them to a fixed alphabet.
    if (!/^\/parties\/story-room\/[A-Z0-9]{4,8}$/.test(url.pathname)) return new Response("Not found", { status: 404 });
    return (
      (await routePartykitRequest(request, env, {
        onBeforeConnect: (req) => (allowed(req.headers.get("Origin"), env) ? undefined : new Response("Forbidden", { status: 403 })),
        onBeforeRequest: () => new Response("Jams are WebSocket only.", { status: 400 }),
      })) || new Response("Not found", { status: 404 })
    );
  },
};
