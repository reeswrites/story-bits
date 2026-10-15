// Grammar edit operations: the engine half of "edit the grammar from the picker". Pure: every
// operation takes a grammar and returns a new one with a human label, or an error; nothing is
// mutated, nothing touches the DOM or storage. A plain script loaded after engine.js (it uses
// checkGrammar, checkEntry, poolEntry and cleanWord from grammar.js) and exposed as
// window.grammarOps. See docs/design.md ("Editing a grammar from the picker").
//
// The rule behind every op: pool indices never shift. Saved pieces, links and snapshots name a word
// by its index in its slot's pool, so a removed word stays in place as a tombstone ({ ..., retired:
// true }): the engine never offers it, but a snapshot that holds its index still renders it.
//
// Result shape: { grammar, label } on success, { error } when the edit is refused or would leave an
// invalid grammar (every result has passed checkGrammar). forkOnWrite and apply add { forked, from }.

(function () {
  const POOL_MAX = 300; // checkGrammar's limit; tombstones count, because they keep their place
  const SUFFIX = " (yours)";
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const fail = (error) => ({ error });
  const q = (t) => `'${t}'`;

  // ---------- lookups ----------
  const cardOf = (g, key) => g?.cards?.find((c) => c.key === key);
  const partOfG = (g, card, k) => g?.schemas?.[card]?.parts?.find((p) => p.k === k);
  const where = (g, card, part) => `${cardOf(g, card).label} · ${part.name}`;

  // Run edit(draft, ...) on a copy and check the result. edit returns the label, or { error }.
  function run(g, edit) {
    if (!g || typeof g !== "object" || !g.schemas) return fail("not a grammar");
    const draft = copy(g);
    let label;
    try { label = edit(draft); } catch (e) { return fail(String(e.message || e)); }
    if (label && typeof label === "object") return label;
    const err = checkGrammar(draft);
    return err ? fail(err) : { grammar: draft, label };
  }
  // Find a slot, or throw a plain-language reason.
  function slotIn(g, card, k) {
    if (!cardOf(g, card)) throw new Error(`there's no card “${card}”`);
    const part = partOfG(g, card, k);
    if (!part) throw new Error(`there's no slot “${k}” on ${cardOf(g, card).label}`);
    return part;
  }
  function wordIn(g, card, k, index) {
    const part = slotIn(g, card, k);
    const w = Number.isInteger(index) ? part.pool[index] : null;
    if (!w) throw new Error("there's no word at that place");
    return { part, w };
  }

  // ---------- words ----------
  // entry: { t, tier, v?, det?, pr? } as checkEntry takes it (s and k are filled in). A word that
  // matches a retired one brings it back at its old index instead of adding a second copy.
  function addWord(g, card, slot, entry) {
    return run(g, (d) => {
      const part = slotIn(d, card, slot);
      const e = { ...entry, s: card, k: slot };
      delete e.g;
      if (typeof e.t === "string") e.t = cleanWord(e.t);
      const why = checkEntry(e, d);
      if (why) throw new Error(why);
      const word = poolEntry(e, d);
      const at = part.pool.findIndex((p) => p.t.toLowerCase() === e.t.toLowerCase());
      if (at >= 0 && !part.pool[at].retired) throw new Error(`${q(e.t)} is already in ${where(d, card, part)}`);
      if (at >= 0) part.pool[at] = word;
      else if (part.pool.length >= POOL_MAX) throw new Error(`${where(d, card, part)} is full (${POOL_MAX} words)`);
      else part.pool.push(word);
      return `added ${q(e.t)} to ${where(d, card, part)}`;
    });
  }
  // Retires the word at index: a tombstone, so every other index stays where it is.
  function removeWord(g, card, slot, index) {
    return run(g, (d) => {
      const { part, w } = wordIn(d, card, slot, index);
      if (w.retired) throw new Error(`${q(w.t)} is already removed`);
      w.retired = true;
      return `removed ${q(w.t)} from ${where(d, card, part)}`;
    });
  }
  // Undo of removeWord.
  function restoreWord(g, card, slot, index) {
    return run(g, (d) => {
      const { part, w } = wordIn(d, card, slot, index);
      if (!w.retired) throw new Error(`${q(w.t)} isn't removed`);
      delete w.retired;
      return `restored ${q(w.t)} to ${where(d, card, part)}`;
    });
  }
  // Edit a word's tags: register (tier), mood (v), starting word (det), pronouns (pr: he/she/they).
  // Its text and place stay, so pieces that use it still point at it. null clears nothing: a slot's
  // own flags say which tags a word needs.
  function setWordTags(g, card, slot, index, tags) {
    return run(g, (d) => {
      const { part, w } = wordIn(d, card, slot, index);
      if (w.retired) throw new Error(`${q(w.t)} is removed; restore it first`);
      const asEntry = { s: card, k: slot, t: w.t, tier: w.tier };
      if (w.v !== undefined) asEntry.v = w.v;
      if (w.det !== undefined) asEntry.det = w.det;
      if (part.pronouns) asEntry.pr = w.p === "he" ? "he" : w.p === "she" ? "she" : "they";
      const next = { ...asEntry };
      for (const key of ["tier", "v", "det", "pr"]) if (tags && key in tags) next[key] = tags[key];
      if (tags && Object.keys(tags).some((k) => !["tier", "v", "det", "pr"].includes(k))) throw new Error("tags are register, mood, starting word and pronouns");
      const why = checkEntry(next, d);
      if (why) throw new Error(why);
      const rebuilt = poolEntry(next, d);
      for (const key of Object.keys(w)) if (!(key in rebuilt)) delete w[key];
      Object.assign(w, rebuilt);
      const bits = ["tier", "v", "det", "pr"].filter((k) => tags && k in tags).map((k) => (k === "tier" ? TIER_NAMES[next.tier] : k === "v" ? `${MOOD_NAMES[next.v]} mood` : k === "det" ? `starts with ${next.det}` : `pronouns ${next.pr}`));
      return `retagged ${q(w.t)} in ${where(d, card, part)}${bits.length ? `: ${bits.join(", ")}` : ""}`;
    });
  }
  // The starting words a slot's words may take ("your", "my"). Words in use keep theirs: a live
  // word whose starting word would go is refused, so retag it first.
  function setDeterminers(g, card, slot, list) {
    return run(g, (d) => {
      const part = slotIn(d, card, slot);
      if (!part.det) throw new Error(`${where(d, card, part)} has no starting words`);
      if (!Array.isArray(list)) throw new Error("starting words are a list");
      const det = [...new Set(list.map((x) => cleanWord(x)).filter(Boolean))];
      if (!det.length) throw new Error("keep at least one starting word");
      const stuck = part.pool.find((w) => !w.retired && !det.includes(w.det));
      if (stuck) throw new Error(`${q(stuck.t)} still starts with ${q(stuck.det)}; change that word first`);
      part.det = det;
      return `set starting words of ${where(d, card, part)} to ${det.join(", ")}`;
    });
  }

  // ---------- slots ----------
  const LETTERS = "abcdefghijklmnopqrstuvwxyz";
  // def: { name, pool, k?, needs?, det?, mood?, pronouns?, trailing? }. A new slot is always
  // optional, so a piece made before it still works. position: 0..n in reading order (default end).
  function addSlot(g, card, def, position) {
    return run(g, (d) => {
      if (!cardOf(d, card)) throw new Error(`there's no card “${card}”`);
      if (!def || typeof def !== "object") throw new Error("a slot needs a name and words");
      const parts = d.schemas[card].parts;
      const k = def.k ?? [...LETTERS].find((c) => c !== "n" && !parts.some((p) => p.k === c));
      if (!k || k === "n" || parts.some((p) => p.k === k)) throw new Error(`slot key “${k}” is taken`);
      const part = { k, name: cleanWord(def.name), opt: true };
      for (const f of ["needs", "det", "mood", "pronouns", "trailing"]) if (def[f] !== undefined) part[f] = copy(def[f]);
      part.pool = copy(def.pool || []);
      const at = position === undefined ? parts.length : position;
      if (!Number.isInteger(at) || at < 0 || at > parts.length) throw new Error(`position is 0–${parts.length}`);
      parts.splice(at, 0, part);
      if (Array.isArray(d.schemas[card].grow) && def.grow !== false) d.schemas[card].grow.push(k);
      return `added slot ${q(part.name)} to ${cardOf(d, card).label}`;
    });
  }
  // Only optional slots can go; the required head ("n") can't. Words in the slot go with it, so a
  // piece that filled it needs remapPiece to drop the value (an unfilled optional slot is fine).
  function removeSlot(g, card, k) {
    return run(g, (d) => {
      const part = slotIn(d, card, k);
      if (k === "n" || !part.opt) throw new Error(`${part.name} is required on ${cardOf(d, card).label}; only optional slots can go`);
      const dependent = d.schemas[card].parts.find((p) => p.needs === k);
      if (dependent) throw new Error(`${dependent.name} needs ${part.name}; remove it first`);
      const sc = d.schemas[card];
      sc.parts = sc.parts.filter((p) => p.k !== k);
      if (Array.isArray(sc.grow)) sc.grow = sc.grow.filter((x) => x !== k);
      return `removed slot ${q(part.name)} from ${cardOf(d, card).label}`;
    });
  }

  // ---------- fork on write ----------
  // Is this grammar yours to edit in place? Only a grammar in your library is. ctx.library defaults
  // to the page's `library`; built-ins, pack grammars (shared) and space versions are not.
  function isLocal(g, ctx = {}) {
    const lib = ctx.library ?? (typeof library !== "undefined" ? library : {});
    return !!lib[g.id] && !g.shared && !(typeof GRAMMARS !== "undefined" && GRAMMARS[g.id]);
  }
  function freshId(g, ctx = {}) {
    const lib = ctx.library ?? (typeof library !== "undefined" ? library : {});
    const taken = (id) => !!lib[id] || (typeof GRAMMARS !== "undefined" && !!GRAMMARS[id]);
    const base = (cleanWord(g.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || "grammar");
    const rand = ctx.rand || Math.random;
    let id;
    do { id = `${base}-${Math.floor(rand() * 1679616).toString(36).padStart(4, "0")}`.replace(/^[^a-z]+/, "g-"); } while (taken(id));
    return id;
  }
  // A grammar you may edit: g itself if it's local, else a copy of it with a new id, forkedFrom the
  // original, named "<name> (yours)", with shared/pack/space marks dropped. The original is never
  // touched. Returns { grammar, label, forked, from? }.
  function forkOnWrite(g, ctx = {}) {
    if (!g || typeof g !== "object" || !g.schemas) return fail("not a grammar");
    if (isLocal(g, ctx)) return { grammar: g, label: "", forked: false };
    const c = copy(g);
    delete c.shared; delete c.upstream;
    for (const f of Object.values(c.forms || {})) delete f.pack;
    c.name = `${cleanWord(g.name).slice(0, 40 - SUFFIX.length)}${SUFFIX}`;
    c.id = freshId(g, ctx);
    c.forkedFrom = g.id;
    const err = checkGrammar(c);
    return err ? fail(err) : { grammar: c, label: `made your own copy of ${q(g.name)}`, forked: true, from: g.id };
  }
  // Fork if needed, then apply an op (by name) to the result: { grammar, label, forked, from? }.
  function apply(g, op, ...args) {
    if (typeof api[op] !== "function" || ["forkOnWrite", "apply", "remapPiece", "isLocal"].includes(op)) return fail(`no such edit “${op}”`);
    const ctx = args.length && args[args.length - 1]?.__ctx ? args.pop().__ctx : {};
    const f = forkOnWrite(g, ctx);
    if (f.error) return f;
    const r = api[op](f.grammar, ...args);
    if (r.error) return r;
    return { ...r, forked: f.forked, ...(f.forked && { from: f.from }), ...(f.forked && { label: `${r.label} (in your own copy)` }) };
  }

  // ---------- remapping a piece ----------
  // Carry a piece snapshot (as engine.snapshot() makes it) from the grammar it was made in, oldG,
  // onto the edited newG, so the open piece stays the same. Indices never shift, so values carry
  // over as they are; a removed slot's value is dropped (with its pins). The grammar fields are
  // rewritten: newG's id, and either a pinned version (opts.ref = { sp, ver, pub }, for a space
  // grammar: v4, with the grammar inline unless the space is public) or the grammar inline (gx),
  // plus opts.lv, the local version number (timeline.js) the edit was saved as.
  // Returns { snapshot } or { error } if the piece wouldn't parse on newG.
  function remapPiece(snap, oldG, newG, opts = {}) {
    if (!snap || !snap.p) return fail("not a piece");
    const cut = (schema, ph) => {
      const parts = newG.schemas[schema]?.parts;
      const out = { ...ph, w: {} };
      if (ph.sub) out.sub = {};
      for (const k of Object.keys(ph.w)) {
        const gone = !parts?.some((p) => p.k === k);
        if (gone) continue;
        out.w[k] = ph.w[k];
        if (ph.sub?.[k]) {
          const val = ph.w[k];
          const text = typeof val === "number" ? partOfG(oldG, schema, k)?.pool[val]?.t : val?.c;
          const inner = [...String(text || "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).find((c) => oldG.schemas[c]);
          out.sub[k] = inner ? cut(inner, ph.sub[k]) : ph.sub[k];
        }
      }
      if (out.sub && !Object.keys(out.sub).length) delete out.sub;
      return out;
    };
    const next = copy(snap);
    for (const c of Object.keys(next.p)) if (newG.schemas[c]) next.p[c] = cut(c, next.p[c]);
    const live = (pin) => {
      const [slot, path] = pin.split("|");
      if (slot === "beat") return !!newG.forms[next.f]?.beats[path];
      let ph = next.p[slot];
      const keys = String(path).split(".");
      for (const k of keys.slice(0, -1)) ph = ph?.sub?.[k];
      return !!ph && keys[keys.length - 1] in ph.w;
    };
    next.pn = (next.pn || []).filter(live);
    for (const f of ["v", "g", "gs", "gv", "gx", "lv"]) delete next[f];
    const ref = opts.ref;
    // A local version pin (lv) named the old grammar's version: drop it, or pin the new one if the
    // caller saved the edit as version opts.lv.
    if (!ref && Number.isInteger(opts.lv)) next.lv = opts.lv;
    Object.assign(next, ref ? { v: 4, g: newG.id, gs: ref.sp, gv: ref.ver, ...(!ref.pub && { gx: newG }) } : { v: 3, g: newG.id, gx: newG });
    // The piece must still be valid on newG (checked against newG itself, not whatever the
    // registry holds under that id).
    const fits = typeof withGrammar === "function" && typeof validPhrase === "function"
      ? withGrammar(newG, () => newG.cards.every((c) => validPhrase(c.key, next.p[c.key], 0)) && !!newG.forms[next.f] && next.l <= newG.forms[next.f].stanzas.length)
      : true;
    if (!fits) return fail("the piece doesn't fit the edited grammar");
    return { snapshot: next };
  }

  const api = { addWord, removeWord, restoreWord, setWordTags, setDeterminers, addSlot, removeSlot, forkOnWrite, apply, remapPiece, isLocal };
  if (typeof window !== "undefined") window.grammarOps = api;
  if (typeof globalThis !== "undefined") globalThis.grammarOps = api;
})();
