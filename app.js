// Story Bits: five things, mad-lib style. "x happened to p and they feel e about it."

const SLOTS = [
  { key: "who", label: "Who", pool: WHO, hint: "the character" },
  { key: "what", label: "What happened", pool: WHAT, hint: "the event" },
  { key: "feel", label: "How they feel", pool: FEEL, hint: "the feeling" },
  { key: "where", label: "Where", pool: WHERE, hint: "the place" },
  { key: "thing", label: "Thing", pool: THING, hint: "the object" },
];
const DIAL_NAMES = ["Plausible", "Odd", "Absurd"];
const DIAL_NOTES = [
  "Event and feeling match. A thing your mom would tell you on the phone.",
  "Anything goes. Some feelings won't quite fit the facts.",
  "Feelings run against the facts, and the world gets strange. Then it lands safely.",
];

const state = {
  pick: { who: 0, what: 0, feel: 0, where: 0, thing: 0 },
  locks: {},
  dial: 1,
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

// Pick an index from pool, honoring the dial. Returns index into the full pool.
function pickIndex(key) {
  const pool = SLOTS.find((s) => s.key === key).pool;
  let ok = pool.map((_, i) => i);
  const d = state.dial;
  if (key !== "who") {
    // Plausible: tier 0 only. Odd: up to tier 1. Absurd: lean on tier 2.
    if (d === 0) ok = ok.filter((i) => pool[i].tier === 0);
    else if (d === 1) ok = ok.filter((i) => pool[i].tier <= 1);
    else if (Math.random() < 0.65) ok = ok.filter((i) => pool[i].tier >= 1);
  }
  if (key === "feel") {
    // The incongruity: how well the feeling fits what happened.
    const ev = WHAT[state.pick.what].v;
    let fit;
    if (d === 0) fit = ok.filter((i) => FEEL[i].v === ev || (ev === 0 && FEEL[i].v !== 0 && Math.random() < 0.5));
    else if (d === 2) fit = ok.filter((i) => FEEL[i].v !== ev && (ev === 0 || FEEL[i].v !== 0 || Math.random() < 0.3));
    if (fit && fit.length) ok = fit;
  }
  if (!ok.length) ok = pool.map((_, i) => i);
  // Avoid repeating the current pick when there is a choice.
  const cur = state.pick[key];
  if (ok.length > 1) ok = ok.filter((i) => i !== cur);
  return ok[rand(ok.length)];
}

function reroll(keys) {
  // "what" must settle before "feel", since feel is chosen relative to it.
  for (const s of SLOTS) {
    if (keys.includes(s.key) && !state.locks[s.key]) state.pick[s.key] = pickIndex(s.key);
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
    thing: THING[state.pick.thing].t,
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
  const fv = String(ctx.feel.v);
  const turnTier = Math.min(2, Math.max(state.dial, ctx.what.tier));
  const paras = [
    [choose(BEATS.setup, rng), choose(BEATS.dwell[fv], rng)],
    [choose(BEATS.thing, rng), choose(BEATS.thingAfter, rng), choose(BEATS.turn[turnTier], rng)],
    [choose(BEATS.resolve, rng), choose(BEATS.tag, rng)],
  ];
  return paras.map((p) => p.map((s) => fill(s, ctx)).join(" "));
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
  return `#${[p.who, p.what, p.feel, p.where, p.thing, state.dial, state.seed].join(".")}`;
}
function fromHash() {
  const parts = location.hash.slice(1).split(".").map(Number);
  if (parts.length !== 7 || parts.some((n) => !Number.isFinite(n) || n < 0)) return false;
  const [who, what, feel, where, thing, dial, seed] = parts;
  if (who >= WHO.length || what >= WHAT.length || feel >= FEEL.length || where >= WHERE.length || thing >= THING.length || dial > 2) return false;
  Object.assign(state.pick, { who, what, feel, where, thing });
  state.dial = dial;
  state.seed = seed || 1;
  return true;
}

// ---------- render ----------
const $ = (s) => document.querySelector(s);

function render() {
  const ctx = context();
  history.replaceState(null, "", toHash());

  $("#cards").innerHTML = SLOTS.map((s) => {
    const raw = s.key === "who" ? ctx.who.n : s.key === "what" ? fillPlain(ctx.what.t, ctx) : s.key === "feel" ? fillPlain(ctx.feel.t, ctx) : ctx[s.key];
    const locked = !!state.locks[s.key];
    return `<div class="card c-${s.key}${locked ? " locked" : ""}">
      <div class="card-top"><span class="card-label">${s.label}</span>
        <button class="lock" data-lock="${s.key}" aria-pressed="${locked}" title="${locked ? "Unlock" : "Lock"} ${s.hint}">${locked ? lockIcon : unlockIcon}</button></div>
      <button class="card-body" data-roll="${s.key}" title="Reroll ${s.hint}" ${locked ? "disabled" : ""}>${raw}</button>
    </div>`;
  }).join("");

  $("#bit").innerHTML = bitLine(ctx);
  $("#story").innerHTML = story(ctx).map((p) => `<p>${p}</p>`).join("");

  document.querySelectorAll(".dial button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.dial === state.dial)));
  $("#dial-note").textContent = DIAL_NOTES[state.dial];
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
});

// ---------- boot ----------
if (!fromHash()) {
  state.pick.who = rand(WHO.length);
  for (const k of ["what", "feel", "where", "thing"]) state.pick[k] = pickIndex(k);
  state.seed = 1 + rand(1e9);
}
render();
renderCast();
