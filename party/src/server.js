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
// its claps and notes). No accounts, emails or IPs. How long a jam is kept is the host's call
// (RETAIN: a month or a year after the last activity, or until the host deletes it; a year by
// default). The host can wipe its history and comments ("forget") or delete it outright, any time.
//
// A jam can open inside a space (space.js): the host links it with the space's edit key, and the
// jam relays the space's grammars, lore and cast to everyone in it (they need no space keys).
// Phrases kept in the jam go to the space's lore; finished rounds go to its jam history. The jam
// keeps the space's id and name, never its keys.

import { Server, getServerByName, routePartykitRequest } from "partyserver";
import { StorySpace } from "./space.js";

export { StorySpace };

const MAX_PLAYERS = 24;  // people with a key (editors, commenters)
const MAX_VIEWERS = 40;  // people without one
const MAX_CONNS = 80;
const MAX_MSG = 256 * 1024;
const MAX_DOC = 240 * 1024;
const MAX_STORY = 240 * 1024;
const MAX_ROUNDS = 50;
const MAX_COMMENTS = 400;
const MAX_COMMENTS_EACH = 100;
// One stored value holds the room (piece, copies, comments) and another the rounds; keep each
// well under what a Durable Object value can hold.
const MAX_ROOM = 1536 * 1024;
const MAX_ROUNDS_BYTES = 1536 * 1024;
const CLAPS_EACH = 5;
const DAY = 24 * 60 * 60 * 1000;
// Retention, set by the host: kept this long after the last activity, or (keep) until deleted.
const RETAIN = { "30d": 30 * DAY, "1y": 365 * DAY, keep: null };
// A jam opened and never joined (no hello) is dropped after this.
const UNJOINED = 2 * DAY;
// Messages per connection: a bucket of RATE.burst, refilled RATE.perSec a second. Heavier
// messages cost more. Past it, messages are dropped (and the sender told once).
const RATE = { burst: 40, perSec: 10 };
const COST = { hello: 2, doc: 2, start: 2, submit: 2, comment: 4, lore: 4, space: 4, spacesync: 4 };
const ROLE_RANK = { view: 0, comment: 1, edit: 2 };
// Top-level fields of a piece a patch may set, and which of them take a sub-key (p.who, b.turn).
const PATCH_TOP = new Set(["v", "g", "gx", "f", "d", "s", "l", "b", "p"]);
const PATCH_SUB = new Set(["b", "p"]);
const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const own = (o, k) => typeof k === "string" && Object.hasOwn(o, k);

const clean = (s, n) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/[{}<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const size = (x) => { try { return JSON.stringify(x).length; } catch { return Infinity; } };
const fits = (x, max) => !!x && typeof x === "object" && size(x) <= max;
const token = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
// Someone's id as everyone else sees it. The id a page sends (pid) is a per-tab secret: whoever
// sends it is that person (their host or owner status, their comments). Only this hash of it is
// ever sent out, so nobody can take someone's place by copying their id from the jam.
async function publicId(pid) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`story-bits-jam:${pid}`)));
  return "u" + [...h.slice(0, 10)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const fresh = () => ({
  ids: 2,
  mode: "together", owner: null, host: null, keys: null,
  doc: null, rev: 0, comments: [], seq: 0,
  rules: { moves: 3, claps: true },
  retain: "1y",
  space: null,
  phase: "lobby", round: 0, challenge: null, players: {}, entries: {}, claps: {},
});

export class StoryRoom extends Server {
  static options = { hibernate: true };

  async onStart() {
    this.room = { ...fresh(), ...((await this.ctx.storage.get("room")) || {}) };
    this.rounds = (await this.ctx.storage.get("rounds")) || [];
    this.spaceCtx = (await this.ctx.storage.get("spacectx")) || null;
    this.buckets = new Map();
    if (this.room.ids !== 2) await this.migrateIds();
  }

  // Jams from before public ids stored the ids pages sent; swap each for its public id.
  async migrateIds() {
    const r = this.room;
    const map = {};
    for (const id of Object.keys(r.players)) map[id] = await publicId(id);
    const to = (id) => map[id] || id;
    const rekey = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [to(k), v]));
    r.players = rekey(r.players);
    r.entries = rekey(r.entries);
    r.claps = Object.fromEntries(Object.entries(r.claps || {}).map(([k, v]) => [to(k), rekey(v)]));
    r.owner = r.owner && to(r.owner);
    r.host = r.host && to(r.host);
    for (const c of r.comments) { c.pid = to(c.pid); if (c.entry) c.entry = to(c.entry); }
    r.ids = 2;
    if (r.keys) await this.ctx.storage.put("room", r);
  }

  // Rate limit, per connection (kept in memory; forgotten when the jam sleeps).
  allow(conn, cost) {
    const now = Date.now();
    const b = this.buckets.get(conn.id) || { n: RATE.burst, at: now, told: false };
    b.n = Math.min(RATE.burst, b.n + ((now - b.at) / 1000) * RATE.perSec);
    b.at = now;
    this.buckets.set(conn.id, b);
    if (b.n < cost) {
      if (!b.told) { b.told = true; conn.send(JSON.stringify({ t: "error", error: "Slow down a little: the jam is skipping some of your changes." })); }
      return false;
    }
    b.n -= cost;
    b.told = false;
    return true;
  }
  roomFits() {
    return size(this.room) <= MAX_ROOM;
  }
  full(conn) {
    conn.send(JSON.stringify({ t: "error", error: "This jam is full: it can't hold more. Try a smaller piece, or forget old comments." }));
  }

  // ---------- the space this jam is in ----------
  async spaceStub() {
    return this.room.space ? getServerByName(this.env.StorySpace, this.room.space.id) : null;
  }
  async setSpaceCtx(ctx) {
    this.spaceCtx = ctx;
    if (ctx) await this.ctx.storage.put("spacectx", ctx);
    else await this.ctx.storage.delete("spacectx");
    this.broadcast(JSON.stringify({ t: "space", ctx }));
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
        rules: r.rules, clapsEach: CLAPS_EACH, retain: r.retain, space: r.space,
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
    const ms = RETAIN[this.room.retain] ?? RETAIN["1y"];
    if (ms) await this.ctx.storage.setAlarm(Date.now() + ms);
    else await this.ctx.storage.deleteAlarm();
    if (withState) this.broadcastState();
  }

  // Delete everything now, and tell anyone still here.
  async wipe() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.room = fresh();
    this.rounds = [];
    this.spaceCtx = null;
    for (const c of this.conns()) { c.send(JSON.stringify({ t: "deleted" })); c.close(1000, "deleted"); }
  }

  async onAlarm() {
    await this.wipe();
  }

  async onConnect(conn, ctx) {
    const r = this.room;
    if (this.conns().length > MAX_CONNS) {
      conn.send(JSON.stringify({ t: "error", error: "This jam is full." }));
      conn.close(1013, "full");
      return;
    }
    const k = new URL(ctx.request.url).searchParams.get("k") || "";
    let role = "view";
    if (!r.keys) {
      // A new jam: whoever opens it owns it. Dropped soon unless someone joins it.
      r.keys = { edit: token(), comment: token() };
      role = "edit";
      await this.ctx.storage.put("room", r);
      await this.ctx.storage.setAlarm(Date.now() + UNJOINED);
    } else if (k && k === r.keys.edit) role = "edit";
    else if (k && k === r.keys.comment) role = "comment";
    conn.setState({ role, pid: null, sel: null, owner: role === "edit" && !r.owner });
    conn.send(JSON.stringify(this.view(conn)));
    if (r.doc) conn.send(JSON.stringify({ t: "doc", rev: r.rev, doc: r.doc }));
    if (this.spaceCtx) conn.send(JSON.stringify({ t: "space", ctx: this.spaceCtx }));
  }

  async onClose(conn) {
    this.buckets?.delete(conn.id);
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
    if (!m || typeof m !== "object" || Array.isArray(m) || typeof m.t !== "string") return;
    if (!this.allow(conn, COST[m.t] || 1)) return;
    const r = this.room;
    const role = conn.state?.role || "view";
    const can = (need) => ROLE_RANK[role] >= ROLE_RANK[need];

    if (m.t === "hello") {
      if (typeof m.pid !== "string" || !/^[\w-]{8,64}$/.test(m.pid)) return;
      const pid = await publicId(m.pid);
      // One person per connection.
      if (conn.state?.pid && conn.state.pid !== pid) return;
      if (!r.players[pid]) {
        // Room for people with keys and, separately, for viewers, so viewers can't fill a jam
        // its writers need. When full, the longest-gone person of the same kind makes way.
        const keyed = (p) => ROLE_RANK[p.role || "view"] > 0;
        const mine = role !== "view";
        const same = Object.entries(r.players).filter(([, p]) => keyed(p) === mine);
        if (same.length >= (mine ? MAX_PLAYERS : MAX_VIEWERS)) {
          const on = this.online();
          const gone = same.filter(([id]) => !on.has(id) && id !== r.owner && !r.entries[id]).sort((a, b) => a[1].joined - b[1].joined)[0];
          if (!gone) { conn.send(JSON.stringify({ t: "error", error: "This jam is full." })); return; }
          delete r.players[gone[0]];
        }
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
        const prev = r.doc;
        r.doc = m.doc;
        if (!this.roomFits()) { r.doc = prev; return this.full(conn); }
        r.rev++;
        await this.save(false);
        return this.broadcast(JSON.stringify({ t: "doc", rev: r.rev, doc: r.doc, by: pid }));
      }
      case "patch": { // editors: set a few fields of the shared piece
        if (!can("edit") || !r.doc || !m.set || typeof m.set !== "object" || Array.isArray(m.set)) return;
        const next = structuredClone(r.doc);
        for (const [path, val] of Object.entries(m.set)) {
          const [top, sub, extra] = path.split(".");
          if (extra !== undefined || !PATCH_TOP.has(top) || (sub !== undefined && !PATCH_SUB.has(top))) return;
          if (sub !== undefined && (!sub || sub.length > 64 || BAD_KEYS.has(sub))) return;
          if (sub === undefined) { if (val === null) delete next[top]; else next[top] = val; }
          else {
            if (!next[top] || typeof next[top] !== "object") next[top] = {};
            if (val === null) delete next[top][sub]; else next[top][sub] = val;
          }
        }
        if (!fits(next, MAX_DOC)) return;
        const prev = r.doc;
        r.doc = next;
        if (!this.roomFits()) { r.doc = prev; return this.full(conn); }
        r.rev++;
        await this.save(false);
        return this.broadcast(JSON.stringify({ t: "patch", rev: r.rev, set: m.set, by: pid }));
      }
      case "sync": // anyone: send me the whole piece again
        if (r.doc) conn.send(JSON.stringify({ t: "doc", rev: r.rev, doc: r.doc }));
        return;

      // ----- comments -----
      case "comment": {
        if (!can("comment")) return;
        if (r.comments.length >= MAX_COMMENTS || r.comments.filter((c) => c.pid === pid).length >= MAX_COMMENTS_EACH) {
          conn.send(JSON.stringify({ t: "error", error: "This jam has as many comments as it can hold. Resolve and delete some, or the host can forget them." }));
          return;
        }
        const text = clean(m.text, 600);
        if (!text) return;
        const entry = own(r.entries, m.entry) ? m.entry : undefined;
        r.comments.push({
          id: `c${++r.seq}`, at: typeof m.at === "string" ? clean(m.at, 120) || null : null, quote: clean(m.quote, 200),
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
        if (!this.roomFits()) { Object.assign(r, { phase: "lobby", round: r.round - 1, challenge: null }); return this.full(conn); }
        return this.save();
      case "submit": // writers: your copy; resubmitting replaces it
        if (!can("edit") || r.phase !== "play" || !fits(m.me, MAX_STORY)) return;
        const prev = r.entries[pid];
        r.entries[pid] = { name: r.players[pid].name, me: m.me };
        if (!this.roomFits()) { if (prev) r.entries[pid] = prev; else delete r.entries[pid]; return this.full(conn); }
        return this.save();
      case "vote": // host: reveal the copies for critique
        if (!isHost || r.phase !== "play" || !Object.keys(r.entries).length) return;
        r.phase = "vote";
        return this.save();
      case "clap": { // if claps are on: a few each, never for your own copy
        if (!r.rules.claps || !can("comment") || r.phase !== "vote" || !own(r.entries, m.to) || m.to === pid) return;
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
        while (this.rounds.length > 1 && size(this.rounds) > MAX_ROUNDS_BYTES) this.rounds.shift();
        await this.ctx.storage.put("rounds", this.rounds);
        const last = this.rounds[this.rounds.length - 1];
        const stub = await this.spaceStub();
        if (stub) await stub.jamRound(this.name, { round: last.round, names: entries.map((e) => e.name), top: last.top }).catch(() => {});
        return this.save();
      }
      case "lobby": // host: back to the start for another round
        if (!isHost) return;
        Object.assign(r, { phase: "lobby", challenge: null, entries: {}, claps: {} });
        return this.save();
      case "retain": // host: how long the jam is kept
        if (!isHost || !own(RETAIN, m.value)) return;
        r.retain = m.value;
        return this.save();
      case "delete": { // host: delete the jam and everything in it, now
        if (!isHost) return;
        return this.wipe();
      }
      // ----- the space -----
      case "space": { // host: open this jam inside a space, proving edit access with its key
        if (!isHost || typeof m.id !== "string" || !/^[A-Z0-9]{8}$/.test(m.id) || typeof m.k !== "string") return;
        const stub = await getServerByName(this.env.StorySpace, m.id);
        const ctx = await stub.linkJam(this.name, m.k).catch(() => null);
        if (!ctx) { conn.send(JSON.stringify({ t: "error", error: "That space didn't let this jam in. You need its edit link." })); return; }
        r.space = { id: m.id, name: clean(ctx.name, 60) };
        await this.save();
        return this.setSpaceCtx(ctx);
      }
      case "unspace": // host: take the jam out of its space
        if (!isHost || !r.space) return;
        r.space = null;
        await this.save();
        return this.setSpaceCtx(null);
      case "spacesync": { // anyone: fetch the space's grammars, lore and cast again
        const stub = await this.spaceStub();
        const ctx = stub && (await stub.jamContext(this.name).catch(() => null));
        if (ctx) return this.setSpaceCtx(ctx);
        return;
      }
      case "lore": { // commenters and editors: keep a phrase as the space's lore
        if (!can("comment")) return;
        const stub = await this.spaceStub();
        const lore = stub && (await stub.jamLore(this.name, m.entry, r.players[pid].name).catch(() => null));
        if (!lore) return;
        return this.setSpaceCtx({ ...this.spaceCtx, lore });
      }

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

// The Origin check keeps other sites' pages out; it isn't a lock (a script can send any Origin).
// Keys are the lock. Against scripts that open jams or spaces by the thousand, each address gets
// a budget a minute (Cloudflare's rate limiter: counted in memory where the request lands, for a
// minute, never stored with the jam or space).
async function limited(limiter, request) {
  if (!limiter) return false;
  const ip = request.headers.get("cf-connecting-ip") || "local";
  try { return !(await limiter.limit({ key: ip })).success; } catch { return false; }
}

// Spaces are HTTP: answered for allowed pages only, with CORS for them.
async function spaceRequest(request, env) {
  const origin = request.headers.get("Origin");
  if (!allowed(origin, env)) return new Response("Forbidden", { status: 403 });
  const cors = { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "content-type", vary: "Origin" };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (await limited(env.SPACE_LIMIT, request)) return new Response(JSON.stringify({ error: "Too many requests. Wait a minute and try again." }), { status: 429, headers: { ...cors, "content-type": "application/json" } });
  if (request.headers.get("Upgrade")) return new Response("Spaces are HTTP only.", { status: 400, headers: cors });
  const res = (await routePartykitRequest(request, env)) || new Response("Not found", { status: 404 });
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
  return out;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") return new Response("Story Bits jams. Open one from the site.", { headers: { "content-type": "text/plain" } });
    // Space ids are 8 characters from the same alphabet as jam codes.
    if (/^\/parties\/story-space\/[A-Z0-9]{8}$/.test(url.pathname)) return spaceRequest(request, env);
    // Jam codes are short and public-ish; keep them to a fixed alphabet.
    if (!/^\/parties\/story-room\/[A-Z0-9]{4,8}$/.test(url.pathname)) return new Response("Not found", { status: 404 });
    return (
      (await routePartykitRequest(request, env, {
        onBeforeConnect: async (req) => {
          if (!allowed(req.headers.get("Origin"), env)) return new Response("Forbidden", { status: 403 });
          if (await limited(env.JOIN_LIMIT, req)) return new Response("Too many jams opened. Wait a minute.", { status: 429 });
        },
        onBeforeRequest: () => new Response("Jams are WebSocket only.", { status: 400 }),
      })) || new Response("Not found", { status: 404 })
    );
  },
};
