// Story Bits: "x happened to p and they feel e about it", tuned word by word.

const SLOTS = [
  { key: "who", label: "Who", hint: "the character" },
  { key: "what", label: "What happened", hint: "the event" },
  { key: "feel", label: "How they feel", hint: "the feeling" },
  { key: "where", label: "Where", hint: "the place" },
  { key: "thing", label: "Thing", hint: "the object" },
];
const DIAL_NOTES = [
  "No pair clashes. A thing your mom would tell you on the phone.",
  "One pair clashes: the feeling doesn't fit what happened.",
  "Every pair in play clashes. The world gets strange, then lands safely.",
];

// The story's shape comes from its form (FORMS in data.js): each length is a stanza that
// says which cards are in play and which beats fill each paragraph.
const form = () => FORMS[state.form] || FORMS.bit;
const stanza = () => form().stanzas[state.len - 1];
const maxLen = () => form().stanzas.length;

// Incongruity is counted in pairs. Each new card adds a pair that can either fit or clash.
// event/feeling clash when their mood disagrees; the others clash across registers
// (plausible vs odd vs absurd), where a phrase's register is its strangest word.
const PAIRS = [
  { a: "what", b: "feel", label: "event ↔ feeling", from: 1 },
  { a: "where", b: "what", label: "place ↔ event", from: 2 },
  { a: "thing", b: "where", label: "thing ↔ place", from: 3 },
];
function clashes(pair, pick = state.pick) {
  if (pair.a === "what" && pair.b === "feel") return phraseV("what", pick.what) !== phraseV("feel", pick.feel);
  return phraseTier(pair.a, pick[pair.a]) !== phraseTier(pair.b, pick[pair.b]);
}
// Which pairs the dial wants clashing: none, just event/feeling, or all.
const wantClash = (i) => state.dial === 2 || (state.dial === 1 && i === 0);
const pairsInPlay = () => PAIRS.filter((p) => stanza().slots.includes(p.a) && stanza().slots.includes(p.b));

const state = {
  pick: {},
  dial: 1,
  len: 2,
  form: "bit",
  seed: 1,
  beats: {}, // beat key -> line index, for beats tuned by hand (the rest come from the seed)
  pins: [], // "slot|path" for words and "beat|key" for beats that survive shuffles
  sel: null, // { slot, path, occ } for a word, or { beat } for a beat, open in the picker
};

// ---------- small helpers ----------
const rand = (n) => Math.floor(Math.random() * n);
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
const sameWord = (a, b) => a.s === b.s && a.k === b.k && a.t.toLowerCase() === b.t.toLowerCase();
const builtinHas = (e) => partOf(e.s, e.k).pool.some((p) => p.t.toLowerCase() === e.t.toLowerCase());
function loadBank() {
  try { return (JSON.parse(localStorage.getItem(BANK_KEY)) || []).filter((e) => !checkEntry(e)); } catch { return []; }
}
function saveBank() {
  try { localStorage.setItem(BANK_KEY, JSON.stringify(bank)); } catch {}
}
let bank = loadBank();
// Adds checked, new words. Returns how many were added.
function addToBank(entries) {
  let n = 0;
  for (const e of entries) {
    if (checkEntry(e) || builtinHas(e) || bank.some((b) => sameWord(b, e))) continue;
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
// slots have no key. sub holds the nested thing for a word whose text contains {thing}.
// x marks a thing nested in a noun's clause: it may not take a clause of its own.
function entryOf(schema, k, val) {
  if (typeof val === "number") return partOf(schema, k).pool[val];
  return { ...poolEntry(asEntry(schema, k, val)), custom: true };
}
const word = (schema, ph, k) => entryOf(schema, k, ph.w[k]);
const nests = (entry) => entry.t.includes("{thing}");

function phraseTier(schema, ph) {
  let t = 0;
  for (const k in ph.w) t = Math.max(t, word(schema, ph, k).tier);
  for (const k in ph.sub || {}) t = Math.max(t, phraseTier("thing", ph.sub[k]));
  return t;
}
const phraseV = (schema, ph) => word(schema, ph, "n").v;

// Can this slot be filled, given the rest of the phrase?
function allowed(schema, ph, part) {
  if (part.k === "c" && ph.x) return false;
  if (!part.needs) return true;
  if (part.needs === "adj") return !!word(schema, ph, "n").adj;
  return part.needs in ph.w;
}
// Every value a slot can take at this depth: the built-in words, then your bank.
function options(schema, part, depth) {
  const out = part.pool.map((_, i) => i).filter((i) => depth < MAX_DEPTH || !nests(part.pool[i]));
  for (const e of bank) if (e.s === schema && e.k === part.k) out.push(asValue(e));
  return out;
}

// Set a word, growing or dropping its nested thing as needed, then drop anything it orphaned.
function setWord(schema, ph, k, val, depth) {
  ph.w[k] = val;
  if (nests(entryOf(schema, k, val))) {
    ph.sub = ph.sub || {};
    ph.sub[k] = randomPhrase("thing", depth + 1, undefined, schema === "thing" || schema === "where");
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
  for (const p of SCHEMAS[schema].parts) if (p.opt) shape[p.k] = Math.random() < (depth ? 0.35 : 0.5);
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
    setWord(schema, ph, p.k, ok[rand(ok.length)], depth);
  }
  return ph;
}

// Walk a path of slot keys down through nested things to the phrase holding the last key.
// Returns null if the path no longer exists.
function locate(slot, top, path) {
  let ph = top, schema = slot;
  for (const k of path.slice(0, -1)) {
    if (!ph.sub || !ph.sub[k]) return null;
    ph = ph.sub[k];
    schema = "thing";
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
  const ghostHere = ghosts && sel && sel.slot === slot && same(sel.path.slice(0, -1), path);
  const out = [];
  for (const p of SCHEMAS[schema].parts) {
    const at = [...path, p.k];
    if (!(p.k in ph.w)) {
      if (ghostHere && p.opt && allowed(schema, ph, p)) out.push({ ghost: p, path: at });
      continue;
    }
    const text = pron(word(schema, ph, p.k).t, who);
    if (text.includes("{thing}")) {
      const [before, after] = text.split("{thing}");
      out.push({ word: before.trim(), part: p, path: at });
      out.push({ group: tokens("thing", ph.sub[p.k], who, slot, at, ghosts), path: at });
      if (after.trim()) out.push({ text: after.trim() });
    } else out.push({ word: text, part: p, path: at });
  }
  // Determiner: people and places carry their own; things take a/an.
  let det = schema === "thing" ? "a" : schema === "who" || schema === "where" ? word(schema, ph, "n").det : "";
  if (det === "a" || det === "an") det = /^[aeiou]/i.test(firstText(out)) ? "an" : "a";
  if (det) out.unshift({ text: det });
  return out;
}
function firstText(toks) {
  for (const t of toks) {
    if (t.ghost) continue;
    return t.group ? firstText(t.group) : t.word ?? t.text;
  }
  return "";
}
const flat = (toks) => toks.filter((t) => !t.ghost).map((t) => (t.group ? flat(t.group) : t.word ?? t.text)).join(" ");

const person = () => word("who", state.pick.who, "n");
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
    if (first) { s = cap(s); first = false; }
    if (t.text !== undefined) return `<span class="plain">${esc(s)}</span>`;
    const p = t.path.join(".");
    const pinned = state.pins.includes(`${slot}|${p}`);
    const sel = state.sel && state.sel.slot === slot && same(state.sel.path, t.path);
    return `<button class="word${pinned ? " pinned" : ""}${sel ? " sel" : ""}" data-slot="${slot}" data-path="${p}" aria-label="${esc(s)}: tune the ${t.part.name}${pinned ? " (pinned)" : ""}">${esc(s)}</button>`;
  }).join(" ");
}
const phraseHtml = (slot, capFirst = false) =>
  `<span class="ph top b-${slot}">${tokHtml(tokens(slot, state.pick[slot], person(), slot, [], true), slot, capFirst)}</span>`;

function context() {
  const pr = person();
  return {
    who: { ...pr, n: phraseText("who") },
    what: { t: phraseText("what"), v: phraseV("what", state.pick.what) },
    feel: { t: phraseText("feel"), v: phraseV("feel", state.pick.feel) },
    where: phraseText("where"),
    thing: phraseText("thing"),
  };
}

// The one-line bit: "<who> <what>, and <p> <is> <feel>."
function bitLine(ctx) {
  return `${cap(ctx.who.n)} ${ctx.what.t}, and ${ctx.who.p} ${ctx.who.is} ${ctx.feel.t}.`;
}
function bitHtml(ctx) {
  return `${phraseHtml("who", true)} ${phraseHtml("what")}, and ${ctx.who.p} ${ctx.who.is} ${phraseHtml("feel")}.`;
}

function fill(tpl, ctx) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    if (k === "P") return cap(ctx.who.p);
    if (k === "where") return phraseHtml("where");
    if (k === "thing") return phraseHtml("thing");
    if (k === "Thing") return phraseHtml("thing", true);
    if (k in PRONOUN_KEYS) return ctx.who[k];
    return "";
  });
}
// The same, as plain text (for the picker's list of beat lines).
function fillText(tpl, ctx) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    if (k === "P") return cap(ctx.who.p);
    if (k === "where" || k === "thing") return ctx[k];
    if (k === "Thing") return cap(ctx.thing);
    if (k in PRONOUN_KEYS) return ctx.who[k];
    return "";
  });
}

// ---------- beats ----------
const beatGroup = (key) => form().beats[key];
// A beat's lines for this story: by-mood groups pick the pool for the feeling's mood.
function beatLines(key, ctx) {
  const g = beatGroup(key);
  return g.byMood ? g.lines[String(ctx.feel.v)] : g.lines;
}
// A line can be used once the cards it names are in play.
const lineFits = (line) => ["where", "thing"].every((k) => !new RegExp(`\\{${k}\\}`, "i").test(line.t) || stanza().slots.includes(k));
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
    let ok = lines.map((l, i) => ({ l, i })).filter((x) => lineFits(x.l));
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
    const pinned = state.pins.includes(`beat|${key}`);
    return `<span class="beat${sel === key ? " sel" : ""}${pinned ? " pinned" : ""}" data-beat="${key}" tabindex="0" role="button" aria-label="Tune ${esc(beatGroup(key).name)}">${fill(line.t, ctx)}</span>`;
  }).join(" "));
}

// ---------- picking under the dial ----------
// Keep only values that make each pair this card belongs to fit or clash as the dial asks.
// Constraints relax one at a time if nothing satisfies them all.
function constrain(slot, ok) {
  if (slot === "what") {
    // Keep the event itself grounded at low settings.
    const grounded = ok.filter((v) => phraseTier("what", v) <= state.dial);
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
      if (i < path.length - 1) { a = a.sub && a.sub[k]; b = b.sub && b.sub[k]; schema = "thing"; }
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
  const e = { s: at.schema, k: at.k, t, tier: cur.tier };
  if (needsMood(e.s, e.k)) e.v = cur.v;
  if (needsDet(e.s, e.k)) e.det = DETS[e.s].includes(cur.det) ? cur.det : DETS[e.s][0];
  if (e.s === "who" && e.k === "n") e.pr = Object.keys(PRON).find((k) => PRON[k].p === cur.p);
  const err = checkEntry(e);
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
    if (i < path.length - 1) { names.push("thing"); schema = "thing"; }
  });
  return names;
}

let pickerVals = [];
// The lines a beat can take right now, plain to strange.
function beatOptions(key, ctx) {
  return beatLines(key, ctx).map((l, i) => ({ l, i })).filter((x) => lineFits(x.l))
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
      <button data-act="pin" aria-pressed="${pinned}">${pinned ? "Pinned" : "Pin"}</button>
      ${Number.isInteger(state.beats[key]) ? `<button data-act="untune">Back to the dice</button>` : ""}
    </div>
    <div class="pk-list">${groups}</div>`;
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
  const at = sel && locate(sel.slot, state.pick[sel.slot], sel.path);
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
      <button data-act="pin" aria-pressed="${pinned}">${pinned ? "Pinned" : "Pin"}</button>
      ${part.opt ? `<button data-act="remove">Remove</button>` : ""}
    </div>
    <div class="pk-list">${groups}</div>
    <form class="pk-own" autocomplete="off">
      <input name="own" maxlength="60" placeholder="Your own ${esc(part.name)}…" aria-label="Your own ${esc(part.name)}">
      <button type="submit">Use</button>
    </form>`;
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
// Each entry: { who: phrase, bits: [lines] }, keyed by the person under any descriptor.
const CAST_KEY = "story-bits-cast";
const castKey = (who) => JSON.stringify(who.w.n);
function loadCast() {
  try {
    const raw = JSON.parse(localStorage.getItem(CAST_KEY)) || [];
    // Older entries stored a bare index into the people list.
    return raw.map((c) => (typeof c.who === "number" ? { ...c, who: { w: { n: c.who } } } : c))
      .filter((c) => validPhrase("who", c.who, 0) && Array.isArray(c.bits));
  } catch { return []; }
}
function saveCast() {
  try { localStorage.setItem(CAST_KEY, JSON.stringify(cast)); } catch {}
}
let cast = [];

function keepBit() {
  const ctx = context();
  const line = bitLine(ctx);
  const key = castKey(state.pick.who);
  let c = cast.find((x) => castKey(x.who) === key);
  if (!c) { c = { who: null, bits: [] }; cast.unshift(c); }
  c.who = clone(state.pick.who);
  if (!c.bits.includes(line)) c.bits.unshift(line);
  saveCast();
  renderCast();
  toast(`Kept. ${cap(ctx.who.n)} now has ${c.bits.length} ${c.bits.length === 1 ? "story" : "stories"}.`);
}
function tellAnother(i) {
  const c = cast[i];
  if (!c) return;
  state.pick.who = clone(c.who);
  // Pin the character's words; shuffle everything else.
  state.pins = state.pins.filter((p) => !p.startsWith("who|")).concat(Object.keys(c.who.w).map((k) => `who|${k}`));
  state.sel = null;
  reroll(["what", "feel", "where", "thing"]);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- links ----------
// A story link carries the whole state, your own words included, as base64url JSON.
function validValue(schema, part, val, depth) {
  if (typeof val === "number") return Number.isInteger(val) && val >= 0 && val < part.pool.length;
  return !!val && typeof val === "object" && typeof val.c === "string" && !checkEntry(asEntry(schema, part.k, val));
}
function validPhrase(schema, ph, depth) {
  if (!ph || typeof ph.w !== "object") return false;
  const parts = SCHEMAS[schema].parts;
  if (!Object.keys(ph.w).every((k) => parts.some((p) => p.k === k))) return false;
  for (const p of parts) {
    if (!(p.k in ph.w)) { if (!p.opt) return false; continue; }
    if (!validValue(schema, p, ph.w[p.k], depth)) return false;
    if (nests(entryOf(schema, p.k, ph.w[p.k])) && (depth >= MAX_DEPTH || !validPhrase("thing", ph.sub?.[p.k], depth + 1))) return false;
  }
  return parts.every((p) => !(p.k in ph.w) || allowed(schema, ph, p));
}
// Everything that makes a story what it is. v2 adds the form and hand-tuned beats.
function snapshot() {
  return { v: 2, f: state.form, p: state.pick, d: state.dial, s: state.seed, l: state.len, b: state.beats, pn: state.pins };
}
// Load a snapshot into state if it's valid. v1 links (no form, no beats) still load.
function loadSnapshot(x) {
  const { p, d, s, l, pn = [], f = "bit", b = {} } = x || {};
  if (!FORMS[f] || ![0, 1, 2].includes(d) || !Number.isInteger(s)) return false;
  if (!Number.isInteger(l) || l < 1 || l > FORMS[f].stanzas.length) return false;
  if (!p || !SLOTS.every((x) => validPhrase(x.key, p[x.key], 0))) return false;
  const beats = b && typeof b === "object" ? Object.fromEntries(Object.entries(b).filter(([k, i]) => FORMS[f].beats[k] && Number.isInteger(i) && i >= 0)) : {};
  Object.assign(state, { pick: p, dial: d, seed: s || 1, len: l, form: f, beats, pins: Array.isArray(pn) ? pn.filter((x) => typeof x === "string") : [] });
  return true;
}
function toHash() {
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
      for (const e of pack.words || []) if (!checkEntry(e) && !builtinHas(e)) partOf(e.s, e.k).pool.push(poolEntry(e));
    }
  } catch {}
}

// ---------- render ----------
const $ = (s) => document.querySelector(s);

function render() {
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
    `<button class="chip b-${s.key}" data-roll="${s.key}" title="Reroll ${s.hint}, keeping pinned words">${s.label} <span aria-hidden="true">↻</span></button>`).join("");

  $("#bit").innerHTML = bitHtml(ctx);
  $("#story").innerHTML = story(ctx).map((p) => `<p>${p}</p>`).join("");

  document.querySelectorAll(".dial button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.dial === state.dial)));
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
}

function setLen(n) {
  state.len = Math.max(1, Math.min(maxLen(), n));
  render();
}

function renderCast() {
  const el = $("#cast");
  if (!cast.length) {
    el.innerHTML = `<p class="empty">Nobody yet. Keep a bit and its character joins the cast. Tell more stories about them and they start to feel like someone you know.</p>`;
    return;
  }
  el.innerHTML = cast.map((c, i) => {
    const pr = word("who", c.who, "n");
    return `
    <article class="person">
      <header><h3>${esc(cap(flat(tokens("who", c.who, pr, "who"))))}</h3>
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
  sel.innerHTML = SLOTS.map((s) => `<optgroup label="${s.label}">${SCHEMAS[s.key].parts.map((p) =>
    `<option value="${s.key}.${p.k}">${s.label}: ${p.name}</option>`).join("")}</optgroup>`).join("");
  sel.value = "thing.q";
  updateBankForm();
}
function formEntry() {
  const [s, k] = $("#bf-slot").value.split(".");
  const e = { s, k, t: cleanWord($("#bf-text").value), tier: +document.querySelector('[name="bf-tier"]:checked').value };
  if (needsMood(s, k)) e.v = +document.querySelector('[name="bf-mood"]:checked').value;
  if (needsDet(s, k)) e.det = $("#bf-det").value;
  if (s === "who" && k === "n") e.pr = $("#bf-pr").value;
  return e;
}
function updateBankForm() {
  const [s, k] = $("#bf-slot").value.split(".");
  $("#bf-mood-row").hidden = !needsMood(s, k);
  $("#bf-det-row").hidden = !needsDet(s, k);
  $("#bf-pr-row").hidden = !(s === "who" && k === "n");
  if (needsDet(s, k)) {
    const d = $("#bf-det");
    const keep = d.value;
    d.innerHTML = DETS[s].map((x) => `<option>${x}</option>`).join("");
    if (DETS[s].includes(keep)) d.value = keep;
  }
  const info = SLOT_INFO[`${s}.${k}`];
  const e = formEntry();
  let det = e.det || "";
  const shown = e.t ? `<b>${esc(e.t)}</b>` : `<b class="blank">___</b>`;
  if (det === "a" && e.t) det = /^[aeiou]/i.test(e.t) ? "an" : "a";
  const frame = esc(info.frame).replace("{det}", det).replace("___", shown);
  $("#bf-frame").innerHTML = frame;
  $("#bf-hint").textContent = info.hint;
  const err = e.t ? checkEntry(e) || (builtinHas(e) || bank.some((b) => sameWord(b, e)) ? "Already in the bank." : "") : "";
  $("#bf-error").textContent = err;
  $("#bf-add").disabled = !e.t || !!err;
}
function renderBank() {
  const el = $("#bank-list");
  if (!bank.length) {
    el.innerHTML = `<p class="empty">No words of your own yet. Add one above, or type your own in any word's picker.</p>`;
  } else {
    el.innerHTML = SLOTS.map((s) => {
      const mine = bank.map((e, i) => ({ e, i })).filter((x) => x.e.s === s.key);
      if (!mine.length) return "";
      return `<div class="bank-group"><h4 class="b-${s.key}-text">${s.label}</h4>${mine.map((x) =>
        `<span class="bank-word" title="${esc(partOf(x.e.s, x.e.k).name)} · ${TIER_NAMES[x.e.tier]}">${esc(x.e.t)}<span class="bw-slot">${esc(partOf(x.e.s, x.e.k).name)}</span><button class="bw-x" data-unbank="${x.i}" aria-label="Remove ${esc(x.e.t)} from your bank">✕</button></span>`).join("")}</div>`;
    }).join("");
  }
  $("#bank-share").disabled = $("#bank-suggest").disabled = !bank.length;
  $("#bank-count").textContent = bank.length ? `${bank.length} word${bank.length === 1 ? "" : "s"}` : "";
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
  else if (t.dataset.dial) { state.dial = +t.dataset.dial; reroll(SLOTS.map((x) => x.key)); }
  else if (t.dataset.another !== undefined) tellAnother(+t.dataset.another);
  else if (t.dataset.forget !== undefined) { cast.splice(+t.dataset.forget, 1); saveCast(); renderCast(); }
  else if (t.dataset.unbank !== undefined) { bank.splice(+t.dataset.unbank, 1); saveBank(); renderBank(); updateBankForm(); render(); }
  else if (t.id === "len-up") setLen(state.len + 1);
  else if (t.id === "len-down") setLen(state.len - 1);
  else if (t.id === "shuffle") reroll(SLOTS.map((x) => x.key));
  else if (t.id === "retell") retell();
  else if (t.id === "keep") keepBit();
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
const inBankForm = (e) => e.target instanceof Element && e.target.closest("#bank-form");
document.addEventListener("input", (e) => { if (inBankForm(e)) updateBankForm(); });
document.addEventListener("change", (e) => { if (inBankForm(e)) updateBankForm(); });

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
  if (h.startsWith("pack=")) importPack(h.slice(5));
  if (h.startsWith("pack=") || !fromHash(h)) {
    for (const s of SLOTS) state.pick[s.key] = randomPhrase(s.key);
    state.seed = 1 + rand(1e9);
    // Settle the pairs under the dial before the first render.
    for (const s of SLOTS.slice(1)) pickFrom(s.key, Array.from({ length: 300 }, () => randomPhrase(s.key)));
  }
  renderBankForm();
  renderBank();
  render();
  renderCast();
})();
