// Story Bits: "x happened to p and they feel e about it", built card by card, word by word.

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

// Length in stanzas. Each step brings in one more beat, and some bring in a new card.
// The bit itself is always stanza one; from two on, the story always lands.
const LENGTHS = [
  { slots: ["who", "what", "feel"], name: "Just the bit" },
  { slots: ["who", "what", "feel", "where"], name: "Bit + landing" },
  { slots: ["who", "what", "feel", "where", "thing"], name: "Short story" },
  { slots: ["who", "what", "feel", "where", "thing"], name: "With a turn" },
  { slots: ["who", "what", "feel", "where", "thing"], name: "The full telling" },
];

// Incongruity is counted in pairs. Each new card adds a pair that can either fit or clash.
// event/feeling clash when their valence disagrees; the others clash across registers
// (mundane vs odd vs absurd), where a phrase's register is its strangest word.
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
const pairsInPlay = () => PAIRS.filter((p) => state.len >= p.from);

const state = {
  pick: {},
  locks: {},
  dial: 1,
  len: 2,
  seed: 1,
};

// ---------- randomness ----------
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

// ---------- phrases ----------
// A phrase is { w: { partKey: index }, sub: { partKey: phrase } }. Absent optional parts have
// no key in w. sub holds the nested thing for a word whose text contains {thing}.
const partOf = (schema, k) => SCHEMAS[schema].parts.find((p) => p.k === k);
const word = (schema, ph, k) => partOf(schema, k).pool[ph.w[k]];
const nests = (entry) => entry.t.includes("{thing}");

function phraseTier(schema, ph) {
  let t = 0;
  for (const k in ph.w) t = Math.max(t, word(schema, ph, k).tier);
  for (const k in ph.sub || {}) t = Math.max(t, phraseTier("thing", ph.sub[k]));
  return t;
}
const phraseV = (schema, ph) => word(schema, ph, "n").v;

// Can this part be present, given the rest of the phrase?
function allowed(schema, ph, part) {
  if (!part.needs) return true;
  if (part.needs === "adj") return !!word(schema, ph, "n").adj;
  return part.needs in ph.w;
}
// Pool entries usable at this depth: no further nesting at the bottom.
const usable = (part, depth) => part.pool.map((_, i) => i).filter((i) => depth < MAX_DEPTH || !nests(part.pool[i]));

// Set a word, growing or dropping its nested thing as needed, then drop anything it orphaned.
function setWord(schema, ph, k, i, depth) {
  ph.w[k] = i;
  if (nests(partOf(schema, k).pool[i])) {
    ph.sub = ph.sub || {};
    ph.sub[k] = randomPhrase("thing", depth + 1);
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

// Which optional parts are present. Nested things are kept a little shorter.
function randomShape(schema, depth = 0) {
  const shape = {};
  for (const p of SCHEMAS[schema].parts) if (p.opt) shape[p.k] = Math.random() < (depth ? 0.35 : 0.5);
  return shape;
}
const shapeOf = (ph) => Object.fromEntries(Object.keys(ph.w).map((k) => [k, true]));

function randomPhrase(schema, depth = 0, shape = randomShape(schema, depth)) {
  const ph = { w: {} };
  const parts = SCHEMAS[schema].parts;
  // Required parts first, so "needs" can be checked against them.
  const order = [...parts.filter((p) => !p.opt), ...parts.filter((p) => p.opt && !p.needs), ...parts.filter((p) => p.needs)];
  for (const p of order) {
    if ((p.opt && !shape[p.k]) || !allowed(schema, ph, p)) continue;
    const ok = usable(p, depth);
    setWord(schema, ph, p.k, ok[rand(ok.length)], depth);
  }
  return ph;
}

// Walk a path of part keys down through nested things. Returns the phrase the last key lives in.
function locate(slot, top, path) {
  let ph = top, schema = slot;
  for (const k of path.slice(0, -1)) { ph = ph.sub[k]; schema = "thing"; }
  return { ph, schema, depth: path.length - 1, k: path[path.length - 1] };
}

// ---------- text ----------
const pron = (t, who) => t.replace(/\{(\w+)\}/g, (m, k) => (k in PRONOUN_KEYS ? who[k] : m));
const PRONOUN_KEYS = { p: 1, o: 1, pos: 1, is: 1, has: 1, was: 1, s: 1 };

// A phrase as tokens: plain text, tunable words (with a path), and nested groups.
// A path lists part keys from the card down, e.g. ["c", "q"] = the quality of the thing
// nested in the clause.
function tokens(schema, ph, who, path = []) {
  const out = [];
  for (const p of SCHEMAS[schema].parts) {
    if (!(p.k in ph.w)) continue;
    const at = [...path, p.k];
    const text = pron(p.pool[ph.w[p.k]].t, who);
    if (text.includes("{thing}")) {
      const [before, after] = text.split("{thing}");
      out.push({ word: before.trim(), part: p, path: at });
      out.push({ group: tokens("thing", ph.sub[p.k], who, at) });
      if (after.trim()) out.push({ text: after.trim() });
    } else out.push({ word: text, part: p, path: at });
  }
  // Determiner: who and where carry their own; things take a/an.
  let det = schema === "thing" ? "a" : schema === "who" || schema === "where" ? word(schema, ph, "n").det : "";
  if (det === "a" || det === "an") det = /^[aeiou]/i.test(firstText(out)) ? "an" : "a";
  if (det) out.unshift({ text: det });
  return out;
}
function firstText(toks) {
  const t = toks[0];
  return t.group ? firstText(t.group) : t.word ?? t.text;
}
const flat = (toks) => toks.map((t) => (t.group ? flat(t.group) : t.word ?? t.text)).join(" ");

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const mark = (s, key) => `<mark class="b-${key}">${s}</mark>`;

function fill(tpl, ctx) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    if (k === "Who") return cap(ctx.who.n);
    if (k === "who") return ctx.who.n;
    if (k === "P") return cap(ctx.who.p);
    if (k === "where") return mark(ctx.where, "where");
    if (k === "thing") return mark(ctx.thing, "thing");
    if (k in PRONOUN_KEYS) return ctx.who[k];
    return "";
  });
}

const person = () => word("who", state.pick.who, "n");
function context() {
  const pr = person();
  const text = (slot) => flat(tokens(slot, state.pick[slot], pr));
  return {
    who: { ...pr, n: text("who") },
    what: { t: text("what"), v: phraseV("what", state.pick.what) },
    feel: { t: text("feel"), v: phraseV("feel", state.pick.feel) },
    where: text("where"),
    thing: text("thing"),
  };
}

// The one-line bit: "<who> <what>, and <p> <is> <feel>."
function bitLine(ctx, html = true) {
  const m = html ? mark : (s) => s;
  return `${m(cap(ctx.who.n), "who")} ${m(ctx.what.t, "what")}, and ${ctx.who.p} ${ctx.who.is} ${m(ctx.feel.t, "feel")}.`;
}

function story(ctx) {
  const rng = seeded(state.seed);
  const L = state.len;
  if (L < 2) return [];
  const fv = String(ctx.feel.v);
  const turnTier = Math.min(2, pairsInPlay().filter((p) => clashes(p)).length);
  // Draw every beat in a fixed order so growing the story keeps the earlier lines.
  const b = {
    setup: choose(BEATS.setup, rng), dwell: choose(BEATS.dwell[fv], rng),
    thing: choose(BEATS.thing, rng), after: choose(BEATS.thingAfter, rng),
    turn: choose(BEATS.turn[turnTier], rng),
    resolve: choose(BEATS.resolve.filter((r) => L >= 3 || !r.includes("{thing}")), rng),
    tag: choose(BEATS.tag.filter((r) => L >= 3 || !r.includes("{thing}")), rng),
  };
  const paras = [[b.setup, L >= 5 && b.dwell]];
  if (L >= 3) paras.push([b.thing, b.after, L >= 4 && b.turn]);
  paras.push([b.resolve, L >= 5 && b.tag]);
  return paras.map((p) => p.filter(Boolean).map((s) => fill(s, ctx)).join(" "));
}

// ---------- picking under the dial ----------
// Keep only the values that make each pair this slot belongs to fit or clash as the dial asks.
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
  const cur = JSON.stringify(state.pick[slot]);
  ok = constrain(slot, ok);
  if (ok.length > 1) ok = ok.filter((v) => JSON.stringify(v) !== cur);
  state.pick[slot] = ok[rand(ok.length)];
}

function reroll(keys) {
  // Slots settle in order: "feel" is chosen relative to "what", "thing" relative to "where".
  for (const s of SLOTS) {
    if (!keys.includes(s.key) || state.locks[s.key]) continue;
    // A full shuffle reshapes the phrase; rerolling one card keeps which words it has.
    const shape = keys.length > 1 ? randomShape(s.key) : shapeOf(state.pick[s.key]);
    pickFrom(s.key, Array.from({ length: 300 }, () => randomPhrase(s.key, 0, shape)));
  }
  state.seed = 1 + rand(1e9);
  render();
}

// Reroll a single word anywhere in a card, nested or not. Everything else stays.
function rerollWord(slot, path) {
  if (state.locks[slot]) return;
  const { schema, depth, k, ph } = locate(slot, state.pick[slot], path);
  const part = partOf(schema, k);
  const ok = usable(part, depth).filter((i) => i !== ph.w[k]).map((i) => {
    const top = clone(state.pick[slot]);
    const at = locate(slot, top, path);
    setWord(at.schema, at.ph, k, i, depth);
    return top;
  });
  if (!ok.length) return;
  pickFrom(slot, ok);
  render();
}

// Grow or shrink a phrase by one word, in its schema's grow order. Works on nested things too.
function growable(schema, ph) {
  return SCHEMAS[schema].grow.find((k) => !(k in ph.w) && allowed(schema, ph, partOf(schema, k)));
}
const shrinkable = (schema, ph) => [...SCHEMAS[schema].grow].reverse().find((k) => k in ph.w);

function resize(slot, path, dir) {
  if (state.locks[slot]) return;
  const top = state.pick[slot];
  const here = path.length ? locate(slot, top, [...path, "_"]) : { ph: top, schema: slot, depth: 0 };
  if (dir < 0) {
    const k = shrinkable(here.schema, here.ph);
    if (k) dropWord(here.schema, here.ph, k);
    render();
    return;
  }
  const k = growable(here.schema, here.ph);
  if (!k) return;
  const ok = usable(partOf(here.schema, k), here.depth).map((i) => {
    const t = clone(top);
    const at = path.length ? locate(slot, t, [...path, "_"]) : { ph: t, schema: slot };
    setWord(at.schema, at.ph, k, i, here.depth);
    return t;
  });
  pickFrom(slot, ok);
  render();
}

// ---------- cast (characters you keep telling stories about) ----------
// Each entry: { who: phrase, bits: [lines] }, keyed by the person underneath any descriptor.
const CAST_KEY = "story-bits-cast";
function loadCast() {
  try {
    const raw = JSON.parse(localStorage.getItem(CAST_KEY)) || [];
    // Older entries stored a bare index into the people list.
    return raw.map((c) => (typeof c.who === "number" ? { ...c, who: { w: { n: c.who } } } : c))
      .filter((c) => validPhrase("who", c.who, 0) && Array.isArray(c.bits));
  } catch { return []; }
}
function saveCast(cast) {
  try { localStorage.setItem(CAST_KEY, JSON.stringify(cast)); } catch {}
}
let cast = loadCast();

function keepBit() {
  const ctx = context();
  const line = bitLine(ctx, false);
  const n = state.pick.who.w.n;
  let c = cast.find((x) => x.who.w.n === n);
  if (!c) { c = { who: null, bits: [] }; cast.unshift(c); }
  c.who = clone(state.pick.who);
  if (!c.bits.includes(line)) c.bits.unshift(line);
  saveCast(cast);
  renderCast();
  toast(`Kept. ${cap(ctx.who.n)} now has ${c.bits.length} ${c.bits.length === 1 ? "story" : "stories"}.`);
}

function tellAnother(n) {
  const c = cast.find((x) => x.who.w.n === n);
  if (!c) return;
  state.pick.who = clone(c.who);
  state.locks = { who: true };
  reroll(["what", "feel", "where", "thing"]);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- URL share ----------
// The hash is the whole state as base64url JSON, so a link reproduces every word.
function validPhrase(schema, ph, depth) {
  if (!ph || typeof ph.w !== "object") return false;
  const parts = SCHEMAS[schema].parts;
  if (!Object.keys(ph.w).every((k) => parts.some((p) => p.k === k))) return false;
  for (const p of parts) {
    if (!(p.k in ph.w)) { if (!p.opt) return false; continue; }
    const i = ph.w[p.k];
    if (!Number.isInteger(i) || i < 0 || i >= p.pool.length) return false;
    if (nests(p.pool[i]) && (depth >= MAX_DEPTH || !validPhrase("thing", ph.sub?.[p.k], depth + 1))) return false;
  }
  return SCHEMAS[schema].parts.every((p) => !(p.k in ph.w) || allowed(schema, ph, p));
}
const b64 = (s) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));
function toHash() {
  return "#" + b64(JSON.stringify({ p: state.pick, d: state.dial, s: state.seed, l: state.len }));
}
function fromHash() {
  try {
    const { p, d, s, l } = JSON.parse(unb64(location.hash.slice(1)));
    if (![0, 1, 2].includes(d) || !Number.isInteger(l) || l < 1 || l > 5 || !Number.isInteger(s)) return false;
    if (!SLOTS.every((x) => validPhrase(x.key, p[x.key], 0))) return false;
    Object.assign(state, { pick: p, dial: d, seed: s || 1, len: l });
    return true;
  } catch { return false; }
}

// ---------- render ----------
const $ = (s) => document.querySelector(s);

function tokHtml(toks, slot, locked) {
  return toks.map((t) => {
    if (t.group) return `<span class="nest">${tokHtml(t.group, slot, locked)}${nestSteps(slot, t.group, locked)}</span>`;
    if (t.text) return `<span class="plain">${esc(t.text)}</span>`;
    return `<button class="word w-${t.part.k}" data-slot="${slot}" data-path="${t.path.join(".")}" title="Reroll the ${t.part.name}" ${locked ? "disabled" : ""}>${esc(t.word)}</button>`;
  }).join("");
}
// −/+ for a nested thing: find its path from any word inside it.
function nestSteps(slot, group, locked) {
  const w = group.find((t) => t.word !== undefined);
  const path = w.path.slice(0, -1);
  const { ph } = locate(slot, state.pick[slot], [...path, "_"]);
  const dis = (on) => (locked || !on ? "disabled" : "");
  return `<span class="nest-steps">
    <button class="mini sm" data-resize="-1" data-slot="${slot}" data-path="${path.join(".")}" title="Drop a word from this thing" aria-label="Drop a word" ${dis(shrinkable("thing", ph))}>−</button>
    <button class="mini sm" data-resize="1" data-slot="${slot}" data-path="${path.join(".")}" title="Add a word to this thing" aria-label="Add a word" ${dis(growable("thing", ph))}>+</button>
  </span>`;
}

function card(s, pr) {
  const ph = state.pick[s.key];
  const locked = !!state.locks[s.key];
  const dis = (on) => (locked || !on ? "disabled" : "");
  return `<div class="card c-${s.key}${locked ? " locked" : ""}">
    <div class="card-top"><span class="card-label">${s.label}</span>
      <span class="word-steps">
        <button class="mini" data-resize="-1" data-slot="${s.key}" data-path="" title="Drop a word" aria-label="Drop a word" ${dis(shrinkable(s.key, ph))}>−</button>
        <button class="mini" data-resize="1" data-slot="${s.key}" data-path="" title="Add a word" aria-label="Add a word" ${dis(growable(s.key, ph))}>+</button>
        <button class="lock" data-lock="${s.key}" aria-pressed="${locked}" title="${locked ? "Unlock" : "Lock"} ${s.hint}">${locked ? lockIcon : unlockIcon}</button>
      </span></div>
    <div class="card-body words" data-roll="${s.key}">${tokHtml(tokens(s.key, ph, pr), s.key, locked)}
      <button class="reroll-all" data-roll="${s.key}" title="Reroll ${s.hint}" aria-label="Reroll ${s.hint}" ${locked ? "disabled" : ""}>↻</button>
    </div>
  </div>`;
}

function render() {
  const ctx = context();
  history.replaceState(null, "", toHash());

  const inPlay = LENGTHS[state.len - 1].slots;
  const pr = person();
  $("#cards").dataset.n = inPlay.length;
  $("#cards").innerHTML = SLOTS.filter((s) => inPlay.includes(s.key)).map((s) => card(s, pr)).join("");

  $("#bit").innerHTML = bitLine(ctx);
  $("#story").innerHTML = story(ctx).map((p) => `<p>${p}</p>`).join("");

  document.querySelectorAll(".dial button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.dial === state.dial)));
  $("#dial-note").textContent = DIAL_NOTES[state.dial];

  $("#len-n").textContent = state.len;
  $("#len-name").textContent = LENGTHS[state.len - 1].name;
  $("#len-down").disabled = state.len <= 1;
  $("#len-up").disabled = state.len >= 5;
  $("#len-pips").innerHTML = LENGTHS.map((_, i) => `<span class="${i < state.len ? "on" : ""}"></span>`).join("");

  $("#pairs").innerHTML = pairsInPlay().map((p) => {
    const c = clashes(p);
    return `<li class="${c ? "clash" : "fit"}"><span class="pair-label">${p.label}</span><span class="pair-state">${c ? "clashes" : "fits"}</span></li>`;
  }).join("");
}

function setLen(n) {
  state.len = Math.max(1, Math.min(5, n));
  render();
}

function renderCast() {
  const el = $("#cast");
  if (!cast.length) {
    el.innerHTML = `<p class="empty">Nobody yet. Keep a bit and its character joins the cast. Tell more stories about them and they start to feel like someone you know.</p>`;
    return;
  }
  el.innerHTML = cast.map((c) => {
    const pr = word("who", c.who, "n");
    return `
    <article class="person">
      <header><h3>${esc(cap(flat(tokens("who", c.who, pr))))}</h3>
        <span class="count">${c.bits.length} ${c.bits.length === 1 ? "story" : "stories"}</span></header>
      <ul>${c.bits.slice(0, 6).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      <div class="person-actions">
        <button class="ghost" data-another="${c.who.w.n}">Tell another about ${esc(pr.o)}</button>
        <button class="ghost subtle" data-forget="${c.who.w.n}">Forget</button>
      </div>
    </article>`;
  }).join("");
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

const lockIcon = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
const unlockIcon = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 7V5a3 3 0 0 1 5.8-1" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;

// ---------- events ----------
const pathOf = (el) => (el.dataset.path ? el.dataset.path.split(".") : []);
document.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) {
    // Clicking the blank part of a card rerolls the whole card.
    const body = e.target.closest(".card-body[data-roll]");
    if (body && !state.locks[body.dataset.roll]) reroll([body.dataset.roll]);
    return;
  }
  if (t.dataset.path !== undefined && t.dataset.resize) resize(t.dataset.slot, pathOf(t), +t.dataset.resize);
  else if (t.dataset.path !== undefined && t.dataset.slot) rerollWord(t.dataset.slot, pathOf(t));
  else if (t.dataset.roll) reroll([t.dataset.roll]);
  else if (t.dataset.lock) { const k = t.dataset.lock; state.locks[k] = !state.locks[k]; render(); }
  else if (t.dataset.dial) { state.dial = +t.dataset.dial; reroll(SLOTS.map((s) => s.key)); }
  else if (t.dataset.another) tellAnother(+t.dataset.another);
  else if (t.dataset.forget) { cast = cast.filter((c) => c.who.w.n !== +t.dataset.forget); saveCast(cast); renderCast(); }
  else if (t.id === "len-up") setLen(state.len + 1);
  else if (t.id === "len-down") setLen(state.len - 1);
  else if (t.id === "shuffle") reroll(SLOTS.map((s) => s.key));
  else if (t.id === "retell") { state.seed = 1 + rand(1e9); render(); }
  else if (t.id === "keep") keepBit();
  else if (t.id === "share") {
    const url = location.href;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(() => toast("Link copied. Same words, same story."))
      .catch(() => toast(url));
  }
});
document.addEventListener("keydown", (e) => {
  if (e.target.closest("input, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === " " && !e.target.closest("button")) { e.preventDefault(); reroll(SLOTS.map((s) => s.key)); }
  else if (e.key === "r") { state.seed = 1 + rand(1e9); render(); }
  else if (e.key === "k") keepBit();
  else if (e.key === "+" || e.key === "=" || e.key === "]") setLen(state.len + 1);
  else if (e.key === "-" || e.key === "[") setLen(state.len - 1);
});

// ---------- boot ----------
if (!fromHash()) {
  for (const s of SLOTS) state.pick[s.key] = randomPhrase(s.key);
  state.seed = 1 + rand(1e9);
  // Settle the pairs under the dial without re-rendering in between.
  for (const s of SLOTS.slice(1)) pickFrom(s.key, Array.from({ length: 300 }, () => randomPhrase(s.key)));
}
render();
renderCast();
