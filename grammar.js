// The stated grammar. SCHEMAS (data.js) says which slots each card has and in what order;
// this file says what may go in each slot: a test frame to read a word in, a hint, and the
// rules a word must pass to join. The page uses it for the word bank; tools/accept-pack.mjs
// uses the same rules to check word packs suggested for everyone.
//
// Structural rules live in app.js alongside the schemas they act on:
//   - a slot with `needs` only appears with that slot (no "very" without a quality)
//   - a thing nested inside a noun's clause takes no clause of its own, so a trailing
//     clause can only ever belong to one noun ("a fish that swallowed a hat" ends there)
//   - things nest at most MAX_DEPTH deep

const PRON = { he: HE, she: SHE, they: THEY };

const SLOT_INFO = {
  "who.d": { frame: "your ___ uncle", hint: "Describes a person. An adjective or short phrase." },
  "who.n": { frame: "{det} ___", hint: "A person, the way you'd refer to them: “cousin Dale”, “mail carrier”." },
  "what.a": { frame: "your uncle ___ lost his dog", hint: "An adverb that sits before the event." },
  "what.n": { frame: "your uncle ___", hint: "What happened, starting with a past-tense verb: “got…”, “lost…”." },
  "what.t": { frame: "your uncle lost his dog ___", hint: "When, where or how. A phrase that trails the event." },
  "feel.i": { frame: "and he is ___ furious", hint: "How much. An adverb." },
  "feel.n": { frame: "and he is ___", hint: "How they feel, read after “is”: “thrilled”, “pretending it's fine”." },
  "feel.t": { frame: "and he is furious ___", hint: "A trailing twist: “but won't admit it”." },
  "where.i": { frame: "a ___ haunted laundromat", hint: "An adverb for the place's quality." },
  "where.q": { frame: "a ___ laundromat", hint: "Describes a place. An adjective." },
  "where.n": { frame: "{det} ___", hint: "A place." },
  "where.c": { frame: "a laundromat ___", hint: "Trails the place: “two towns over”, “that was also a bank”." },
  "thing.i": { frame: "a ___ wet dog", hint: "An adverb for the thing's quality." },
  "thing.q": { frame: "a ___ dog", hint: "Describes a thing. An adjective." },
  "thing.n": { frame: "a ___", hint: "A thing. A singular noun." },
  "thing.c": { frame: "a dog ___", hint: "Trails the thing: “from 1994”, “that has a lawyer”." },
};
const DETS = { who: ["your", "the"], where: ["the", "a"] };
const TIER_NAMES = ["plausible", "odd", "absurd"];
const MOOD_NAMES = { 1: "good", 0: "mixed", "-1": "bad" };

// Strip anything that could act as a template token or markup, collapse spaces, drop end punctuation.
function cleanWord(t) {
  return String(t ?? "").replace(/<[^>]*>/g, "").replace(/[{}<>]/g, "").replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
}
const needsMood = (s, k) => k === "n" && (s === "what" || s === "feel");
const needsDet = (s, k) => k === "n" && (s === "who" || s === "where");

// A word entry: { s: card, k: slot, t: text, tier, v?: mood, det?: determiner, pr?: pronouns }.
// Returns "" if the entry may join its slot, or the reason it can't.
function checkEntry(e) {
  if (!e || typeof e !== "object") return "not a word";
  const schema = SCHEMAS[e.s];
  if (!schema) return "unknown card";
  if (!schema.parts.some((p) => p.k === e.k)) return "unknown slot";
  if (typeof e.t !== "string" || !e.t || e.t !== cleanWord(e.t) || e.t.length > 60) return "text must be 1–60 characters, without braces or angle brackets";
  if (![0, 1, 2].includes(e.tier)) return "register must be plausible, odd or absurd";
  if (needsMood(e.s, e.k)) { if (![-1, 0, 1].includes(e.v)) return "events and feelings need a mood: good, mixed or bad"; }
  else if (e.v !== undefined) return "mood is only for events and feelings";
  if (needsDet(e.s, e.k)) { if (!DETS[e.s].includes(e.det)) return `needs to start with ${DETS[e.s].join(" or ")}`; }
  else if (e.det !== undefined) return "a starting word is only for people and places";
  if (e.s === "who" && e.k === "n") { if (!PRON[e.pr]) return "people need pronouns: he, she or they"; }
  else if (e.pr !== undefined) return "pronouns are only for people";
  return "";
}

// Short feelings ("furious") take an intensity ("really furious"); longer ones don't.
const feelTakesIntensity = (t) => t.split(" ").length <= 2;

// A checked entry as a pool word.
function poolEntry(e) {
  return {
    t: e.t, tier: e.tier,
    ...(e.v !== undefined && { v: e.v }),
    ...(e.det && { det: e.det }),
    ...(e.pr && PRON[e.pr]),
    ...(e.s === "feel" && e.k === "n" && { adj: feelTakesIntensity(e.t) }),
  };
}

// ---------- forms ----------
// A form (FORMS in data.js, or `forms` in a pack) is the shape of a telling. Its promise is
// the app's promise: whatever happens, the story lands. So a form is valid only if:
//   - it has 1–6 stanzas; the first brings in who/what/feel and has no beats (it's the bit);
//   - every stanza with beats has a "landing" beat in its last paragraph (a tag may follow it);
//   - every beat a stanza uses exists, and has at least one line that fits the cards in
//     play (a line naming {where} or {thing} needs that card) for every mood it covers;
//   - lines are 1–200 characters and use only the known tokens.
const BEAT_TOKENS = new Set(["P", "p", "o", "pos", "is", "has", "was", "s", "where", "thing", "Thing"]);
const CARD_KEYS = ["who", "what", "feel", "where", "thing"];

function checkLine(l) {
  if (!l || typeof l !== "object" || ![0, 1, 2].includes(l.tier)) return "each line needs a tier of 0, 1 or 2";
  if (typeof l.t !== "string" || !l.t.trim() || l.t.length > 200 || /[<>]/.test(l.t)) return "lines are 1–200 characters, no angle brackets";
  for (const m of l.t.matchAll(/\{([^}]*)\}/g)) if (!BEAT_TOKENS.has(m[1])) return `unknown token {${m[1]}}`;
  if ((l.t.match(/[{}]/g) || []).length % 2) return "unbalanced braces";
  return "";
}
const lineNeeds = (t) => ["where", "thing"].filter((k) => new RegExp(`\\{${k}\\}`, "i").test(t));

// Returns "" if the form is valid, or the first reason it isn't.
function checkForm(f) {
  if (!f || typeof f !== "object") return "not a form";
  if (typeof f.name !== "string" || !cleanWord(f.name) || f.name.length > 40) return "a form needs a name up to 40 characters";
  const beats = f.beats && typeof f.beats === "object" ? f.beats : null;
  if (!beats) return "a form needs beats";
  for (const [k, b] of Object.entries(beats)) {
    if (!/^[a-z][a-z0-9]{0,15}$/.test(k)) return `beat key "${k}" should be short lowercase letters`;
    if (!b || typeof b.name !== "string" || !b.name.trim()) return `beat "${k}" needs a name`;
    const pools = b.byMood ? ["1", "0", "-1"].map((m) => b.lines?.[m]) : [b.lines];
    if (pools.some((p) => !Array.isArray(p) || !p.length)) return `beat "${k}" needs lines${b.byMood ? " for every mood (1, 0, -1)" : ""}`;
    if (b.byMood && new Set(pools.map((p) => p.length)).size > 1) return `beat "${k}": every mood needs the same number of lines`;
    for (const p of pools) for (const l of p) { const e = checkLine(l); if (e) return `beat "${k}": ${e}`; }
    if (b.role !== undefined && b.role !== "landing") return `beat "${k}": the only role is "landing"`;
  }
  if (!Array.isArray(f.stanzas) || f.stanzas.length < 1 || f.stanzas.length > 6) return "a form needs 1–6 stanzas";
  for (const [i, st] of f.stanzas.entries()) {
    const n = i + 1;
    if (!st || typeof st.name !== "string" || !st.name.trim()) return `stanza ${n} needs a name`;
    if (!Array.isArray(st.slots) || !["who", "what", "feel"].every((k) => st.slots.includes(k)) || !st.slots.every((k) => CARD_KEYS.includes(k))) return `stanza ${n}: cards must include who, what and feel, and only known cards`;
    if (!Array.isArray(st.paras) || !st.paras.every((p) => Array.isArray(p) && p.length)) return `stanza ${n}: paragraphs must be non-empty lists of beats`;
    if (i === 0 && st.paras.length) return "stanza 1 is the bit itself and has no beats";
    const used = st.paras.flat();
    for (const k of used) {
      const b = beats[k];
      if (!b) return `stanza ${n} uses beat "${k}", which doesn't exist`;
      const pools = b.byMood ? Object.values(b.lines) : [b.lines];
      if (pools.some((p) => !p.some((l) => lineNeeds(l.t).every((c) => st.slots.includes(c))))) return `stanza ${n}: beat "${k}" has no line that fits its cards`;
    }
    if (used.length && !st.paras[st.paras.length - 1].some((k) => beats[k].role === "landing")) return `stanza ${n}: the last paragraph needs a landing beat`;
  }
  return "";
}
