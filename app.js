// Story Bits: five things, mad-lib style. "x happened to p and they feel e about it."

const SLOTS = [
  { key: "who", label: "Who", pool: WHO, hint: "the character" },
  { key: "what", label: "What happened", pool: WHAT, hint: "the event" },
  { key: "feel", label: "How they feel", pool: FEEL, hint: "the feeling" },
  { key: "where", label: "Where", pool: WHERE, hint: "the place" },
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
// (mundane vs odd vs absurd).
const PAIRS = [
  { a: "what", b: "feel", label: "event ↔ feeling", from: 1 },
  { a: "where", b: "what", label: "place ↔ event", from: 2 },
  { a: "thing", b: "where", label: "thing ↔ place", from: 3 },
];
const POOLS = { who: WHO, what: WHAT, feel: FEEL, where: WHERE };
function bitOf(key, pick) {
  return key === "thing" ? { tier: thingTier(pick.thing) } : POOLS[key][pick[key]];
}
function clashes(pair, pick = state.pick) {
  const A = bitOf(pair.a, pick), B = bitOf(pair.b, pick);
  if (pair.a === "what" && pair.b === "feel") return A.v !== B.v;
  return A.tier !== B.tier;
}
// ---------- the thing, word by word ----------
// pick.thing = { i, q, n, c }: indices into THING_WORDS, -1 where the word is absent.
const TW = { i: THING_WORDS.intensity, q: THING_WORDS.quality, n: THING_WORDS.noun, c: THING_WORDS.clause };
const WORD_ORDER = ["i", "q", "n", "c"];
const WORD_NAMES = { i: "intensity", q: "quality", n: "noun", c: "clause" };
function thingTier(th) {
  return Math.max(...WORD_ORDER.filter((w) => th[w] >= 0).map((w) => TW[w][th[w]].tier));
}
function thingWords(th) {
  return WORD_ORDER.filter((w) => th[w] >= 0).map((w) => ({ w, t: TW[w][th[w]].t }));
}
function thingText(th) {
  const words = thingWords(th);
  const head = words.filter((x) => x.w !== "c").map((x) => x.t).join(" ");
  const article = /^[aeiou]/i.test(head) ? "an" : "a";
  return [article, ...words.map((x) => x.t)].join(" ");
}
function randomShape() {
  const q = Math.random() < 0.7, i = q && Math.random() < 0.4, c = Math.random() < 0.2;
  return { i, q, c };
}
function fillShape(shape) {
  return {
    i: shape.i ? rand(TW.i.length) : -1,
    q: shape.q ? rand(TW.q.length) : -1,
    n: rand(TW.n.length),
    c: shape.c ? rand(TW.c.length) : -1,
  };
}
const shapeOf = (th) => ({ i: th.i >= 0, q: th.q >= 0, c: th.c >= 0 });
const sameThing = (a, b) => WORD_ORDER.every((w) => a[w] === b[w]);

// Which pairs the dial wants clashing: none, just event/feeling, or all.
const wantClash = (i) => state.dial === 2 || (state.dial === 1 && i === 0);
const pairsInPlay = () => PAIRS.filter((p) => state.len >= p.from);

const state = {
  pick: { who: 0, what: 0, feel: 0, where: 0, thing: { i: -1, q: -1, n: 0, c: -1 } },
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

// Pick a value for one slot so each pair it belongs to fits or clashes as the dial asks.
// Constraints relax one at a time if nothing satisfies them all.
function candidates(key, shape) {
  if (key === "thing") {
    const sh = shape || shapeOf(state.pick.thing);
    return Array.from({ length: 400 }, () => fillShape(sh));
  }
  let ok = POOLS[key].map((_, i) => i);
  if (key === "what") {
    // Keep the event itself grounded at low settings.
    ok = ok.filter((i) => WHAT[i].tier <= state.dial);
  }
  return ok;
}
function constrain(key, ok) {
  const rules = PAIRS.map((p, i) => ({ p, want: wantClash(i) })).filter((r) => r.p.a === key || r.p.b === key);
  for (let n = rules.length; n >= 0; n--) {
    const fit = ok.filter((v) => rules.slice(0, n).every((r) => clashes(r.p, { ...state.pick, [key]: v }) === r.want));
    if (fit.length) return fit;
  }
  return ok;
}
function pickIndex(key, shape) {
  let ok = constrain(key, candidates(key, shape));
  // Avoid repeating the current pick when there is a choice.
  const cur = state.pick[key];
  const same = key === "thing" ? (v) => sameThing(v, cur) : (v) => v === cur;
  if (ok.length > 1) ok = ok.filter((v) => !same(v));
  return ok[rand(ok.length)];
}

// Reroll one word of the thing, keeping the rest. Stays inside the dial if it can.
function rerollWord(w) {
  if (state.locks.thing) return;
  const th = state.pick.thing;
  let ok = TW[w].map((_, i) => ({ ...th, [w]: i })).filter((v) => v[w] !== th[w]);
  ok = constrain("thing", ok);
  state.pick.thing = ok[rand(ok.length)];
  render();
}
// Grow or shrink the thing by one word: quality, then intensity, then a clause.
function resizeThing(dir) {
  if (state.locks.thing) return;
  const th = { ...state.pick.thing };
  if (dir > 0) {
    const w = THING_GROW.find((x) => th[x] < 0);
    if (!w) return;
    let ok = TW[w].map((_, i) => ({ ...th, [w]: i }));
    ok = constrain("thing", ok);
    state.pick.thing = ok[rand(ok.length)];
  } else {
    const w = [...THING_GROW].reverse().find((x) => th[x] >= 0);
    if (!w) return;
    th[w] = -1;
    if (w === "q") th.i = -1;
    state.pick.thing = th;
  }
  render();
}

function reroll(keys) {
  // "what" must settle before "feel", since feel is chosen relative to it.
  for (const s of SLOTS) {
    if (keys.includes(s.key) && !state.locks[s.key]) {
      // A full shuffle also reshapes the thing; rerolling the card alone keeps its shape.
      const shape = s.key === "thing" && keys.length > 1 ? randomShape() : undefined;
      state.pick[s.key] = pickIndex(s.key, shape);
    }
  }
  state.seed = 1 + rand(1e9);
  render();
}

// ---------- text ----------
function fill(tpl, ctx) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => {
    if (k === "Who") return cap(ctx.who.n);
    if (k === "who") return ctx.who.n;
    if (k === "P") return cap(ctx.who.p);
    if (k === "where") return mark(ctx.where, "where");
    if (k === "thing") return mark(ctx.thing, "thing");
    if (k in ctx.who) return ctx.who[k];
    return "";
  });
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const mark = (s, key) => `<mark class="b-${key}">${s}</mark>`;

function context() {
  const who = WHO[state.pick.who];
  return {
    who,
    what: WHAT[state.pick.what],
    feel: FEEL[state.pick.feel],
    where: WHERE[state.pick.where].t,
    thing: thingText(state.pick.thing),
  };
}

// The one-line bit: "<who> <what>, and <p> <is> <feel>."
function bitLine(ctx, html = true) {
  const w = fillPlain(ctx.what.t, ctx);
  const f = fillPlain(ctx.feel.t, ctx);
  if (!html) return `${cap(ctx.who.n)} ${w}, and ${ctx.who.p} ${ctx.who.is} ${f}.`;
  return `${mark(cap(ctx.who.n), "who")} ${mark(w, "what")}, and ${ctx.who.p} ${ctx.who.is} ${mark(f, "feel")}.`;
}
function fillPlain(tpl, ctx) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in ctx.who ? ctx.who[k] : ""));
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

// ---------- cast (characters you keep telling stories about) ----------
const CAST_KEY = "story-bits-cast";
function loadCast() {
  try { return JSON.parse(localStorage.getItem(CAST_KEY)) || []; } catch { return []; }
}
function saveCast(cast) {
  try { localStorage.setItem(CAST_KEY, JSON.stringify(cast)); } catch {}
}
let cast = loadCast();

function keepBit() {
  const ctx = context();
  const line = bitLine(ctx, false);
  let c = cast.find((x) => x.who === state.pick.who);
  if (!c) { c = { who: state.pick.who, bits: [] }; cast.unshift(c); }
  if (!c.bits.includes(line)) c.bits.unshift(line);
  saveCast(cast);
  renderCast();
  toast(`Kept. ${cap(ctx.who.n)} now has ${c.bits.length} ${c.bits.length === 1 ? "story" : "stories"}.`);
}

function tellAnother(whoIdx) {
  state.pick.who = whoIdx;
  state.locks = { who: true };
  reroll(["what", "feel", "where", "thing"]);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- URL share ----------
function toHash() {
  const p = state.pick;
  const th = WORD_ORDER.map((w) => (p.thing[w] >= 0 ? p.thing[w] : "x")).join("_");
  return `#${[p.who, p.what, p.feel, p.where, th, state.dial, state.seed, state.len].join(".")}`;
}
// Thing is "i_q_n_c" with "x" for an absent word. Older links used a single index; those get a fresh thing.
function parseThing(str) {
  const parts = str.split("_");
  if (parts.length !== 4) return null;
  const th = {};
  for (const [k, w] of WORD_ORDER.entries()) {
    if (parts[k] === "x") { th[w] = -1; continue; }
    const n = Number(parts[k]);
    if (!Number.isInteger(n) || n < 0 || n >= TW[w].length) return null;
    th[w] = n;
  }
  if (th.n < 0 || (th.i >= 0 && th.q < 0)) return null;
  return th;
}
function fromHash() {
  const raw = location.hash.slice(1).split(".");
  const parts = raw.map((x, i) => (i === 4 ? 0 : Number(x)));
  if (parts.length < 7 || parts.length > 8 || parts.some((n) => !Number.isInteger(n) || n < 0)) return false;
  const [who, what, feel, where, , dial, seed, len = 5] = parts;
  if (len < 1 || len > 5) return false;
  if (who >= WHO.length || what >= WHAT.length || feel >= FEEL.length || where >= WHERE.length || dial > 2) return false;
  Object.assign(state.pick, { who, what, feel, where });
  state.pick.thing = parseThing(raw[4]) || fillShape(randomShape());
  state.dial = dial;
  state.seed = seed || 1;
  state.len = len;
  return true;
}

// ---------- render ----------
const $ = (s) => document.querySelector(s);

function render() {
  const ctx = context();
  history.replaceState(null, "", toHash());

  const inPlay = LENGTHS[state.len - 1].slots;
  $("#cards").dataset.n = inPlay.length;
  $("#cards").innerHTML = SLOTS.filter((s) => inPlay.includes(s.key)).map((s) => {
    const raw = s.key === "who" ? ctx.who.n : s.key === "what" ? fillPlain(ctx.what.t, ctx) : s.key === "feel" ? fillPlain(ctx.feel.t, ctx) : ctx[s.key];
    const locked = !!state.locks[s.key];
    const lock = `<button class="lock" data-lock="${s.key}" aria-pressed="${locked}" title="${locked ? "Unlock" : "Lock"} ${s.hint}">${locked ? lockIcon : unlockIcon}</button>`;
    if (s.key === "thing") return thingCard(locked, lock);
    return `<div class="card c-${s.key}${locked ? " locked" : ""}">
      <div class="card-top"><span class="card-label">${s.label}</span>${lock}</div>
      <button class="card-body" data-roll="${s.key}" title="Reroll ${s.hint}" ${locked ? "disabled" : ""}>${raw}</button>
    </div>`;
  }).join("");

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

// The thing card shows each word as its own button, plus controls to add or drop a word.
function thingCard(locked, lock) {
  const th = state.pick.thing;
  const words = thingWords(th);
  const article = thingText(th).split(" ")[0];
  const canGrow = THING_GROW.some((x) => th[x] < 0);
  const canShrink = THING_GROW.some((x) => th[x] >= 0);
  const dis = (on) => (locked || !on ? "disabled" : "");
  return `<div class="card c-thing${locked ? " locked" : ""}">
    <div class="card-top"><span class="card-label">Thing</span>
      <span class="word-steps">
        <button class="mini" data-thing="-1" title="Drop a word" aria-label="Drop a word" ${dis(canShrink)}>−</button>
        <button class="mini" data-thing="1" title="Add a word" aria-label="Add a word" ${dis(canGrow)}>+</button>
        ${lock}
      </span></div>
    <div class="card-body words">${article} ${words.map((x) =>
      `<button class="word w-${x.w}" data-word="${x.w}" title="Reroll the ${WORD_NAMES[x.w]}" ${locked ? "disabled" : ""}>${x.t}</button>`).join(" ")}
      <button class="reroll-all" data-roll="thing" title="Reroll every word" aria-label="Reroll the whole thing" ${locked ? "disabled" : ""}>↻</button>
    </div>
  </div>`;
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
  el.innerHTML = cast.map((c) => `
    <article class="person">
      <header><h3>${esc(cap(WHO[c.who].n))}</h3>
        <span class="count">${c.bits.length} ${c.bits.length === 1 ? "story" : "stories"}</span></header>
      <ul>${c.bits.slice(0, 6).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      <div class="person-actions">
        <button class="ghost" data-another="${c.who}">Tell another about ${esc(WHO[c.who].o)}</button>
        <button class="ghost subtle" data-forget="${c.who}">Forget</button>
      </div>
    </article>`).join("");
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
document.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.dataset.roll) reroll([t.dataset.roll]);
  else if (t.dataset.lock) { const k = t.dataset.lock; state.locks[k] = !state.locks[k]; render(); }
  else if (t.dataset.dial) { state.dial = +t.dataset.dial; reroll(SLOTS.map((s) => s.key)); }
  else if (t.dataset.another) tellAnother(+t.dataset.another);
  else if (t.dataset.forget) { cast = cast.filter((c) => c.who !== +t.dataset.forget); saveCast(cast); renderCast(); }
  else if (t.dataset.word) rerollWord(t.dataset.word);
  else if (t.dataset.thing) resizeThing(+t.dataset.thing);
  else if (t.id === "len-up") setLen(state.len + 1);
  else if (t.id === "len-down") setLen(state.len - 1);
  else if (t.id === "shuffle") reroll(SLOTS.map((s) => s.key));
  else if (t.id === "retell") { state.seed = 1 + rand(1e9); render(); }
  else if (t.id === "keep") keepBit();
  else if (t.id === "share") {
    const url = location.href;
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
      .then(() => toast("Link copied. Same five bits, same story."))
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
  state.pick.who = rand(WHO.length);
  for (const k of ["what", "feel", "where"]) state.pick[k] = pickIndex(k);
  state.pick.thing = pickIndex("thing", randomShape());
  state.seed = 1 + rand(1e9);
}
render();
renderCast();
