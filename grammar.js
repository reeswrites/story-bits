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
