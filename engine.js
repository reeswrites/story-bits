// The Story Bits engine: grammars in use, phrases, the dial, beats, snapshots and links. Pure:
// no DOM, no storage. A plain script loaded after data.js and grammar.js, before the UI scripts
// (library.js, jam.js, spaces.js, app.js), which share its globals. Tests load it in node (test/).
//
// The engine knows nothing about any one grammar: cards, slots, word pools, the headline line,
// forms and the dial's rules all come from the active grammar (GRAMMARS in data.js, or the
// library). See docs/design.md.

// The active grammar, and the parts of it the engine reads most. useGrammar() swaps them.
let G, SLOTS, SCHEMAS, FORMS, PAIRS, MAX_DEPTH, DIAL_NOTES;
function useGrammar(g) {
  G = g;
  SLOTS = g.cards;
  SCHEMAS = g.schemas;
  FORMS = g.forms;
  PAIRS = g.rules.pairs;
  MAX_DEPTH = g.maxDepth;
  DIAL_NOTES = g.rules.dialNotes;
}
// Run fn with another grammar active, then put the current one back.
function withGrammar(g, fn) {
  const prev = G;
  if (g === prev) return fn();
  useGrammar(g);
  try { return fn(); } finally { useGrammar(prev); }
}

// Your grammars and words, which app.js loads from and saves to this browser. Built-in grammars
// are in GRAMMARS; library holds forks and imports, bank your own words (entries, as in checkEntry).
let library = {};
let bank = [];
useGrammar(GRAMMARS["story-bits"]);

// The piece's shape comes from its form: each length is a stanza that says which cards are in
// play and which beats fill each paragraph.
const form = () => FORMS[state.form] || Object.values(FORMS)[0];
const stanza = () => form().stanzas[state.len - 1];
const maxLen = () => form().stanzas.length;

// Incongruity is counted in pairs (rules.pairs). Each pair of cards in play fits or clashes:
// on mood (good / mixed / bad), on register (plausible / odd / absurd: a phrase's register is its
// strangest word), or on sound (whether the two phrases start with the same letter).
function clashes(pair, pick = state.pick) {
  if (pair.on === "mood") return phraseV(pair.a, pick[pair.a]) !== phraseV(pair.b, pick[pair.b]);
  if (pair.on === "sound") return phraseSound(pair.a, pick[pair.a]) !== phraseSound(pair.b, pick[pair.b]);
  return phraseTier(pair.a, pick[pair.a]) !== phraseTier(pair.b, pick[pair.b]);
}
// Which pairs the dial wants clashing: none, just the first, or all.
const wantClash = (i) => state.dial === 2 || (state.dial === 1 && i === 0);
const pairsInPlay = () => PAIRS.filter((p) => stanza().slots.includes(p.a) && stanza().slots.includes(p.b));

const state = {
  pick: {},
  dial: 1,
  len: 2,
  form: "bit",
  grammar: "story-bits",
  seed: 1,
  beats: {}, // beat key -> line index, for beats tuned by hand (the rest come from the seed)
  pins: [], // "slot|path" for words and "beat|key" for beats that survive shuffles
  sel: null, // { slot, path, occ } for a word, or { beat } for a beat, open in the picker
};

// ---------- small helpers ----------
// All generation draws from rng, so a seeded day (the daily bit) comes out the same for everyone.
let rng = Math.random;
const rand = (n) => Math.floor(rng() * n);
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
function choose(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
const clone = (x) => JSON.parse(JSON.stringify(x));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// UTF-8 safe base64url, for links that carry your own words.
const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));


// ---------- word bank entries ----------
const partOf = (schema, k) => SCHEMAS[schema].parts.find((p) => p.k === k);
// Bank words belong to a grammar (g); older ones, from before grammars, belong to Story Bits.
const gOf = (e) => e.g || "story-bits";
const sameWord = (a, b) => gOf(a) === gOf(b) && a.s === b.s && a.k === b.k && a.t.toLowerCase() === b.t.toLowerCase();
const builtinHas = (e, g = G) => !!partIn(g, e.s, e.k)?.pool.some((p) => p.t.toLowerCase() === e.t.toLowerCase());
// A bank word inside a phrase is carried inline, so a shared story works without the bank.
const asValue = (e) => ({ c: e.t, tier: e.tier, ...(e.v !== undefined && { v: e.v }), ...(e.det && { det: e.det }), ...(e.pr && { pr: e.pr }) });
const asEntry = (s, k, v) => ({ s, k, t: v.c, tier: v.tier, ...(v.v !== undefined && { v: v.v }), ...(v.det && { det: v.det }), ...(v.pr && { pr: v.pr }) });

// ---------- phrases ----------
// A phrase is { w: { slotKey: value }, sub: { slotKey: phrase }, x? }. A value is an index
// into the slot's pool, or { c: text, tier, ... } for one of your own words. Absent optional
// slots have no key. sub holds the nested phrase for a word whose text names a card ({thing}).
// x marks a phrase nested in a noun card's trailing clause: it may not take a trailing slot.
function entryOf(schema, k, val) {
  if (typeof val === "number") return partOf(schema, k).pool[val];
  return { ...poolEntry(asEntry(schema, k, val), G), custom: true };
}
const word = (schema, ph, k) => entryOf(schema, k, ph.w[k]);
// The card a word nests, if its text names one ({thing}), else null.
function nestKey(entry) {
  for (const m of entry.t.matchAll(/\{(\w+)\}/g)) if (SCHEMAS[m[1]]) return m[1];
  return null;
}
const nests = (entry) => !!nestKey(entry);
const subSchema = (schema, ph, k) => nestKey(word(schema, ph, k));

function phraseTier(schema, ph) {
  let t = 0;
  for (const k in ph.w) t = Math.max(t, word(schema, ph, k).tier);
  for (const k in ph.sub || {}) t = Math.max(t, phraseTier(subSchema(schema, ph, k), ph.sub[k]));
  return t;
}
// A card's mood is its head word's; cards without moods have none.
const phraseV = (schema, ph) => word(schema, ph, "n").v;
// A phrase's sound, for sound pairs: the first letter of its first word, past any determiner.
function phraseSound(schema, ph) {
  const t = tokens(schema, ph, person(), schema).find((x) => x.word !== undefined);
  return (t?.word || "").trim().charAt(0).toLowerCase();
}

// Can this slot be filled, given the rest of the phrase?
function allowed(schema, ph, part) {
  if (part.trailing && ph.x) return false;
  if (!part.needs) return true;
  if (part.needs === "adj") return !!word(schema, ph, "n").adj;
  return part.needs in ph.w;
}
// Every value a slot can take at this depth: the grammar's words that pass its constraints,
// then your bank's words for this grammar (unless the grammar is closed).
function options(schema, part, depth) {
  const out = part.pool.map((_, i) => i).filter((i) => (depth < MAX_DEPTH || !nests(part.pool[i])) && entryAllowed(part.pool[i], G));
  if (!state.shared && !grammarClosed(G)) for (const e of bank) if (gOf(e) === G.id && e.s === schema && e.k === part.k && !checkEntry(e, G)) out.push(asValue(e));
  // A constraint that rules out every word in a required slot: fall back to the whole pool.
  if (!out.length && !part.opt) return part.pool.map((_, i) => i).filter((i) => depth < MAX_DEPTH || !nests(part.pool[i]));
  return out;
}

// Set a word, growing or dropping its nested thing as needed, then drop anything it orphaned.
function setWord(schema, ph, k, val, depth) {
  ph.w[k] = val;
  const inner = nestKey(entryOf(schema, k, val));
  if (inner) {
    ph.sub = ph.sub || {};
    ph.sub[k] = randomPhrase(inner, depth + 1, undefined, !!(SCHEMAS[schema].noun && partOf(schema, k).trailing));
  } else if (ph.sub) delete ph.sub[k];
  tidy(schema, ph);
  return ph;
}
function dropWord(schema, ph, k) {
  delete ph.w[k];
  if (ph.sub) delete ph.sub[k];
  tidy(schema, ph);
}
function tidy(schema, ph) {
  for (const p of SCHEMAS[schema].parts) if (p.k in ph.w && !allowed(schema, ph, p)) dropWord(schema, ph, p.k);
  if (ph.sub && !Object.keys(ph.sub).length) delete ph.sub;
}

// Which optional slots are filled. Nested things are kept a little shorter.
function randomShape(schema, depth = 0) {
  const shape = {};
  for (const p of SCHEMAS[schema].parts) if (p.opt) shape[p.k] = rng() < (depth ? 0.35 : 0.5);
  return shape;
}
const shapeOf = (ph) => Object.fromEntries(Object.keys(ph.w).map((k) => [k, true]));

function randomPhrase(schema, depth = 0, shape = randomShape(schema, depth), x = false) {
  const ph = { w: {} };
  if (x) ph.x = 1;
  const parts = SCHEMAS[schema].parts;
  // Required slots first, so "needs" can be checked against them.
  const order = [...parts.filter((p) => !p.opt), ...parts.filter((p) => p.opt && !p.needs), ...parts.filter((p) => p.needs)];
  for (const p of order) {
    if ((p.opt && !shape[p.k]) || !allowed(schema, ph, p)) continue;
    const ok = options(schema, p, depth);
    if (ok.length) setWord(schema, ph, p.k, ok[rand(ok.length)], depth);
  }
  return ph;
}

// Walk a path of slot keys down through nested phrases to the phrase holding the last key.
// Returns null if the path no longer exists.
function locate(slot, top, path) {
  let ph = top, schema = slot;
  for (const k of path.slice(0, -1)) {
    if (!ph.sub || !ph.sub[k] || !(k in ph.w)) return null;
    const inner = subSchema(schema, ph, k);
    if (!inner) return null;
    ph = ph.sub[k];
    schema = inner;
  }
  return { ph, schema, depth: path.length - 1, k: path[path.length - 1] };
}

// ---------- text ----------
const PRONOUN_KEYS = { p: 1, o: 1, pos: 1, is: 1, has: 1, was: 1, s: 1 };
const pron = (t, who) => t.replace(/\{(\w+)\}/g, (m, k) => (k in PRONOUN_KEYS ? who[k] : m));

// A phrase as tokens: plain text, tunable words (with a path), nested groups, and, for the
// phrase holding the selected word, ghost slots where an optional word could go.
// A path lists slot keys from the card down: ["c", "q"] = the quality of the thing nested
// in the clause.
function tokens(schema, ph, who, slot, path = [], ghosts = false) {
  const sel = state.sel;
  const ghostHere = ghosts && !state.view && sel && sel.slot === slot && same(sel.path.slice(0, -1), path);
  const out = [];
  for (const p of SCHEMAS[schema].parts) {
    const at = [...path, p.k];
    if (!(p.k in ph.w)) {
      if (ghostHere && p.opt && allowed(schema, ph, p)) out.push({ ghost: p, path: at });
      continue;
    }
    const text = pron(word(schema, ph, p.k).t, who);
    const inner = nestKey({ t: text });
    if (inner && ph.sub?.[p.k]) {
      const [before, after] = text.split(`{${inner}}`);
      // A word that is only a nested card still gets a handle, so it can be tuned.
      out.push({ word: before.trim(), part: p, path: at });
      out.push({ group: tokens(inner, ph.sub[p.k], who, slot, at, ghosts), path: at });
      if (after.trim()) out.push({ text: after.trim() });
    } else out.push({ word: text, part: p, path: at });
  }
  // Determiner: an article card takes a/an; a head word with a determiner brings its own.
  let det = SCHEMAS[schema].article ? "a" : partOf(schema, "n").det ? word(schema, ph, "n").det || "" : "";
  // "a"/"an" agree with the next word, also after a preposition ("under an old stair").
  if (/(^|\s)an?$/.test(det)) det = det.replace(/an?$/, /^[aeiou]/i.test(firstText(out)) ? "an" : "a");
  if (det) out.unshift({ text: det });
  return out;
}
function firstText(toks) {
  for (const t of toks) {
    if (t.ghost || t.word === "") continue;
    return t.group ? firstText(t.group) : t.word ?? t.text;
  }
  return "";
}
const flat = (toks) => toks.filter((t) => !t.ghost && t.word !== "").map((t) => (t.group ? flat(t.group) : t.word ?? t.text)).join(" ");

// Cards are colored by position, so any grammar's cards get the palette in order.
const cardClass = (key) => `k${Math.max(0, SLOTS.findIndex((c) => c.key === key)) % 6}`;

// Whose pronouns the beats and headline use: the grammar's pronoun card, or "they".
const person = () => (G.pronouns && state.pick[G.pronouns] ? word(G.pronouns, state.pick[G.pronouns], "n") : THEY);
const phraseText = (slot) => flat(tokens(slot, state.pick[slot], person(), slot));

function tokHtml(toks, slot, capFirst) {
  let first = capFirst;
  return toks.map((t) => {
    if (t.ghost) return `<button class="ghost-slot" data-add="${slot}" data-path="${t.path.join(".")}" title="Add a ${t.ghost.name}">+ ${t.ghost.name}</button>`;
    if (t.group) {
      const h = `<span class="ph nested">${tokHtml(t.group, slot, first)}</span>`;
      first = false;
      return h;
    }
    let s = t.word ?? t.text;
    if (s === "") s = "⋯";
    else if (first) { s = cap(s); first = false; }
    if (t.text !== undefined) return `<span class="plain">${esc(s)}</span>`;
    const p = t.path.join(".");
    if (state.view) return `<span class="w${viewChanged(`${slot}|${p}`) ? " changed" : ""}">${esc(s)}</span>`;
    const pinned = state.pins.includes(`${slot}|${p}`);
    const sel = state.sel && state.sel.slot === slot && same(state.sel.path, t.path);
    return `<button class="word${pinned ? " pinned" : ""}${sel ? " sel" : ""}" data-slot="${slot}" data-path="${p}" aria-label="${esc(s)}: tune the ${t.part.name}${pinned ? " (pinned)" : ""}">${esc(s)}</button>`;
  }).join(" ");
}
const phraseHtml = (slot, capFirst = false) =>
  `<span class="ph top ${cardClass(slot)}">${tokHtml(tokens(slot, state.pick[slot], person(), slot, [], true), slot, capFirst)}</span>`;

// Everything the headline and beats need: each card's text, the pronouns, and the mood that
// picks by-mood beat lines.
function context() {
  const pr = person();
  const text = {};
  for (const c of SLOTS) if (state.pick[c.key]) text[c.key] = phraseText(c.key);
  return {
    pr,
    text,
    name: G.pronouns ? text[G.pronouns] : "",
    mood: G.moodCard ? phraseV(G.moodCard, state.pick[G.moodCard]) : 0,
  };
}

// Fill a template (the headline or a beat line): card tokens become the cards ({Thing} starts a
// sentence with one), pronoun tokens the pronouns. A card at the very start is capitalized.
function fillWith(tpl, ctx, card) {
  return tpl.replace(/\{(\w+)\}/g, (_, k, at) => {
    if (k === "P") return cap(ctx.pr.p);
    if (SCHEMAS[k]) return card(k, at === 0);
    const lower = k.charAt(0).toLowerCase() + k.slice(1);
    if (k !== lower && SCHEMAS[lower]) return card(lower, true);
    if (k in PRONOUN_KEYS) return ctx.pr[k];
    return "";
  });
}
// The HTML version escapes the template's own text and the pronouns; cards come from phraseHtml,
// which escapes every word. Grammars can come from links and spaces, so nothing is trusted.
const fill = (tpl, ctx) => fillWith(esc(tpl), { ...ctx, pr: Object.fromEntries(Object.entries(ctx.pr).map(([k, v]) => [k, typeof v === "string" ? esc(v) : v])) }, (k, c) => phraseHtml(k, c));
const fillText = (tpl, ctx) => fillWith(tpl, ctx, (k, c) => (c ? cap(ctx.text[k] || "") : ctx.text[k] || ""));

// The headline: the grammar's line ("{who} {what}, and {p} {is} {feel}.").
const bitLine = (ctx) => fillText(G.line, ctx);
const bitHtml = (ctx) => fill(G.line, ctx);

// ---------- beats ----------
const beatGroup = (key) => form().beats[key];
// A beat's lines for this story: by-mood groups pick the pool for the feeling's mood.
function beatLines(key, ctx) {
  const g = beatGroup(key);
  return g.byMood ? g.lines[String(ctx.mood ?? 0)] : g.lines;
}
// A line can be used once the cards it names are in play.
const lineFits = (line) => lineCards(line.t, G).every((k) => stanza().slots.includes(k));
// Beat lines that also pass a lipogram, if any do; otherwise every fitting line (never an empty beat).
function beatPool(key, ctx) {
  const all = beatLines(key, ctx).map((l, i) => ({ l, i })).filter((x) => lineFits(x.l));
  const clean = all.filter((x) => lipogramOk(x.l.t, G));
  return clean.length ? clean : all;
}
const clashCount = () => pairsInPlay().filter((p) => clashes(p)).length;
const beatKeys = () => Object.keys(form().beats);

// Which line each beat in play uses: a hand-tuned choice if it still fits, else the seed's.
// Every beat draws from the seed in a fixed order, so growing or tuning one beat never
// reshuffles the others.
function beatChoices(ctx) {
  const rng = seeded(state.seed);
  const out = {};
  const inPlay = new Set(stanza().paras.flat());
  for (const key of beatKeys()) {
    const r = rng();
    if (!inPlay.has(key)) continue;
    const lines = beatLines(key, ctx);
    const tuned = state.beats[key];
    if (Number.isInteger(tuned) && lines[tuned] && lineFits(lines[tuned])) { out[key] = tuned; continue; }
    const g = beatGroup(key);
    const want = g.byClash ? Math.min(2, clashCount()) : null;
    let ok = beatPool(key, ctx);
    const byTier = ok.filter((x) => (want === null ? x.l.tier <= state.dial : x.l.tier === want));
    if (byTier.length) ok = byTier;
    out[key] = ok[Math.floor(r * ok.length)].i;
  }
  return out;
}

function story(ctx) {
  const choice = beatChoices(ctx);
  const sel = state.sel && state.sel.beat;
  return stanza().paras.map((keys) => keys.map((key) => {
    const line = beatLines(key, ctx)[choice[key]];
    if (state.view) return `<span class="beat-s${viewChanged(`beat|${key}`) ? " changed" : ""}">${fill(line.t, ctx)}</span>`;
    const pinned = state.pins.includes(`beat|${key}`);
    return `<span class="beat${sel === key ? " sel" : ""}${pinned ? " pinned" : ""}" data-beat="${key}" tabindex="0" role="button" aria-label="Tune ${esc(beatGroup(key).name)}">${fill(line.t, ctx)}</span>`;
  }).join(form().lines ? "<br>" : " "));
}

// ---------- picking under the dial ----------
// Keep only values that make each pair this card belongs to fit or clash as the dial asks.
// Constraints relax one at a time if nothing satisfies them all.
function constrain(slot, ok) {
  if (slot === G.rules.grounded) {
    // Keep this card (story: the event) grounded at low settings.
    const grounded = ok.filter((v) => phraseTier(slot, v) <= state.dial);
    if (grounded.length) ok = grounded;
  }
  const rules = PAIRS.map((p, i) => ({ p, want: wantClash(i) })).filter((r) => r.p.a === slot || r.p.b === slot);
  for (let n = rules.length; n >= 0; n--) {
    const fit = ok.filter((v) => rules.slice(0, n).every((r) => clashes(r.p, { ...state.pick, [slot]: v }) === r.want));
    if (fit.length) return fit;
  }
  return ok;
}
function pickFrom(slot, ok) {
  ok = constrain(slot, ok);
  // Avoid repeating the current phrase when there is a choice (pins can leave none).
  const fresh = ok.filter((v) => !same(v, state.pick[slot]));
  if (fresh.length) ok = fresh;
  if (ok.length) state.pick[slot] = ok[rand(ok.length)];
}

// ---------- pins ----------
const pinPaths = (slot) => state.pins.filter((p) => p.startsWith(slot + "|")).map((p) => p.split("|")[1].split("."));
// Copy pinned words (and whatever they hang from or need) from the current phrase onto a candidate.
function applyPins(slot, cand) {
  const cur = state.pick[slot];
  for (const path of pinPaths(slot)) {
    let a = cur, b = cand, schema = slot;
    for (let i = 0; i < path.length; i++) {
      const k = path[i];
      if (!a || !(k in a.w)) break;
      const keep = [k];
      const need = partOf(schema, k).needs;
      if (need === "adj") keep.push("n");
      else if (need) keep.push(need);
      for (const kk of keep) {
        if (same(b.w[kk], a.w[kk])) continue;
        b.w[kk] = clone(a.w[kk]);
        if (a.sub && a.sub[kk]) { b.sub = b.sub || {}; b.sub[kk] = clone(a.sub[kk]); } else if (b.sub) delete b.sub[kk];
      }
      if (i < path.length - 1) {
        const inner = subSchema(schema, a, k);
        a = a.sub && a.sub[k];
        b = b.sub && b.sub[k];
        schema = inner;
        if (!a || !b || !inner) break;
      }
    }
  }
  return cand;
}

// ---------- rerolls ----------
// Reroll these cards under the dial, keeping pinned words, and draw a new seed for the beats.
function rerollPick(keys) {
  // Cards settle in order: "feel" is chosen relative to "what", "thing" relative to "where".
  for (const s of SLOTS) {
    if (!keys.includes(s.key)) continue;
    // A full shuffle reshapes the phrase; rerolling one card keeps which words it has.
    const shape = keys.length > 1 ? randomShape(s.key) : shapeOf(state.pick[s.key]);
    pickFrom(s.key, Array.from({ length: 300 }, () => applyPins(s.key, randomPhrase(s.key, 0, shape))));
  }
  state.seed = 1 + rand(1e9);
  // New seed, new telling: hand-tuned beats only survive if pinned.
  state.beats = Object.fromEntries(Object.entries(state.beats).filter(([k]) => state.pins.includes(`beat|${k}`)));
}

// Replace the word at a path with each candidate value; returns the resulting whole phrases.
function variants(slot, path, vals) {
  return vals.map((v) => {
    const top = clone(state.pick[slot]);
    const at = locate(slot, top, path);
    setWord(at.schema, at.ph, at.k, v, at.depth);
    return top;
  });
}

// ---------- picker order ----------
// The ordered values the stepper walks: plain to strange, your words last within each register.
function pickerOptions(at) {
  const vals = options(at.schema, partOf(at.schema, at.k), at.depth);
  const cur = at.ph.w[at.k];
  if (!vals.some((v) => same(v, cur))) vals.push(cur);
  const tier = (v) => entryOf(at.schema, at.k, v).tier;
  return vals.map((v, i) => ({ v, i })).sort((a, b) => tier(a.v) - tier(b.v) || (typeof a.v === "number" ? 0 : 1) - (typeof b.v === "number" ? 0 : 1) || a.i - b.i).map((x) => x.v);
}
// The lines a beat can take right now, plain to strange.
function beatOptions(key, ctx) {
  return beatPool(key, ctx)
    .sort((a, b) => a.l.tier - b.l.tier || a.i - b.i);
}

// ---------- links ----------
// A story link carries the whole state, your own words included, as base64url JSON.
function validValue(schema, part, val, depth) {
  if (typeof val === "number") return Number.isInteger(val) && val >= 0 && val < part.pool.length;
  return !!val && typeof val === "object" && typeof val.c === "string" && !checkEntry(asEntry(schema, part.k, val), G);
}
function validPhrase(schema, ph, depth) {
  if (!ph || typeof ph.w !== "object") return false;
  const parts = SCHEMAS[schema].parts;
  if (!Object.keys(ph.w).every((k) => parts.some((p) => p.k === k))) return false;
  for (const p of parts) {
    if (!(p.k in ph.w)) { if (!p.opt) return false; continue; }
    if (!validValue(schema, p, ph.w[p.k], depth)) return false;
    const inner = nestKey(entryOf(schema, p.k, ph.w[p.k]));
    if (inner && (depth >= MAX_DEPTH || !validPhrase(inner, ph.sub?.[p.k], depth + 1))) return false;
  }
  return parts.every((p) => !(p.k in ph.w) || allowed(schema, ph, p));
}
// The grammar fields of a snapshot. v3 names the grammar by id, carried inline (gx) when it isn't
// built in, so the link works anywhere. v4 (docs/design.md, "Spaces") also pins a space grammar's
// version: gs = the space, gv = the version. A public space's version can be fetched by anyone,
// so its links leave gx out and stay short.
function grammarFields(g) {
  const src = srcOf.get(g);
  const builtin = GRAMMARS[g.id] === g;
  return { v: src ? 4 : 3, g: g.id, ...(src && { gs: src.sp, gv: src.ver }), ...(!builtin && !src?.pub && { gx: g }) };
}
// Everything that makes a piece what it is. v2 added the form and hand-tuned beats; v3 the
// grammar; v4 the grammar's version, for grammars from a space.
function snapshot() {
  return {
    ...grammarFields(G),
    f: state.form, p: state.pick, d: state.dial, s: state.seed, l: state.len, b: state.beats, pn: state.pins,
  };
}
// The grammar a snapshot names: a pinned space version (fetched ahead by prefetchRefs, or carried
// inline), built in, in your library, carried inline (checked), or the one in use.
function resolveGrammar(id = "story-bits", inline, ref) {
  if (ref) {
    const v = knownVersion(ref, id);
    if (v) return v;
    if (inline && inline.id === id && !GRAMMARS[id] && !checkGrammar(inline)) {
      if (!srcOf.get(inline)) srcOf.set(inline, { sp: ref.gs, ver: ref.gv, pub: false });
      return inline;
    }
    return null;
  }
  if (GRAMMARS[id]) return GRAMMARS[id];
  if (library[id]) return library[id];
  if (inline && inline.id === id && !checkGrammar(inline)) return inline;
  if (G && G.id === id) return G;
  return null;
}
// Check a snapshot from a link and normalize it, or return null. v1/v2 links (Story Bits, no
// grammar field) still load; so do v3 and v4.
function parseSnapshot(x) {
  const { p, d, s, l, pn = [], f, b = {}, g: gid = "story-bits", gx } = x || {};
  const gram = resolveGrammar(gid, gx, refOf(x));
  if (!gram) return null;
  const fk = f ?? Object.keys(gram.forms)[0];
  const fm = gram.forms[fk];
  if (!fm || ![0, 1, 2].includes(d) || !Number.isInteger(s)) return null;
  if (!Number.isInteger(l) || l < 1 || l > fm.stanzas.length) return null;
  if (!p || !withGrammar(gram, () => gram.cards.every((c) => validPhrase(c.key, p[c.key], 0)))) return null;
  const beats = b && typeof b === "object" ? Object.fromEntries(Object.entries(b).filter(([k, i]) => fm.beats[k] && Number.isInteger(i) && i >= 0)) : {};
  const out = {
    ...grammarFields(gram),
    f: fk, p, d, s: s || 1, l, b: beats, pn: Array.isArray(pn) ? pn.filter((x) => typeof x === "string") : [],
  };
  // The resolved grammar rides along, but never into JSON (links carry gx instead).
  Object.defineProperty(out, "gram", { value: gram, enumerable: false });
  return out;
}
// Put a (parsed) snapshot into state, switching grammar if it names another.
function applySnapshot(x) {
  if (x.gram && x.gram !== G) useGrammar(x.gram);
  Object.assign(state, { grammar: G.id, pick: clone(x.p), dial: x.d, seed: x.s, len: x.l, form: x.f, beats: { ...x.b }, pins: [...x.pn] });
}
function loadSnapshot(x) {
  const snap = parseSnapshot(x);
  if (snap) applySnapshot(snap);
  return !!snap;
}
function fromHash(h) {
  try { return loadSnapshot(JSON.parse(unb64(h))); } catch { return false; }
}

// ---------- grammar versions (spaces) ----------
const SPACE_ID = /^[A-Z0-9]{8}$/;
// Every grammar version the page has fetched or been sent, keyed "SPACE/gid@n", checked once. The
// objects themselves are what the engine runs, so srcOf can say where the grammar in use came from.
const spaceVersions = {};
const srcOf = new WeakMap(); // grammar object -> { sp, ver, pub }
const verKey = (sp, gid, ver) => `${sp}/${gid}@${ver}`;
// A v4 reference ({ gs, gv }) if it's well-formed, else null.
const refOf = (x) => (x && typeof x.gs === "string" && SPACE_ID.test(x.gs) && Number.isInteger(x.gv) && x.gv > 0 && x.gv <= 1000 ? { gs: x.gs, gv: x.gv } : null);
function addVersion(sp, ver, doc, pub) {
  // A space grammar may not take a built-in's id: a link naming it would open the wrong words.
  if (!doc || GRAMMARS[doc.id] || checkGrammar(doc)) return null;
  const k = verKey(sp, doc.id, ver);
  if (spaceVersions[k]) {
    const s = srcOf.get(spaceVersions[k]);
    if (pub && s) s.pub = true;
    return spaceVersions[k];
  }
  spaceVersions[k] = doc;
  srcOf.set(doc, { sp, ver, pub: !!pub });
  return doc;
}
const knownVersion = (ref, gid) => spaceVersions[verKey(ref.gs, gid, ref.gv)] || null;

// ---------- challenges: copies, moves, compare ----------
// See app.js ("the friends game") for how challenges are played.
const NAME_MAX = 24;
const cleanName = (n) => cleanWord(n).slice(0, NAME_MAX);
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
const challengeId = (c) => hashStr(JSON.stringify(c.s));
// The current story with every beat in play written down, so every copy tells the same story.
function fixedSnapshot() {
  const snap = clone(snapshot());
  snap.b = { ...beatChoices(context()) };
  snap.pn = [];
  return snap;
}
const playPayload = () => ({ c: state.game.c, me: fixedSnapshot(), name: state.game.name });

function parseChallenge(c) {
  if (!c || typeof c !== "object") return null;
  const start = parseSnapshot(c.s);
  if (!start || !Number.isInteger(c.n) || c.n < 0 || c.n > 9) return null;
  return { h: cleanName(c.h), n: c.n, s: start, ...(c.d === 1 && { d: 1 }) };
}
// A copy of a challenge: { c, me, name }.
function parseCopy(x) {
  const c = parseChallenge(x && x.c);
  const me = c && parseSnapshot(x.me);
  if (!me || me.f !== c.s.f || me.l !== c.s.l) return null;
  return { c, me, name: cleanName(x.name) };
}

function diffPhrase(schema, a, b, path = [], out = []) {
  for (const k of new Set([...Object.keys(a.w), ...Object.keys(b.w)])) {
    const at = [...path, k];
    if (!same(a.w[k], b.w[k])) out.push(at.join("."));
    else if (a.sub?.[k] && b.sub?.[k]) diffPhrase(subSchema(schema, a, k), a.sub[k], b.sub[k], at, out);
  }
  return out;
}
// Every change from the start: "slot|path" for words, "beat|key" for beats. One change, one move.
function changes(start, snap) {
  return withGrammar(start.gram || G, () => {
    const out = [];
    for (const sl of SLOTS) for (const p of diffPhrase(sl.key, start.p[sl.key], snap.p[sl.key])) out.push(`${sl.key}|${p}`);
    for (const k of Object.keys(start.b)) if (snap.b[k] !== start.b[k]) out.push(`beat|${k}`);
    return out;
  });
}
const movesUsed = () => changes(state.game.c.s, fixedSnapshot()).length;
// Pull every copy link out of pasted text (a group chat dump works).
function linksIn(text) {
  const out = [];
  for (const m of text.matchAll(/#(s|p|cmp)=([A-Za-z0-9_-]+)/g)) {
    try {
      const x = JSON.parse(unb64(m[2]));
      if (m[1] === "cmp") { const c = parseChallenge(x.c); if (c) for (const e of x.e || []) { const cp = parseCopy({ c: x.c, me: e.me, name: e.name }); if (cp) out.push(cp); } }
      else { const cp = parseCopy(x); if (cp) out.push(cp); }
    } catch {}
  }
  return out;
}

// Render any snapshot as static text, with changed words and beats marked.
function staticHtml(snap, changed) {
  const saved = { grammar: state.grammar, pick: state.pick, dial: state.dial, seed: state.seed, len: state.len, form: state.form, beats: state.beats, pins: state.pins, sel: state.sel };
  const savedG = G;
  applySnapshot(snap);
  state.pins = [];
  state.sel = null;
  state.view = new Set(changed);
  try {
    const ctx = context();
    return `<p class="bit">${bitHtml(ctx)}</p><div class="story">${story(ctx).map((p) => `<p>${p}</p>`).join("")}</div>`;
  } finally {
    useGrammar(savedG);
    Object.assign(state, saved);
    state.view = null;
  }
}
const viewChanged = (key) => {
  for (const c of state.view) if (key === c || key.startsWith(c + ".")) return true;
  return false;
};

// Today's bit: the same Story Bits piece for everyone today (UTC), as a 3-move challenge.
// Generated from the date alone: no word bank, forms rotate by day.
function dailyChallenge(date = new Date()) {
  return withGrammar(GRAMMARS["story-bits"], () => dailyIn(date));
}
function dailyIn(date) {
  const day = date.toISOString().slice(0, 10);
  const saved = { rng, pick: state.pick, dial: state.dial, len: state.len, form: state.form, seed: state.seed, beats: state.beats, pins: state.pins };
  rng = seeded(parseInt(hashStr(`story-bits ${day}`), 36));
  state.shared = true;
  try {
    const keys = Object.keys(FORMS).filter((k) => !FORMS[k].pack);
    const n = Math.floor(Date.parse(day) / 864e5);
    Object.assign(state, { form: keys[n % keys.length], dial: 1, beats: {}, pins: [], pick: {} });
    state.len = Math.min(3, maxLen());
    for (const sl of SLOTS) state.pick[sl.key] = randomPhrase(sl.key);
    for (const sl of SLOTS.slice(1)) pickFrom(sl.key, Array.from({ length: 300 }, () => randomPhrase(sl.key)));
    state.seed = 1 + rand(1e9);
    const label = new Date(day + "T12:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
    return { h: label, d: 1, n: 3, s: fixedSnapshot() };
  } finally {
    Object.assign(state, saved);
    rng = saved.rng;
    state.shared = false;
  }
}
