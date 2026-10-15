// Spaces for Story Bits: persistent shared folders for a group, one Durable Object per space id.
// See docs/design.md ("Spaces").
//
// A space holds items (grammars, word packs, kept pieces, cast), lore (kept phrases), comments on
// items, and the history of jams opened in it. A grammar is a list of immutable versions: a
// publish appends version n + 1 and names the version it was edited from, so nobody overwrites
// anyone and a piece pinned to a version never changes under it.
//
// Roles come from keys: owner (settings, delete), edit, comment, view. A private space needs a
// key even to view; a public one is viewable by its id alone, which is how things get published.
// Jams linked to the space by an editor may add lore and finished rounds (see StoryRoom).
//
// HTTP only: GET for a view (or one grammar version with ?gv=gid@n), POST a JSON op. Bodies are
// text/plain so the page needs no preflight. Like the jam server, this never interprets what it
// stores: it checks shapes and sizes, and every client checks what it receives with the same
// parsers it uses for links (checkGrammar, checkEntry, parseSnapshot).
//
// What's stored, in this object's storage, in the owner's Cloudflare account: the space's name,
// keys and settings, its items and every grammar version, lore, comments (with nicknames), and a
// summary of each linked jam's rounds. No accounts, emails or IPs. How long it's kept is the
// owner's call (RETAIN: until deleted, the default, or a year or a month after it's last used).
// The owner can delete it outright any time.

import { Server } from "partyserver";

const DAY = 24 * 60 * 60 * 1000;
export const SPACE_RETAIN = { keep: null, "1y": 365 * DAY, "30d": 30 * DAY };
const ROLE_RANK = { view: 0, comment: 1, edit: 2, owner: 3 };
const KINDS = new Set(["grammar", "words", "piece", "cast"]);
const MAX_BODY = 400 * 1024;
const MAX_ITEM = 240 * 1024;
const MAX_SPACE = 6 * 1024 * 1024;
const MAX_ITEMS = 300;
const MAX_VERSIONS = 100;
const MAX_COMMENTS = 1000;
const MAX_LORE = 500;
const MAX_JAMS = 100;
const MAX_ROUNDS = 20;
// Lore and jam history are one stored value each; keep each well under a value's limit.
const MAX_LORE_BYTES = 1024 * 1024;
const MAX_JAMS_BYTES = 512 * 1024;
// Last-use is written at most this often, so reading a busy public space isn't a write each time.
const TOUCH_EVERY = 60 * 60 * 1000;

const clean = (s, n) => String(s ?? "").replace(/<[^>]*>/g, "").replace(/[{}<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const size = (x) => { try { return JSON.stringify(x).length; } catch { return Infinity; } };
const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
const own = (o, k) => typeof k === "string" && Object.hasOwn(o, k);
// Drop the oldest until a list fits.
const trim = (list, max) => { while (list.length > 1 && size(list) > max) list.shift(); return list; };
// Jam codes are enough to watch a jam (a jam's viewers need no key). Only people invited to the
// space with a comment key or better see which jams it holds.
const hideJam = ({ jam, ...l }) => l;
const token = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
const GID = /^[a-z][a-z0-9-]{1,39}$/;
const PID = /^[\w-]{8,64}$/;
const JAM = /^[A-Z0-9]{4,8}$/;

export class StorySpace extends Server {
  static options = { hibernate: true };

  async onStart() {
    this.meta = (await this.ctx.storage.get("meta")) || null;
  }

  // ---------- storage ----------
  async items() {
    return [...(await this.ctx.storage.list({ prefix: "item:" })).values()];
  }
  async list(key) {
    return (await this.ctx.storage.get(key)) || [];
  }
  async saveMeta() {
    await this.ctx.storage.put("meta", this.meta);
  }
  // Last use moves the retention clock (time-based settings only).
  async touch(force = false) {
    const m = this.meta;
    const now = Date.now();
    if (!force && now - (m.used || 0) < TOUCH_EVERY) return;
    m.used = now;
    await this.saveMeta();
    const ms = SPACE_RETAIN[m.retain];
    if (ms) await this.ctx.storage.setAlarm(now + ms);
    else await this.ctx.storage.deleteAlarm();
  }
  expiresAt() {
    const ms = SPACE_RETAIN[this.meta.retain];
    return ms ? (this.meta.used || this.meta.created) + ms : null;
  }
  // A deleted space keeps only a marker, so its id is never reused for something else.
  async wipe() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.meta = { gone: Date.now() };
    await this.saveMeta();
  }
  async onAlarm() {
    if (this.meta && !this.meta.gone && SPACE_RETAIN[this.meta.retain]) await this.wipe();
  }
  live() {
    return !!this.meta && !this.meta.gone;
  }

  roleFor(k) {
    const keys = this.meta?.keys;
    if (keys && k) for (const r of ["owner", "edit", "comment", "view"]) if (k === keys[r]) return r;
    return this.meta?.public ? "view" : null;
  }

  // ---------- views ----------
  async view(role, pid) {
    const m = this.meta;
    const items = (await this.items()).sort((a, b) => a.at - b.at);
    const comments = (await this.list("comments")).map(({ pid: by, ...c }) => ({ ...c, mine: !!pid && by === pid }));
    // Grammars come with their head version; older versions on request (?gv=).
    const heads = {};
    for (const it of items) if (it.kind === "grammar") heads[it.gid] = await this.ctx.storage.get(`gv:${it.gid}:${it.head}`);
    const keys = role === "owner" ? m.keys : role === "edit" ? { edit: m.keys.edit, comment: m.keys.comment, view: m.keys.view } : null;
    const inside = ROLE_RANK[role] >= ROLE_RANK.comment;
    const lore = await this.list("lore");
    const jams = await this.list("jams");
    return {
      id: this.name, name: m.name, public: !!m.public, retain: m.retain, created: m.created, used: m.used,
      expiresAt: this.expiresAt(), role, keys, bytes: m.bytes || 0,
      items: items.map((it) => (it.kind === "grammar" ? { ...it, data: heads[it.gid] } : it)),
      comments, lore: inside ? lore : lore.map(hideJam),
      jams: inside ? jams : jams.map(({ code, ...j }) => j),
    };
  }
  // Everything, every grammar version included: for export.
  async dump() {
    const out = await this.view("owner");
    delete out.keys;
    out.versions = {};
    for (const it of out.items) if (it.kind === "grammar") {
      out.versions[it.gid] = {};
      for (let n = 1; n <= it.head; n++) out.versions[it.gid][n] = await this.ctx.storage.get(`gv:${it.gid}:${n}`);
    }
    return out;
  }

  async onRequest(req) {
    const url = new URL(req.url);
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    if (req.method === "GET") {
      // Reads by GET are for public spaces (ids in the URL, no keys): pages send keys in a POST
      // body (ops "get" and "gv"), so keys stay out of URLs and logs. GET still takes ?k= from
      // pages that haven't reloaded since.
      if (!this.live()) return reply(404, { error: this.meta?.gone ? "This space was deleted." : "No such space." });
      const role = this.roleFor(url.searchParams.get("k") || "");
      if (!role) return reply(403, { error: "This space is private. You need an invite link." });
      await this.touch();
      const gv = url.searchParams.get("gv");
      if (gv) return this.version(gv, reply);
      const pid = url.searchParams.get("pid");
      return reply(200, { space: await this.view(role, PID.test(pid || "") ? pid : null) });
    }
    if (req.method !== "POST") return reply(405, { error: "GET or POST." });
    const raw = await req.text();
    if (raw.length > MAX_BODY) return reply(413, { error: "Too big." });
    let m;
    try { m = JSON.parse(raw); } catch { return reply(400, { error: "Not JSON." }); }
    if (!isObj(m) || typeof m.op !== "string") return reply(400, { error: "No op." });
    try {
      if (m.op === "gv") {
        if (!this.live()) return reply(404, { error: "No such space." });
        if (!this.roleFor(typeof m.k === "string" ? m.k : "")) return reply(403, { error: "This space is private. You need an invite link." });
        await this.touch();
        return this.version(m.gv, reply);
      }
      const out = await this.op(m);
      return reply(out.status || 200, out);
    } catch (e) {
      return reply(e.status || 500, { error: e.status ? e.message : "Something went wrong." });
    }
  }

  async version(gv, reply) {
    const [gid, n] = String(gv).split("@");
    const doc = GID.test(gid || "") && /^\d{1,3}$/.test(n || "") ? await this.ctx.storage.get(`gv:${gid}:${+n}`) : null;
    return doc ? reply(200, { gid, ver: +n, doc }) : reply(404, { error: "No such version." });
  }

  // ---------- ops ----------
  async op(m) {
    const fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };
    if (m.op === "create") {
      if (this.meta) fail(409, this.meta.gone ? "That id was used by a deleted space." : "That space already exists.");
      const retain = own(SPACE_RETAIN, m.retain) ? m.retain : "keep";
      const now = Date.now();
      this.meta = {
        name: clean(m.name, 60) || "A space", public: false, retain, created: now, used: now, seq: 0, bytes: 0,
        keys: { owner: token(), edit: token(), comment: token(), view: token() },
      };
      await this.touch(true);
      return { status: 201, space: await this.view("owner") };
    }
    if (!this.live()) fail(404, this.meta?.gone ? "This space was deleted." : "No such space.");
    const role = this.roleFor(typeof m.k === "string" ? m.k : "");
    const can = (need) => role && ROLE_RANK[role] >= ROLE_RANK[need];
    if (!can("view")) fail(403, "This space is private. You need an invite link.");
    const pid = typeof m.pid === "string" && PID.test(m.pid) ? m.pid : null;
    const name = clean(m.name, 24);
    const done = async () => { await this.touch(true); return { space: await this.view(role, pid) }; };

    switch (m.op) {
      case "get": // a read: moves the retention clock at most hourly, like GET
        await this.touch();
        return { space: await this.view(role, pid) };
      case "export":
        if (!can("edit")) fail(403, "Editors can export a space.");
        await this.touch(true);
        return { dump: await this.dump() };

      // ----- items (editors) -----
      case "put": {
        if (!can("edit")) fail(403, "You can view this space, not change it.");
        const it = m.item;
        if (!isObj(it) || !KINDS.has(it.kind) || !isObj(it.data)) fail(400, "An item is { kind, name, data }.");
        const bytes = size(it.data);
        if (bytes > MAX_ITEM) fail(413, "That item is too big (240 KB max).");
        if ((this.meta.bytes || 0) + bytes > MAX_SPACE) fail(413, "This space is full (6 MB). Remove something or start another.");
        const now = Date.now();
        if (it.kind === "grammar") {
          // A new version of a grammar, never an overwrite. `base` is the version it was edited
          // from (0 for a new grammar); if someone published since, refuse.
          const gid = it.data.id;
          if (typeof gid !== "string" || !GID.test(gid)) fail(400, "A grammar needs a short lowercase id.");
          const key = `item:g.${gid}`;
          const prev = await this.ctx.storage.get(key);
          const base = Number.isInteger(it.base) ? it.base : 0;
          if ((prev?.head || 0) !== base) fail(409, prev ? `Someone published version ${prev.head} of this grammar since you started from version ${base}.` : "This grammar isn't in the space any more.");
          if (!prev && (await this.items()).length >= MAX_ITEMS) fail(413, "This space has as many items as it can hold.");
          if (prev && prev.head >= MAX_VERSIONS) fail(413, "This grammar has 100 versions. Fork it to keep going.");
          const head = (prev?.head || 0) + 1;
          await this.ctx.storage.put(`gv:${gid}:${head}`, it.data);
          await this.ctx.storage.put(key, {
            id: `g.${gid}`, kind: "grammar", gid, name: clean(it.data.name, 40) || gid, head,
            note: clean(it.note, 200), by: name || prev?.by || "", at: prev?.at || now, updated: now,
          });
        } else {
          const id = typeof it.id === "string" && /^i\d{1,6}$/.test(it.id) ? it.id : `i${++this.meta.seq}`;
          const prev = await this.ctx.storage.get(`item:${id}`);
          if (!prev && it.id) fail(404, "That item isn't in the space any more.");
          if (prev && prev.kind !== it.kind) fail(400, "An item keeps its kind.");
          if (!prev && (await this.items()).length >= MAX_ITEMS) fail(413, "This space has as many items as it can hold.");
          this.meta.bytes = (this.meta.bytes || 0) - (prev ? size(prev.data) : 0);
          await this.ctx.storage.put(`item:${id}`, {
            id, kind: it.kind, name: clean(it.name, 80) || it.kind, data: it.data,
            by: name || prev?.by || "", at: prev?.at || now, updated: now,
          });
        }
        this.meta.bytes = (this.meta.bytes || 0) + bytes;
        await this.saveMeta();
        return done();
      }
      case "remove": { // editors; in a public space, this is how the owner takes something down
        if (!can("edit")) fail(403, "You can view this space, not change it.");
        const id = String(m.id || "");
        const it = await this.ctx.storage.get(`item:${id}`);
        if (!it) fail(404, "That item isn't in the space.");
        let freed = it.kind === "grammar" ? 0 : size(it.data);
        if (it.kind === "grammar") for (let n = 1; n <= it.head; n++) {
          freed += size(await this.ctx.storage.get(`gv:${it.gid}:${n}`));
          await this.ctx.storage.delete(`gv:${it.gid}:${n}`);
        }
        await this.ctx.storage.delete(`item:${id}`);
        this.meta.bytes = Math.max(0, (this.meta.bytes || 0) - freed);
        const comments = (await this.list("comments")).filter((c) => c.item !== id);
        await this.ctx.storage.put("comments", comments);
        await this.saveMeta();
        return done();
      }

      // ----- lore: kept phrases -----
      case "lore": {
        if (!can("edit")) fail(403, "Editors keep lore.");
        await this.addLore(m.entry, name, null);
        return done();
      }
      case "unlore": {
        if (!can("edit")) fail(403, "Editors keep lore.");
        await this.ctx.storage.put("lore", (await this.list("lore")).filter((l) => l.id !== m.id));
        return done();
      }

      // ----- comments -----
      case "comment": {
        if (!can("comment")) fail(403, "You can view this space, not comment.");
        const comments = await this.list("comments");
        if (comments.length >= MAX_COMMENTS) fail(413, "This space has as many comments as it can hold.");
        const text = clean(m.text, 600);
        const item = String(m.item || "");
        if (!text || !(await this.ctx.storage.get(`item:${item}`))) fail(400, "A comment needs text and an item.");
        this.meta.seq++;
        comments.push({ id: `c${this.meta.seq}`, item, text, name, pid, ts: Date.now() });
        await this.ctx.storage.put("comments", comments);
        await this.saveMeta();
        return done();
      }
      case "uncomment": { // your own, or an editor's call
        const comments = await this.list("comments");
        const c = comments.find((x) => x.id === m.id);
        if (!c || !(can("edit") || (pid && c.pid === pid))) fail(403, "Not yours to delete.");
        await this.ctx.storage.put("comments", comments.filter((x) => x !== c));
        return done();
      }

      // ----- owner settings -----
      case "settings": {
        if (!can("owner")) fail(403, "Only the owner changes a space's settings.");
        if (m.name !== undefined) this.meta.name = clean(m.name, 60) || this.meta.name;
        if (typeof m.public === "boolean") this.meta.public = m.public;
        if (m.retain !== undefined) {
          if (!own(SPACE_RETAIN, m.retain)) fail(400, "Keep it until deleted, for a year, or for a month after last use.");
          this.meta.retain = m.retain;
        }
        await this.saveMeta();
        return done();
      }
      case "delete": {
        if (!can("owner")) fail(403, "Only the owner deletes a space.");
        await this.wipe();
        return { deleted: true };
      }
    }
    fail(400, "Unknown op.");
  }

  async addLore(e, name, jam) {
    if (!isObj(e)) { const err = new Error("Lore is a kept phrase."); err.status = 400; throw err; }
    const text = clean(e.text, 200);
    if (!text) { const err = new Error("Lore needs text."); err.status = 400; throw err; }
    const lore = await this.list("lore");
    if (lore.some((l) => l.text.toLowerCase() === text.toLowerCase())) return lore;
    this.meta.seq++;
    const entry = {
      id: `l${this.meta.seq}`, text, card: clean(e.card, 30), label: clean(e.label, 30),
      g: typeof e.g === "string" && GID.test(e.g) ? e.g : null,
      // The phrase itself (word values), so a jam can drop it back into a piece. Opaque here.
      ...(isObj(e.ph) && size(e.ph) <= 2 * 1024 && { ph: e.ph }),
      by: clean(name, 24), ...(jam && { jam }), ts: Date.now(),
    };
    lore.push(entry);
    const kept = trim(lore.slice(-MAX_LORE), MAX_LORE_BYTES);
    await this.ctx.storage.put("lore", kept);
    await this.saveMeta();
    return kept;
  }

  // ---------- jams (RPC from StoryRoom) ----------
  // Grammars, lore and cast: what a jam in this space draws from.
  async context() {
    const items = await this.items();
    const grammars = [];
    for (const it of items) if (it.kind === "grammar") grammars.push({ gid: it.gid, name: it.name, ver: it.head, doc: await this.ctx.storage.get(`gv:${it.gid}:${it.head}`) });
    return {
      id: this.name, name: this.meta.name, public: !!this.meta.public, grammars,
      cast: items.filter((it) => it.kind === "cast").map((it) => ({ id: it.id, name: it.name, data: it.data })),
      lore: (await this.list("lore")).map(hideJam),
    };
  }
  // The jam's host proves they can edit the space; the space remembers the jam.
  async linkJam(code, k) {
    if (!this.live() || !JAM.test(String(code))) return null;
    const role = this.roleFor(k);
    if (!role || ROLE_RANK[role] < ROLE_RANK.edit) return null;
    const jams = await this.list("jams");
    if (!jams.some((j) => j.code === code)) {
      jams.push({ code, at: Date.now(), rounds: [] });
      await this.ctx.storage.put("jams", trim(jams.slice(-MAX_JAMS), MAX_JAMS_BYTES));
    }
    await this.touch(true);
    return this.context();
  }
  async linked(code) {
    return this.live() && (await this.list("jams")).some((j) => j.code === code);
  }
  async jamContext(code) {
    return (await this.linked(code)) ? this.context() : null;
  }
  async jamLore(code, entry, name) {
    if (!(await this.linked(code))) return null;
    try { await this.addLore(entry, name, code); } catch { return null; }
    await this.touch();
    return (await this.list("lore")).map(hideJam);
  }
  async jamRound(code, round) {
    if (!(await this.linked(code)) || !isObj(round)) return false;
    const jams = await this.list("jams");
    const j = jams.find((x) => x.code === code);
    j.rounds = [...j.rounds, {
      at: Date.now(), round: Number.isInteger(round.round) ? round.round : 0,
      names: (Array.isArray(round.names) ? round.names : []).slice(0, 24).map((n) => clean(n, 24)),
      top: (Array.isArray(round.top) ? round.top : []).slice(0, 24).map((n) => clean(n, 24)),
    }].slice(-MAX_ROUNDS);
    await this.ctx.storage.put("jams", trim(jams, MAX_JAMS_BYTES));
    await this.touch();
    return true;
  }
}
