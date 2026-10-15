// Story Bits: tune a piece word by word, in a grammar you can swap, fork and share.
// The engine below knows nothing about any one grammar: cards, slots, word pools, the headline
// line, forms and the dial's rules all come from the active grammar (GRAMMARS in data.js, or the
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

// Your library: grammars you've forked, written or imported, kept in this browser.
const LIB_KEY = "story-bits-grammars";
function loadLibrary() {
  try {
    const out = {};
    for (const g of JSON.parse(localStorage.getItem(LIB_KEY)) || []) if (!checkGrammar(g) && !GRAMMARS[g.id]) out[g.id] = g;
    return out;
  } catch { return {}; }
}
function saveLibrary() {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(Object.values(library))); } catch {}
}
let library = loadLibrary();
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

// ---------- word bank (yours, kept in this browser) ----------
const BANK_KEY = "story-bits-bank";
const partOf = (schema, k) => SCHEMAS[schema].parts.find((p) => p.k === k);
// Bank words belong to a grammar (g); older ones, from before grammars, belong to Story Bits.
const gOf = (e) => e.g || "story-bits";
const sameWord = (a, b) => gOf(a) === gOf(b) && a.s === b.s && a.k === b.k && a.t.toLowerCase() === b.t.toLowerCase();
const builtinHas = (e, g = G) => !!partIn(g, e.s, e.k)?.pool.some((p) => p.t.toLowerCase() === e.t.toLowerCase());
function loadBank() {
  try { return (JSON.parse(localStorage.getItem(BANK_KEY)) || []).filter((e) => e && typeof e.t === "string"); } catch { return []; }
}
function saveBank() {
  try { localStorage.setItem(BANK_KEY, JSON.stringify(bank)); } catch {}
}
let bank = loadBank();
// Adds checked, new words. Returns how many were added.
function addToBank(entries) {
  let n = 0;
  for (let e of entries) {
    e = { ...e, g: e.g || "story-bits" };
    const gram = resolveGrammar(e.g);
    if (!gram || checkEntry(e, gram) || builtinHas(e, gram) || bank.some((b) => sameWord(b, e))) continue;
    bank.push(e);
    n++;
  }
  saveBank();
  return n;
}
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
const fill = (tpl, ctx) => fillWith(tpl, ctx, (k, c) => phraseHtml(k, c));
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

// ---------- actions ----------
function reroll(keys) {
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
  render();
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
function setValue(slot, path, val) {
  state.pick[slot] = variants(slot, path, [val])[0];
  render();
}
// A random word for this slot, within the dial if possible.
function surprise(slot, path) {
  const at = locate(slot, state.pick[slot], path);
  const vals = options(at.schema, partOf(at.schema, at.k), at.depth).filter((v) => !same(v, at.ph.w[at.k]));
  if (!vals.length) return;
  pickFrom(slot, variants(slot, path, vals));
  render();
}
// Fill an empty optional slot (a ghost), then open it in the picker.
function addWord(slot, path) {
  const at = locate(slot, state.pick[slot], path);
  if (!at) return;
  pickFrom(slot, variants(slot, path, options(at.schema, partOf(at.schema, at.k), at.depth)));
  state.sel = { slot, path, occ: 0 };
  render();
}
function removeWord(slot, path) {
  const top = clone(state.pick[slot]);
  const at = locate(slot, top, path);
  dropWord(at.schema, at.ph, at.k);
  state.pick[slot] = top;
  state.sel = null;
  render();
}
// A new telling: fresh beats from a new seed, except pinned beats, which keep their line.
function retell() {
  const ctx = context();
  const keep = beatChoices(ctx);
  state.seed = 1 + rand(1e9);
  state.beats = Object.fromEntries(Object.entries(keep).filter(([k]) => state.pins.includes(`beat|${k}`)));
  if (state.sel && state.sel.beat) state.sel = null;
  render();
}
function setBeat(key, i) {
  state.beats = { ...state.beats, [key]: i };
  render();
}
function togglePin(slot, path) {
  const key = `${slot}|${path.join(".")}`;
  state.pins = state.pins.includes(key) ? state.pins.filter((p) => p !== key) : [...state.pins, key];
  render();
}
// Use your own text in a slot. It inherits the current word's register and mood, and joins your bank.
function useOwn(slot, path, text) {
  const t = cleanWord(text);
  if (!t) return;
  const at = locate(slot, state.pick[slot], path);
  const cur = word(at.schema, at.ph, at.k);
  const e = { g: G.id, s: at.schema, k: at.k, t, tier: cur.tier };
  const dets = detsFor(e.s, e.k, G);
  if (needsMood(e.s, e.k, G)) e.v = cur.v ?? 0;
  if (dets) e.det = dets.includes(cur.det) ? cur.det : dets[0];
  if (needsPronouns(e.s, e.k, G)) e.pr = Object.keys(PRON).find((k) => PRON[k].p === cur.p) || "they";
  const err = checkEntry(e, G);
  if (err) { toast(err); return; }
  if (addToBank([e])) toast(`Added “${t}” to your word bank.`);
  renderBank();
  setValue(slot, path, asValue(e));
}

// ---------- the picker ----------
// The ordered values the stepper walks: plain to strange, your words last within each register.
function pickerOptions(at) {
  const vals = options(at.schema, partOf(at.schema, at.k), at.depth);
  const cur = at.ph.w[at.k];
  if (!vals.some((v) => same(v, cur))) vals.push(cur);
  const tier = (v) => entryOf(at.schema, at.k, v).tier;
  return vals.map((v, i) => ({ v, i })).sort((a, b) => tier(a.v) - tier(b.v) || (typeof a.v === "number" ? 0 : 1) - (typeof b.v === "number" ? 0 : 1) || a.i - b.i).map((x) => x.v);
}
function crumbs(slot, path) {
  const names = [SLOTS.find((s) => s.key === slot).label];
  let schema = slot;
  path.forEach((k, i) => {
    names.push(partOf(schema, k).name);
    if (i < path.length - 1) {
      const inner = subSchema(schema, locate(slot, state.pick[slot], path.slice(0, i + 1)).ph, k);
      names.push(SLOTS.find((c) => c.key === inner)?.label.toLowerCase() || inner);
      schema = inner;
    }
  });
  return names;
}

let pickerVals = [];
// The lines a beat can take right now, plain to strange.
function beatOptions(key, ctx) {
  return beatPool(key, ctx)
    .sort((a, b) => a.l.tier - b.l.tier || a.i - b.i);
}
function renderBeatPicker(el, key) {
  const ctx = context();
  const cur = beatChoices(ctx)[key];
  const opts = beatOptions(key, ctx);
  pickerVals = opts.map((x) => x.i);
  const idx = pickerVals.indexOf(cur);
  const line = beatLines(key, ctx)[cur];
  const pinned = state.pins.includes(`beat|${key}`);
  const groups = [0, 1, 2].map((t) => {
    const items = opts.map((x, i) => ({ ...x, n: i })).filter((x) => x.l.tier === t);
    if (!items.length) return "";
    return `<div class="pk-group"><h4>${TIER_NAMES[t]}</h4>${items.map((x) =>
      `<button class="pk-opt pk-line${x.i === cur ? " cur" : ""}" data-opt="${x.n}">${esc(fillText(x.l.t, ctx))}</button>`).join("")}</div>`;
  }).join("");
  el.innerHTML = `
    <div class="pk-head">
      <span class="pk-crumb">Story › ${esc(beatGroup(key).name)}</span>
      <button class="pk-x" data-act="close" aria-label="Close">✕</button>
    </div>
    <div class="pk-step">
      <button class="pk-arrow" data-act="prev" aria-label="Plainer" ${idx <= 0 ? "disabled" : ""}>‹</button>
      <div class="pk-cur"><b class="pk-sentence">${esc(fillText(line.t, ctx))}</b>
        <span class="pk-meta"><span class="tier t${line.tier}">${TIER_NAMES[line.tier]}</span> ${idx + 1} of ${opts.length}${Number.isInteger(state.beats[key]) ? " · tuned" : ""}</span></div>
      <button class="pk-arrow" data-act="next" aria-label="Stranger" ${idx >= opts.length - 1 ? "disabled" : ""}>›</button>
    </div>
    <p class="pk-keys">← plainer · stranger →</p>
    <div class="pk-actions">
      <button data-act="surprise">Surprise me</button>
      ${state.game ? (selChanged() ? `<button data-act="putback">Put back</button>` : "") : `<button data-act="pin" aria-pressed="${pinned}">${pinned ? "Pinned" : "Pin"}</button>`}
      ${Number.isInteger(state.beats[key]) ? `<button data-act="untune">Back to the dice</button>` : ""}
    </div>
    <div class="pk-list">${groups}</div>
    ${state.room ? jamPickerHtml(`beat|${key}`, fillText(line.t, ctx)) : ""}`;
  el.classList.toggle("readonly", !!state.room && jamReadOnly());
  el.hidden = false;
  positionPicker();
}
function renderPicker() {
  const el = $("#picker");
  const sel = state.sel;
  if (sel && sel.beat) {
    if (!stanza().paras.flat().includes(sel.beat)) { state.sel = null; el.hidden = true; return; }
    renderBeatPicker(el, sel.beat);
    return;
  }
  const at = sel && state.pick[sel.slot] && locate(sel.slot, state.pick[sel.slot], sel.path);
  if (!at || !(at.k in at.ph.w)) { state.sel = null; el.hidden = true; return; }
  const part = partOf(at.schema, at.k);
  const cur = at.ph.w[at.k];
  const who = person();
  pickerVals = pickerOptions(at);
  const idx = pickerVals.findIndex((v) => same(v, cur));
  const entry = entryOf(at.schema, at.k, cur);
  const pinned = state.pins.includes(`${sel.slot}|${sel.path.join(".")}`);
  const label = (v) => pron(entryOf(at.schema, at.k, v).t, who).replace("{thing}", "…");
  const groups = [0, 1, 2].map((t) => {
    const items = pickerVals.map((v, i) => ({ v, i })).filter((x) => entryOf(at.schema, at.k, x.v).tier === t);
    if (!items.length) return "";
    return `<div class="pk-group"><h4>${TIER_NAMES[t]}</h4>${items.map((x) =>
      `<button class="pk-opt${x.i === idx ? " cur" : ""}${typeof x.v === "number" ? "" : " yours"}" data-opt="${x.i}">${esc(label(x.v))}</button>`).join("")}</div>`;
  }).join("");

  el.innerHTML = `
    <div class="pk-head">
      <span class="pk-crumb">${crumbs(sel.slot, sel.path).map(esc).join(" › ")}</span>
      <button class="pk-x" data-act="close" aria-label="Close">✕</button>
    </div>
    <div class="pk-step">
      <button class="pk-arrow" data-act="prev" aria-label="Plainer" ${idx <= 0 ? "disabled" : ""}>‹</button>
      <div class="pk-cur"><b>${esc(label(cur))}</b>
        <span class="pk-meta"><span class="tier t${entry.tier}">${TIER_NAMES[entry.tier]}</span> ${idx + 1} of ${pickerVals.length}${entry.custom ? " · yours" : ""}</span></div>
      <button class="pk-arrow" data-act="next" aria-label="Stranger" ${idx >= pickerVals.length - 1 ? "disabled" : ""}>›</button>
    </div>
    <p class="pk-keys">← plainer · stranger →</p>
    <div class="pk-actions">
      <button data-act="surprise">Surprise me</button>
      ${state.game ? (selChanged() ? `<button data-act="putback">Put back</button>` : "") : `<button data-act="pin" aria-pressed="${pinned}">${pinned ? "Pinned" : "Pin"}</button>`}
      ${part.opt ? `<button data-act="remove">Remove</button>` : ""}
    </div>
    <div class="pk-list">${groups}</div>
    <form class="pk-own" autocomplete="off">
      <input name="own" maxlength="60" placeholder="Your own ${esc(part.name)}…" aria-label="Your own ${esc(part.name)}">
      <button type="submit">Use</button>
    </form>
    ${state.room ? jamPickerHtml(`${sel.slot}|${sel.path.join(".")}`, label(cur)) : ""}`;
  el.classList.toggle("readonly", !!state.room && jamReadOnly());
  el.hidden = false;
  positionPicker();
}

function selectedEl() {
  const s = state.sel;
  if (!s) return null;
  if (s.beat) return document.querySelector(`.beat[data-beat="${s.beat}"]`);
  const els = document.querySelectorAll(`.word[data-slot="${s.slot}"][data-path="${s.path.join(".")}"]`);
  return els[Math.min(s.occ || 0, els.length - 1)] || null;
}
function positionPicker() {
  const el = $("#picker");
  const w = selectedEl();
  if (!w) return;
  const r = w.getBoundingClientRect();
  if (innerWidth < 640) {
    // Bottom sheet; keep the word in view above it.
    el.classList.add("sheet");
    el.style.left = el.style.top = "";
    const room = innerHeight - el.offsetHeight - 16;
    if (r.bottom > room || r.top < 8) scrollBy({ top: r.top - Math.max(16, room - r.height - 40), behavior: "smooth" });
    return;
  }
  el.classList.remove("sheet");
  const width = el.offsetWidth;
  el.style.left = `${Math.max(16, Math.min(r.left + scrollX, scrollX + innerWidth - width - 16))}px`;
  el.style.top = `${r.bottom + scrollY + 10}px`;
}

function selectBeat(key) {
  state.sel = state.sel && state.sel.beat === key ? null : { beat: key };
  render();
  if (state.sel) selectedEl()?.focus({ preventScroll: true });
}
function surpriseBeat(key) {
  const ctx = context();
  const cur = beatChoices(ctx)[key];
  const opts = beatOptions(key, ctx).map((x) => x.i).filter((i) => i !== cur);
  if (opts.length) setBeat(key, opts[rand(opts.length)]);
}
function select(slot, path, el) {
  const els = [...document.querySelectorAll(`.word[data-slot="${slot}"][data-path="${path.join(".")}"]`)];
  const occ = Math.max(0, els.indexOf(el));
  if (state.sel && state.sel.slot === slot && same(state.sel.path, path) && state.sel.occ === occ) state.sel = null;
  else state.sel = { slot, path, occ };
  render();
  if (state.sel) selectedEl()?.focus({ preventScroll: true });
}
function step(dir) {
  const s = state.sel;
  if (s.beat) {
    const ctx = context();
    const opts = beatOptions(s.beat, ctx).map((x) => x.i);
    const i = opts.indexOf(beatChoices(ctx)[s.beat]) + dir;
    if (i >= 0 && i < opts.length) setBeat(s.beat, opts[i]);
    return;
  }
  const at = locate(s.slot, state.pick[s.slot], s.path);
  const vals = pickerOptions(at);
  const i = vals.findIndex((v) => same(v, at.ph.w[at.k])) + dir;
  if (i < 0 || i >= vals.length) return;
  setValue(s.slot, s.path, vals[i]);
}

// ---------- cast (characters you keep telling stories about) ----------
// Only for grammars with a pronoun card (Story Bits: who). Each entry: { g, who: phrase, bits },
// keyed by grammar and the head word under any descriptor.
const CAST_KEY = "story-bits-cast";
const castKey = (c) => `${c.g || "story-bits"}|${JSON.stringify(c.who.w.n)}`;
function loadCast() {
  try {
    const raw = JSON.parse(localStorage.getItem(CAST_KEY)) || [];
    // Older entries stored a bare index into the people list, and had no grammar.
    return raw.map((c) => (typeof c.who === "number" ? { ...c, who: { w: { n: c.who } } } : c))
      .map((c) => ({ ...c, g: c.g || "story-bits" }))
      .filter((c) => c.who && typeof c.who.w === "object" && Array.isArray(c.bits));
  } catch { return []; }
}
function saveCast() {
  try { localStorage.setItem(CAST_KEY, JSON.stringify(cast)); } catch {}
}
let cast = [];
const castHere = () => cast.map((c, i) => ({ c, i })).filter(({ c }) => c.g === G.id && G.pronouns && validPhrase(G.pronouns, c.who, 0));

function keepBit() {
  if (!G.pronouns) return;
  const ctx = context();
  const line = bitLine(ctx);
  const entry = { g: G.id, who: clone(state.pick[G.pronouns]), bits: [] };
  let c = cast.find((x) => castKey(x) === castKey(entry));
  if (!c) { c = entry; cast.unshift(c); }
  c.who = entry.who;
  if (!c.bits.includes(line)) c.bits.unshift(line);
  saveCast();
  renderCast();
  toast(`Kept. ${cap(ctx.name)} now has ${c.bits.length} ${c.bits.length === 1 ? "story" : "stories"}.`);
}
function tellAnother(i) {
  const c = cast[i];
  if (!c || c.g !== G.id || !G.pronouns) return;
  const key = G.pronouns;
  state.pick[key] = clone(c.who);
  // Pin the character's words; shuffle everything else.
  state.pins = state.pins.filter((p) => !p.startsWith(key + "|")).concat(Object.keys(c.who.w).map((k) => `${key}|${k}`));
  state.sel = null;
  reroll(SLOTS.map((x) => x.key).filter((k) => k !== key));
  window.scrollTo({ top: 0, behavior: "smooth" });
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
// Everything that makes a piece what it is. v2 added the form and hand-tuned beats; v3 adds the
// grammar (by id, and carried inline when it isn't built in, so the link works anywhere).
function snapshot() {
  return {
    v: 3, g: G.id, ...(!GRAMMARS[G.id] && { gx: G }),
    f: state.form, p: state.pick, d: state.dial, s: state.seed, l: state.len, b: state.beats, pn: state.pins,
  };
}
// The grammar a snapshot names: built in, in your library, or carried inline (checked).
function resolveGrammar(id = "story-bits", inline) {
  if (GRAMMARS[id]) return GRAMMARS[id];
  if (library[id]) return library[id];
  if (inline && inline.id === id && !checkGrammar(inline)) return inline;
  return null;
}
// Check a snapshot from a link and normalize it, or return null. v1/v2 links (Story Bits, no
// grammar field) still load.
function parseSnapshot(x) {
  const { p, d, s, l, pn = [], f, b = {}, g: gid = "story-bits", gx } = x || {};
  const gram = resolveGrammar(gid, gx);
  if (!gram) return null;
  const fk = f ?? Object.keys(gram.forms)[0];
  const fm = gram.forms[fk];
  if (!fm || ![0, 1, 2].includes(d) || !Number.isInteger(s)) return null;
  if (!Number.isInteger(l) || l < 1 || l > fm.stanzas.length) return null;
  if (!p || !withGrammar(gram, () => gram.cards.every((c) => validPhrase(c.key, p[c.key], 0)))) return null;
  const beats = b && typeof b === "object" ? Object.fromEntries(Object.entries(b).filter(([k, i]) => fm.beats[k] && Number.isInteger(i) && i >= 0)) : {};
  const out = {
    v: 3, g: gram.id, ...(!GRAMMARS[gram.id] && { gx: gram }),
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
function toHash() {
  if (state.room) return `#jam=${state.room.code}${state.room.key ? `~${state.room.key}` : ""}`;
  // Mid-challenge, the link holds the challenge and your copy, so a reload picks up where you were.
  if (state.game) return "#p=" + b64(JSON.stringify(playPayload()));
  // Comparing (and not playing): keep the set of versions in the link.
  if (state.compare) return "#cmp=" + b64(JSON.stringify({ c: state.compare.c, e: state.compare.entries.map((e) => ({ name: e.name, me: e.me })) }));
  return "#" + b64(JSON.stringify(snapshot()));
}
function fromHash(h) {
  try { return loadSnapshot(JSON.parse(unb64(h))); } catch { return false; }
}

// A pack link carries words only: "#pack=<base64url JSON { name, words }>".
function packLink() {
  const pack = { name: "Shared words", words: bank };
  return `${location.origin}${location.pathname}#pack=${b64(JSON.stringify(pack))}`;
}
function importPack(h) {
  try {
    const pack = JSON.parse(unb64(h));
    const words = Array.isArray(pack.words) ? pack.words : [];
    const n = addToBank(words);
    toast(n ? `Added ${n} word${n === 1 ? "" : "s"} from “${cleanWord(pack.name) || "a pack"}” to your word bank.` : "Those words are already in your bank.");
  } catch { toast("That pack link couldn't be read."); }
}

// Words that reach everyone: a pre-filled GitHub issue. A maintainer labels it accepted-pack,
// and .github/workflows/word-pack.yml turns it into a pull request adding packs/issue-N.json.
const REPO = "https://github.com/reeswrites/story-bits";
function suggestLink() {
  const pack = { name: "Suggested words", words: bank };
  const body = `Words suggested from Story Bits for the shared word bank.\n\nA maintainer adds the \`accepted-pack\` label to turn this into a pull request. Edit the list below first if any words shouldn't go in.\n\n\`\`\`json\n${JSON.stringify(pack, null, 1)}\n\`\`\`\n`;
  return `${REPO}/issues/new?${new URLSearchParams({ title: `Word pack: ${bank.length} word${bank.length === 1 ? "" : "s"}`, labels: "word-pack", body })}`;
}

// Shared packs that made it into the repo: packs/index.json lists files, loaded in order and
// appended to the pools. Append-only, so the indices in older links stay put.
async function loadPacks() {
  try {
    const files = await (await fetch("packs/index.json")).json();
    for (const f of files) {
      if (!/^[\w-]+\.json$/.test(f)) continue;
      const pack = await (await fetch(`packs/${f}`)).json();
      // Whole grammars first, so the words and forms below can belong to them. An id already
      // taken is skipped, so links to a grammar never change meaning.
      for (const [id, gram] of Object.entries(pack.grammars || {})) if (!GRAMMARS[id] && gram?.id === id && !checkGrammar(gram)) GRAMMARS[id] = { ...gram, shared: true };
      for (const e of pack.words || []) {
        const gram = GRAMMARS[e.g || "story-bits"];
        if (gram && !checkEntry(e, gram) && !builtinHas(e, gram)) gram.schemas[e.s].parts.find((p) => p.k === e.k).pool.push(poolEntry(e, gram));
      }
      // Forms join a grammar by key (pack.grammar, default Story Bits); a taken key is skipped.
      const fg = GRAMMARS[pack.grammar || "story-bits"];
      if (fg) for (const [k, f] of Object.entries(pack.forms || {})) if (!fg.forms[k] && /^[a-z][a-z0-9-]{0,23}$/.test(k) && !checkForm(f, fg)) fg.forms[k] = { ...f, pack: true };
    }
  } catch {}
}


// ---------- the friends game: same bit, a few moves, compare ----------
// A challenge is a starting story plus a move budget. Everyone tunes their own copy; a move is
// any word or beat that differs from the start, so putting one back gives the move back. Then
// the copies go side by side, changes highlighted, and the room votes. No server: every copy
// is a link. Link kinds: #c= challenge, #p= a copy in progress, #s= a finished copy,
// #cmp= a set of copies to compare.
const NAME_MAX = 24;
const cleanName = (n) => cleanWord(n).slice(0, NAME_MAX);
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
const challengeId = (c) => hashStr(JSON.stringify(c.s));
const linkTo = (kind, payload) => `${location.origin}${location.pathname}#${kind}=${b64(JSON.stringify(payload))}`;

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

function startGame(c, me = c.s, name = "") {
  applySnapshot(me);
  state.pins = [];
  state.sel = null;
  state.game = { c, name, good: null };
  document.body.classList.add("in-game");
  $("#challenge-panel").hidden = true;
  render();
}
function leaveGame() {
  state.game = null;
  document.body.classList.remove("in-game");
  render();
}
// Put one word or beat back the way the challenge started.
function putBack() {
  const s = state.sel;
  const start = state.game.c.s;
  if (s.beat) { setBeat(s.beat, start.b[s.beat]); return; }
  const at = locate(s.slot, start.p[s.slot], s.path);
  if (at && at.k in at.ph.w) {
    const top = clone(state.pick[s.slot]);
    const here = locate(s.slot, top, s.path);
    here.ph.w[here.k] = clone(at.ph.w[here.k]);
    if (at.ph.sub?.[here.k]) { here.ph.sub = here.ph.sub || {}; here.ph.sub[here.k] = clone(at.ph.sub[here.k]); } else if (here.ph.sub) delete here.ph.sub[here.k];
    tidy(at.schema, here.ph);
    state.pick[s.slot] = top;
    render();
  } else removeWord(s.slot, s.path);
}
// Is the selected word or beat different from the start?
function selChanged() {
  if (!state.game || !state.sel) return false;
  const key = state.sel.beat ? `beat|${state.sel.beat}` : `${state.sel.slot}|${state.sel.path.join(".")}`;
  return changes(state.game.c.s, fixedSnapshot()).some((c) => c === key || key.startsWith(c + "."));
}

function renderGameBar() {
  const bar = $("#game-bar");
  if (!state.game) { bar.hidden = true; return; }
  const { c, name } = state.game;
  const used = movesUsed();
  bar.hidden = false;
  bar.innerHTML = `
    <div class="gb-top">
      <p class="gb-title"><span class="eyebrow">${c.d ? `Today's bit · ${esc(c.h)}` : `Challenge${c.h ? ` from ${esc(c.h)}` : ""}`}</span>
        ${c.n ? `Make it yours in <b>${c.n}</b> move${c.n === 1 ? "" : "s"}. Any word or beat you change is a move; put it back to get the move back.` : `Make it yours. No move limit: everything you change shows up highlighted at the reveal.`}</p>
      ${c.n ? `<div class="gb-moves" aria-label="${used} of ${c.n} moves used">${Array.from({ length: c.n }, (_, i) => `<span class="${i < used ? "on" : ""}"></span>`).join("")}<b>${used}/${c.n}</b></div>` : `<div class="gb-moves"><b>${used} change${used === 1 ? "" : "s"}</b></div>`}
    </div>
    ${state.room ? `<div class="gb-row">
      <button id="gb-send" class="primary" ${jamCan("edit") ? "" : "hidden"}>${roomMe()?.submitted ? "Update my version" : "Send my version"}</button>
      <span class="gb-note">${roomMe()?.submitted ? "Sent. You can keep tuning and send again until the host reveals." : "Everyone's copies stay hidden until the host reveals them."}</span>
    </div>` : `<div class="gb-row">
      <label class="gb-name"><span class="dial-label">Your name</span><input id="gb-name" maxlength="${NAME_MAX}" value="${esc(name)}" placeholder="so they know it's you"></label>
      <button id="gb-submit" class="primary">Copy my version</button>
      <button id="gb-compare" class="ghost">Compare versions</button>
      <button id="gb-leave" class="ghost subtle">Leave challenge</button>
    </div>`}`;
}

// ----- compare -----
// state.compare = { c, entries: [{ name, me, votes }] }
function openCompare(c, entries = []) {
  state.compare = { c, entries: [] };
  addEntries(entries);
  $("#compare").hidden = false;
  renderCompare();
  $("#compare").scrollIntoView({ behavior: "smooth", block: "start" });
}
function addEntries(entries) {
  const cmp = state.compare;
  let added = 0, other = 0;
  for (const e of entries) {
    if (challengeId(e.c) !== challengeId(cmp.c)) { other++; continue; }
    const key = JSON.stringify(e.me) + e.name;
    if (cmp.entries.some((x) => JSON.stringify(x.me) + x.name === key)) continue;
    cmp.entries.push({ name: e.name, me: e.me, votes: 0 });
    added++;
  }
  if (other) toast(`${other} link${other === 1 ? " was" : "s were"} from a different challenge.`);
  return added;
}
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

function renderCompare() {
  const el = $("#compare-cards");
  const cmp = state.compare;
  if (!cmp) return;
  if (!state.game) history.replaceState(null, "", toHash());
  document.body.classList.toggle("room-compare", !!state.room);
  const top = Math.max(0, ...cmp.entries.map((e) => e.votes));
  const original = `<article class="version original"><header><h3>The original</h3><span class="count">${esc(cmp.c.d ? `today's bit · ${cmp.c.h}` : cmp.c.h ? `from ${cmp.c.h}` : "start")}</span></header>${staticHtml(cmp.c.s, [])}</article>`;
  el.innerHTML = original + cmp.entries.map((e, i) => {
    const ch = changes(cmp.c.s, e.me);
    return `<article class="version${top > 0 && e.votes === top ? " leading" : ""}">
      <header><h3>${esc(e.name || `Player ${i + 1}`)}</h3><span class="count">${ch.length} move${ch.length === 1 ? "" : "s"}</span></header>
      ${staticHtml(e.me, ch)}
      ${state.room ? jamCardHtml(e) : ""}
      <div class="vote">${clapsOn() ? `<button class="clap" data-clap="${i}" aria-label="Clap for ${esc(e.name || `player ${i + 1}`)}" ${clapDisabled(e) ? "disabled" : ""}>👏 <b>${e.votes}</b></button>${top > 0 && e.votes === top ? `<span class="crown">${state.room?.data?.phase === "results" ? "winner" : "leading"}</span>` : ""}` : ""}${state.room && e.id === playerId() ? `<span class="crown mine">yours</span>` : ""}</div>
    </article>`;
  }).join("");
  $("#compare-empty").hidden = cmp.entries.length > 0;
}
function compareLink() {
  const cmp = state.compare;
  return linkTo("cmp", { c: cmp.c, e: cmp.entries.map((e) => ({ name: e.name, me: e.me })) });
}



// ---------- render ----------
const $ = (s) => document.querySelector(s);

function render() {
  // In a challenge, a change past the move budget is undone.
  if (state.room) jamBeforeRender();
  if (state.game && state.game.c.n > 0) {
    if (movesUsed() > state.game.c.n && state.game.good) {
      state.pick = clone(state.game.good.pick);
      state.beats = { ...state.game.good.beats };
      toast(`That would be move ${state.game.c.n + 1} of ${state.game.c.n}. Put something back first.`);
    }
    state.game.good = { pick: clone(state.pick), beats: { ...state.beats } };
  }
  // Drop pins and selection that point at words which no longer exist.
  state.pins = state.pins.filter((key) => {
    const [slot, p] = key.split("|");
    if (slot === "beat") return !!form().beats[p];
    const at = state.pick[slot] && locate(slot, state.pick[slot], p.split("."));
    return at && at.k in at.ph.w;
  });
  const ctx = context();
  history.replaceState(null, "", toHash());

  const inPlay = stanza().slots;
  $("#legend").innerHTML = SLOTS.filter((s) => inPlay.includes(s.key)).map((s) =>
    `<button class="chip ${cardClass(s.key)}" data-roll="${s.key}" title="Reroll ${s.hint}, keeping pinned words">${s.label} <span aria-hidden="true">↻</span></button>`).join("");

  renderGameBar();
  document.body.classList.toggle("verse", !!form().lines);
  $("#bit").innerHTML = bitHtml(ctx);
  $("#story").innerHTML = story(ctx).map((p) => `<p>${p}</p>`).join("");

  $("#grammar-pick").innerHTML = allGrammars().map((g) =>
    `<option value="${esc(g.id)}" ${g.id === G.id ? "selected" : ""}>${esc(g.name)}${library[g.id] ? " (yours)" : ""}</option>`).join("");
  $("#grammar-desc").textContent = [G.description, ...(G.rules.constraints || []).map(describeConstraint).filter(Boolean).map((x) => cap(x) + ".")].filter(Boolean).join(" ");
  $("#headline-name").textContent = G.headline || "The line";
  $("#dial-name").textContent = G.rules.dialName || "Dial";
  document.querySelectorAll(".dial button[data-dial]").forEach((b) => { b.textContent = G.rules.dialLabels[+b.dataset.dial]; });
  $("#forms").innerHTML = Object.entries(FORMS).map(([k, f]) =>
    `<button data-form="${k}" aria-pressed="${k === state.form}">${esc(f.name)}</button>`).join("");
  document.querySelectorAll(".dial button[data-dial]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.dial === state.dial)));
  $("#dial-note").textContent = DIAL_NOTES[state.dial];

  $("#len-n").textContent = state.len;
  $("#len-name").textContent = stanza().name;
  $("#len-down").disabled = state.len <= 1;
  $("#len-up").disabled = state.len >= maxLen();
  $("#len-pips").innerHTML = form().stanzas.map((_, i) => `<span class="${i < state.len ? "on" : ""}"></span>`).join("");

  $("#pairs").innerHTML = pairsInPlay().map((p) => {
    const c = clashes(p);
    return `<li class="${c ? "clash" : "fit"}"><span class="pair-label">${p.label}</span><span class="pair-state">${c ? "clashes" : "fits"}</span></li>`;
  }).join("");

  renderPicker();
  if (state.room) jamAfterRender();
}

// Switch to another grammar: a fresh piece in its first form.
function switchGrammar(id) {
  const g = resolveGrammar(id);
  if (!g || g === G) return;
  if (state.game) leaveGame();
  useGrammar(g);
  Object.assign(state, { grammar: g.id, form: Object.keys(g.forms)[0], beats: {}, pins: [], sel: null, pick: {} });
  state.len = Math.min(Math.max(state.len, 2), maxLen());
  for (const c of SLOTS) state.pick[c.key] = randomPhrase(c.key);
  state.seed = 1 + rand(1e9);
  for (const c of SLOTS.slice(1)) pickFrom(c.key, Array.from({ length: 300 }, () => randomPhrase(c.key)));
  renderBankForm();
  renderBank();
  renderCast();
  render();
  renderLibrary();
}
const allGrammars = () => [...Object.values(GRAMMARS), ...Object.values(library)];

function setForm(key) {
  if (!FORMS[key] || key === state.form) return;
  state.form = key;
  state.len = Math.min(Math.max(state.len, 2), maxLen());
  state.beats = {};
  state.pins = state.pins.filter((p) => !p.startsWith("beat|"));
  state.sel = null;
  render();
}

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

function setLen(n) {
  state.len = Math.max(1, Math.min(maxLen(), n));
  render();
}

function renderCast() {
  const el = $("#cast");
  // The cast belongs to grammars with a pronoun card (characters); others don't have one.
  $(".cast-wrap").hidden = !G.pronouns;
  $("#keep").hidden = !G.pronouns;
  if (!G.pronouns) return;
  const here = castHere();
  if (!here.length) {
    el.innerHTML = `<p class="empty">Nobody yet. Keep a bit and its character joins the cast. Tell more stories about them and they start to feel like someone you know.</p>`;
    return;
  }
  el.innerHTML = here.map(({ c, i }) => {
    const pr = word(G.pronouns, c.who, "n");
    return `
    <article class="person">
      <header><h3>${esc(cap(flat(tokens(G.pronouns, c.who, pr, G.pronouns))))}</h3>
        <span class="count">${c.bits.length} ${c.bits.length === 1 ? "story" : "stories"}</span></header>
      <ul>${c.bits.slice(0, 6).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      <div class="person-actions">
        <button class="ghost" data-another="${i}">Tell another about ${esc(pr.o)}</button>
        <button class="ghost subtle" data-forget="${i}">Forget</button>
      </div>
    </article>`;
  }).join("");
}

// ---------- word bank form ----------
function renderBankForm() {
  const sel = $("#bf-slot");
  const keep = sel.value;
  sel.innerHTML = SLOTS.map((s) => `<optgroup label="${esc(s.label)}">${SCHEMAS[s.key].parts.map((p) =>
    `<option value="${s.key}.${p.k}">${esc(s.label)}: ${esc(p.name)}</option>`).join("")}</optgroup>`).join("");
  // Default to a describing slot if the grammar has one, else the first slot.
  const fallback = SLOTS.flatMap((s) => SCHEMAS[s.key].parts.filter((p) => p.k === "q").map((p) => `${s.key}.${p.k}`))[0];
  sel.value = [...sel.options].some((o) => o.value === keep) ? keep : fallback || sel.options[0].value;
  $("#bank-h").textContent = `Word bank · ${G.name}`;
  updateBankForm();
}
function formEntry() {
  const [s, k] = $("#bf-slot").value.split(".");
  const e = { g: G.id, s, k, t: cleanWord($("#bf-text").value), tier: +document.querySelector('[name="bf-tier"]:checked').value };
  if (needsMood(s, k, G)) e.v = +document.querySelector('[name="bf-mood"]:checked').value;
  if (detsFor(s, k, G)) e.det = $("#bf-det").value;
  if (needsPronouns(s, k, G)) e.pr = $("#bf-pr").value;
  return e;
}
function updateBankForm() {
  const [s, k] = $("#bf-slot").value.split(".");
  const part = partOf(s, k);
  const dets = detsFor(s, k, G);
  $("#bf-mood-row").hidden = !part.mood;
  $("#bf-det-row").hidden = !dets;
  $("#bf-pr-row").hidden = !part.pronouns;
  if (dets) {
    const d = $("#bf-det");
    const keep = d.value;
    d.innerHTML = dets.map((x) => `<option>${esc(x)}</option>`).join("");
    if (dets.includes(keep)) d.value = keep;
  }
  const e = formEntry();
  let det = e.det || "";
  const shown = e.t ? `<b>${esc(e.t)}</b>` : `<b class="blank">___</b>`;
  if (det === "a" && e.t) det = /^[aeiou]/i.test(e.t) ? "an" : "a";
  $("#bf-frame").innerHTML = esc(part.frame || "___").replace("{det}", esc(det)).replace("___", shown);
  const rules = (G.rules.constraints || []).map(describeConstraint).filter(Boolean);
  $("#bf-hint").textContent = [part.hint || `A word for “${part.name}”.`, rules.length ? `This grammar: ${rules.join("; ")}.` : ""].filter(Boolean).join(" ");
  const err = grammarClosed(G) ? "This grammar is closed: it only uses its own words. Fork it to add some." : e.t ? checkEntry(e, G) || (builtinHas(e) || bank.some((b) => sameWord(b, e)) ? "Already in the bank." : "") : "";
  $("#bf-error").textContent = err;
  $("#bf-add").disabled = !e.t || !!err;
}
function renderBank() {
  const el = $("#bank-list");
  const mineAll = bank.map((e, i) => ({ e, i })).filter((x) => gOf(x.e) === G.id && partIn(G, x.e.s, x.e.k));
  if (!mineAll.length) {
    el.innerHTML = `<p class="empty">No words of your own for ${esc(G.name)} yet. Add one above, or type your own in any word's picker.</p>`;
  } else {
    el.innerHTML = SLOTS.map((s) => {
      const mine = mineAll.filter((x) => x.e.s === s.key);
      if (!mine.length) return "";
      return `<div class="bank-group"><h4>${esc(s.label)}</h4>${mine.map((x) =>
        `<span class="bank-word" title="${esc(partOf(x.e.s, x.e.k).name)} · ${TIER_NAMES[x.e.tier]}">${esc(x.e.t)}<span class="bw-slot">${esc(partOf(x.e.s, x.e.k).name)}</span><button class="bw-x" data-unbank="${x.i}" aria-label="Remove ${esc(x.e.t)} from your bank">✕</button></span>`).join("")}</div>`;
    }).join("");
  }
  $("#bank-share").disabled = $("#bank-suggest").disabled = !mineAll.length;
  $("#bank-count").textContent = mineAll.length ? `${mineAll.length} word${mineAll.length === 1 ? "" : "s"}` : "";
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// ---------- events ----------
const pathOf = (el) => (el.dataset.path ? el.dataset.path.split(".") : []);
function copy(text, ok) {
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
    .then(() => toast(ok))
    .catch(() => window.prompt("Copy this link:", text));
}

document.addEventListener("click", (e) => {
  if (!(e.target instanceof Element)) return;
  const t = e.target.closest("button");
  const inPicker = e.target.closest("#picker");
  if (!t) {
    // A beat is any part of a story sentence that isn't a word.
    const beat = !inPicker && e.target.closest(".beat");
    if (beat) { selectBeat(beat.dataset.beat); return; }
    if (state.sel && !inPicker) { state.sel = null; render(); }
    return;
  }
  const s = state.sel;
  if (t.dataset.act) {
    const act = t.dataset.act;
    if (act === "close") { state.sel = null; render(); }
    else if (act === "prev") step(-1);
    else if (act === "next") step(1);
    else if (act === "putback") putBack();
    else if (s.beat) {
      if (act === "surprise") surpriseBeat(s.beat);
      else if (act === "pin") togglePin("beat", [s.beat]);
      else if (act === "untune") { const b = { ...state.beats }; delete b[s.beat]; state.beats = b; render(); }
    }
    else if (act === "surprise") surprise(s.slot, s.path);
    else if (act === "pin") togglePin(s.slot, s.path);
    else if (act === "remove") removeWord(s.slot, s.path);
    return;
  }
  if (t.dataset.opt !== undefined) {
    if (s.beat) setBeat(s.beat, pickerVals[+t.dataset.opt]);
    else setValue(s.slot, s.path, pickerVals[+t.dataset.opt]);
    return;
  }
  if (inPicker) return;
  if (t.classList.contains("word")) { select(t.dataset.slot, pathOf(t), t); return; }
  if (t.dataset.add) { addWord(t.dataset.add, pathOf(t)); return; }
  if (state.sel && !t.closest(".controls")) state.sel = null;
  if (t.dataset.roll) reroll([t.dataset.roll]);
  else if (t.dataset.form) setForm(t.dataset.form);
  else if (t.id === "daily") { const c = parseChallenge(dailyChallenge()); if (c) startGame(c); }
  else if (t.dataset.dial) { state.dial = +t.dataset.dial; reroll(SLOTS.map((x) => x.key)); }
  else if (t.dataset.another !== undefined) tellAnother(+t.dataset.another);
  else if (t.dataset.forget !== undefined) { cast.splice(+t.dataset.forget, 1); saveCast(); renderCast(); }
  else if (t.dataset.unbank !== undefined) { bank.splice(+t.dataset.unbank, 1); saveBank(); renderBank(); updateBankForm(); render(); }
  else if (t.id === "len-up") setLen(state.len + 1);
  else if (t.id === "len-down") setLen(state.len - 1);
  else if (t.id === "shuffle") reroll(SLOTS.map((x) => x.key));
  else if (t.id === "retell") retell();
  else if (t.id === "keep") keepBit();
  else if (t.id === "challenge") { const pnl = $("#challenge-panel"); pnl.hidden = !pnl.hidden; if (!pnl.hidden) $("#ch-name").focus(); }
  else if (t.id === "ch-copy" || t.id === "ch-play") {
    const c = { h: cleanName($("#ch-name").value), n: +document.querySelector('[name="ch-n"]:checked').value, s: fixedSnapshot() };
    if (t.id === "ch-copy") copy(linkTo("c", c), `Challenge copied. Everyone gets the same bit and ${c.n} move${c.n === 1 ? "" : "s"}.`);
    else startGame(parseChallenge(c), undefined, c.h);
  }
  else if (t.id === "gb-submit") copy(linkTo("s", playPayload()), "Your version is copied. Paste it in the group chat.");
  else if (t.id === "gb-compare") { const me = playPayload(); openCompare(state.game.c, [parseCopy(me)].filter(Boolean)); }
  else if (t.id === "gb-leave") leaveGame();
  else if (t.id === "cmp-add") {
    const n = addEntries(linksIn($("#cmp-paste").value));
    $("#cmp-paste").value = "";
    toast(n ? `Added ${n} version${n === 1 ? "" : "s"}.` : "No new versions in that text.");
    renderCompare();
  }
  else if (t.id === "cmp-copy") copy(compareLink(), "Compare link copied. Everyone who opens it sees all the versions.");
  else if (t.id === "cmp-play") startGame(state.compare.c, undefined, "");
  else if (t.id === "cmp-close") { state.compare = null; $("#compare").hidden = true; render(); }
  else if (t.dataset.clap !== undefined) {
    const e = state.compare.entries[+t.dataset.clap];
    if (state.room) roomSend({ t: "clap", to: e.id });
    else { e.votes++; renderCompare(); }
  }
  else if (t.id === "live") openRoom(newRoomCode());
  else if (t.id === "share") copy(location.href, "Link copied. Same words, same story.");
  else if (t.id === "bank-share") copy(packLink(), "Pack link copied. Whoever opens it gets your words in their bank.");
  else if (t.id === "bank-suggest") {
    const url = suggestLink();
    if (url.length > 7500) toast("That's a lot of words for one suggestion. Share a pack link instead, or remove a few.");
    else window.open(url, "_blank", "noopener");
  }
  else render();
});

document.addEventListener("submit", (e) => {
  e.preventDefault();
  if (e.target.matches(".pk-own")) {
    const input = e.target.elements.own;
    if (state.sel) useOwn(state.sel.slot, state.sel.path, input.value);
  } else if (e.target.id === "bank-form") {
    const entry = formEntry();
    if (addToBank([entry])) {
      toast(`Added “${entry.t}” to your word bank. It'll turn up in shuffles.`);
      $("#bf-text").value = "";
    }
    renderBank();
    updateBankForm();
    render();
  }
});
document.addEventListener("input", (e) => {
  if (e.target instanceof Element && e.target.id === "gb-name" && state.game) {
    state.game.name = cleanName(e.target.value);
    history.replaceState(null, "", toHash());
  }
});
const inBankForm = (e) => e.target instanceof Element && e.target.closest("#bank-form");
document.addEventListener("input", (e) => { if (inBankForm(e)) updateBankForm(); });
document.addEventListener("change", (e) => {
  if (inBankForm(e)) updateBankForm();
  else if (e.target instanceof Element && e.target.id === "grammar-pick") switchGrammar(e.target.value);
});

// Hovering a word outlines the phrase it belongs to, so it's clear what a clause attaches to.
document.addEventListener("mouseover", (e) => {
  const w = e.target instanceof Element && e.target.closest(".word, .ghost-slot");
  document.querySelectorAll(".ph.hl").forEach((x) => x.classList.remove("hl"));
  if (w) w.closest(".ph")?.classList.add("hl");
});

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const target = e.target instanceof Element ? e.target : document.body;
  const typing = target.closest("input, textarea, select");
  if (!typing && (e.key === "Enter" || e.key === " ") && target.closest(".beat") && !target.closest("button")) {
    e.preventDefault();
    selectBeat(target.closest(".beat").dataset.beat);
    return;
  }
  if (state.sel && state.sel.beat && !typing) {
    const s = state.sel;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); step(-1); selectedEl()?.focus({ preventScroll: true }); return; }
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); step(1); selectedEl()?.focus({ preventScroll: true }); return; }
    if (e.key === "Escape") { state.sel = null; render(); document.querySelector(`.beat[data-beat="${s.beat}"]`)?.focus(); return; }
    if (e.key === "p") { togglePin("beat", [s.beat]); return; }
    if (e.key === "?") { surpriseBeat(s.beat); return; }
  }
  if (state.sel && !state.sel.beat && !typing) {
    const s = state.sel;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); step(-1); selectedEl()?.focus({ preventScroll: true }); return; }
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); step(1); selectedEl()?.focus({ preventScroll: true }); return; }
    if (e.key === "Escape") { state.sel = null; render(); document.querySelector(`.word[data-slot="${s.slot}"][data-path="${s.path.join(".")}"]`)?.focus(); return; }
    if (e.key === "p") { togglePin(s.slot, s.path); return; }
    if (e.key === "?") { surprise(s.slot, s.path); return; }
    if ((e.key === "Backspace" || e.key === "Delete") && partOf(locate(s.slot, state.pick[s.slot], s.path).schema, s.path[s.path.length - 1]).opt) { removeWord(s.slot, s.path); return; }
  }
  if (e.key === "Escape" && typing && state.sel) { state.sel = null; render(); return; }
  if (typing) return;
  if (state.game && [" ", "r", "+", "=", "]", "-", "["].includes(e.key)) return;
  if (e.key === " " && !target.closest("button")) { e.preventDefault(); state.sel = null; reroll(SLOTS.map((x) => x.key)); }
  else if (e.key === "r") retell();
  else if (e.key === "k") keepBit();
  else if (e.key === "+" || e.key === "=" || e.key === "]") setLen(state.len + 1);
  else if (e.key === "-" || e.key === "[") setLen(state.len - 1);
});
addEventListener("resize", () => state.sel && positionPicker());

// ---------- boot ----------
(async function boot() {
  await loadPacks();
  cast = loadCast();
  const h = location.hash.slice(1);
  const [kind, data] = h.includes("=") ? [h.slice(0, h.indexOf("=")), h.slice(h.indexOf("=") + 1)] : ["", h];
  const read = () => { try { return JSON.parse(unb64(data)); } catch { return null; } };
  let ready = false;
  if (kind === "pack") importPack(data);
  else if (kind === "grammar") receiveGrammar(data);
  else if ((kind === "jam" || kind === "room") && ROOM_CODE.test(data.split("~")[0])) {
    // Start with a fresh story under the room; the room takes over once connected.
    for (const sl of SLOTS) state.pick[sl.key] = randomPhrase(sl.key);
    state.seed = 1 + rand(1e9);
    ready = true;
    const [code, key = ""] = data.split("~");
    queueMicrotask(() => openRoom(code, key));
  }
  else if (h === "daily") { const c = parseChallenge(dailyChallenge()); if (c) { startGame(c); ready = true; } }
  else if (kind === "c") { const c = parseChallenge(read()); if (c) { startGame(c); ready = true; } }
  else if (kind === "p") { const cp = parseCopy(read()); if (cp) { startGame(cp.c, cp.me, cp.name); ready = true; } }
  else if (kind === "s" || kind === "cmp") {
    const copies = linksIn("#" + h);
    if (copies.length) { applySnapshot(copies[0].c.s); state.pins = []; ready = true; queueMicrotask(() => openCompare(copies[0].c, copies)); }
  }
  else ready = fromHash(h);
  if (!ready) {
    for (const s of SLOTS) state.pick[s.key] = randomPhrase(s.key);
    state.seed = 1 + rand(1e9);
    // Settle the pairs under the dial before the first render.
    for (const s of SLOTS.slice(1)) pickFrom(s.key, Array.from({ length: 300 }, () => randomPhrase(s.key)));
  }
  $("#live").hidden = !ROOMS_HOST;
  renderBankForm();
  renderBank();
  render();
  renderCast();
  renderLibrary();
  if (lib.incoming) $("#library").scrollIntoView({ behavior: "smooth", block: "start" });
})();
