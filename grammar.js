// The stated grammar: what a grammar document may contain, what each word slot accepts, and the
// constraints that restrict words. Every check takes the grammar it's checking against, so the
// page, the word bank, the library and tools/accept-pack.mjs all share one set of rules.
//
// Structural rules the engine (app.js) enforces as it builds phrases:
//   - a slot with `needs` only appears with that slot (no "very" without a quality)
//   - a phrase nested inside a noun card's trailing clause takes no trailing clause of its own,
//     so every trailing clause belongs to exactly one noun
//   - phrases nest at most the grammar's maxDepth deep

const PRON = { he: HE, she: SHE, they: THEY };
const PRONOUN_TOKENS = ["p", "o", "pos", "is", "has", "was", "s"];
const TIER_NAMES = ["plausible", "odd", "absurd"];
const MOOD_NAMES = { 1: "good", 0: "mixed", "-1": "bad" };

// Strip anything that could act as a template token or markup, collapse spaces, drop end punctuation.
function cleanWord(t) {
  return String(t ?? "").replace(/<[^>]*>/g, "").replace(/[{}<>]/g, "").replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
}

const partIn = (g, s, k) => g.schemas[s]?.parts.find((p) => p.k === k);
const needsMood = (s, k, g) => !!partIn(g, s, k)?.mood;
const detsFor = (s, k, g) => partIn(g, s, k)?.det || null;
const needsPronouns = (s, k, g) => !!partIn(g, s, k)?.pronouns;
// The head word takes an intensity when some slot in its card `needs: "adj"`; short heads do.
const takesIntensity = (s, g) => g.schemas[s]?.parts.some((p) => p.needs === "adj");
const shortEnough = (t) => t.split(" ").length <= 2;

// ---------- constraints ----------
// Oulipo-style restrictions in rules.constraints. They filter which words a grammar offers, so a
// constrained grammar can't produce a word that breaks them. Each applies to word text (with any
// nested-card token and pronoun tokens ignored).
//   { type: "lipogram", letters: "e" }      no word may contain these letters
//   { type: "startsWith", letter: "s" }     every word starts with this letter (alliteration)
//   { type: "maxSyllables", n: 3 }          every word has at most n syllables (estimated)
//   { type: "closed" }                      only the grammar's own words: no word bank
const CONSTRAINT_TYPES = ["lipogram", "startsWith", "maxSyllables", "closed"];
const bareText = (t) => t.replace(/\{[^}]*\}/g, " ").replace(/\s+/g, " ").trim();
// A rough English syllable count: vowel groups, minus a silent final e, at least one.
function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 0);
}
function wordAllowed(text, g) {
  const t = bareText(text).toLowerCase();
  for (const c of g.rules?.constraints || []) {
    if (c.type === "lipogram" && [...String(c.letters).toLowerCase()].some((ch) => t.includes(ch))) return false;
    if (c.type === "startsWith" && t && !t.split(" ").every((w) => w.startsWith(String(c.letter).toLowerCase()))) return false;
    if (c.type === "maxSyllables" && t.split(" ").some((w) => syllables(w) > c.n)) return false;
  }
  return true;
}
// A lipogram covers everything the reader sees, not just words: determiners and beat lines too.
function lipogramOk(text, g) {
  const t = bareText(text).toLowerCase();
  return !(g.rules?.constraints || []).some((c) => c.type === "lipogram" && [...String(c.letters).toLowerCase()].some((ch) => t.includes(ch)));
}
// A pool word passes if its text, and any determiner it brings, pass.
const entryAllowed = (w, g) => wordAllowed(w.t, g) && (!w.det || lipogramOk(w.det, g));
const grammarClosed = (g) => (g.rules?.constraints || []).some((c) => c.type === "closed");
function describeConstraint(c) {
  if (c.type === "lipogram") return `no letter ${[...String(c.letters)].map((x) => `“${x}”`).join(", ")}`;
  if (c.type === "startsWith") return `every word starts with “${c.letter}”`;
  if (c.type === "maxSyllables") return `words of ${c.n} syllable${c.n === 1 ? "" : "s"} or fewer`;
  if (c.type === "closed") return "only this grammar's own words";
  return "";
}

// ---------- words ----------
// A word entry: { g?: grammar id, s: card, k: slot, t: text, tier, v?: mood, det?: determiner,
// pr?: pronouns }. Returns "" if the entry may join its slot in grammar g, or the reason it can't.
function checkEntry(e, g) {
  if (!e || typeof e !== "object") return "not a word";
  if (e.g !== undefined && e.g !== g.id) return "belongs to another grammar";
  const schema = g.schemas[e.s];
  if (!schema) return "unknown card";
  const part = schema.parts.find((p) => p.k === e.k);
  if (!part) return "unknown slot";
  if (typeof e.t !== "string" || !e.t || e.t !== cleanWord(e.t) || e.t.length > 60) return "text must be 1–60 characters, without braces or angle brackets";
  if (![0, 1, 2].includes(e.tier)) return "register must be plausible, odd or absurd";
  if (part.mood) { if (![-1, 0, 1].includes(e.v)) return "this slot needs a mood: good, mixed or bad"; }
  else if (e.v !== undefined) return "this slot doesn't take a mood";
  if (part.det) { if (!part.det.includes(e.det)) return `needs to start with ${part.det.join(" or ")}`; }
  else if (e.det !== undefined) return "this slot doesn't take a starting word";
  if (part.pronouns) { if (!PRON[e.pr]) return "needs pronouns: he, she or they"; }
  else if (e.pr !== undefined) return "this slot doesn't take pronouns";
  if (!wordAllowed(e.t, g)) return `breaks this grammar's constraints (${(g.rules?.constraints || []).map(describeConstraint).filter(Boolean).join("; ")})`;
  return "";
}

// A checked entry as a pool word.
function poolEntry(e, g) {
  return {
    t: e.t, tier: e.tier,
    ...(e.v !== undefined && { v: e.v }),
    ...(e.det && { det: e.det }),
    ...(e.pr && PRON[e.pr]),
    ...(e.k === "n" && takesIntensity(e.s, g) && { adj: shortEnough(e.t) }),
  };
}

// ---------- forms ----------
// A form is the shape of a telling. A form is valid only if:
//   - it has 1–6 stanzas; the first is the headline line alone (no beats);
//   - every stanza brings in the cards the headline uses, and only cards the grammar has;
//   - if the grammar's rules say forms land, every stanza with beats has a "landing" beat in
//     its last paragraph (a tag may follow it);
//   - every beat a stanza uses exists and has a line that fits the cards in play (a line naming a
//     card needs that card in the stanza), for every mood it covers;
//   - lines are 1–200 characters and use only known tokens: pronouns (if the grammar has them),
//     {P}, and card keys ({thing}, or {Thing} to start a sentence with it).
const cardKeys = (g) => g.cards.map((c) => c.key);
const lineCards = (t, g) => cardKeys(g).filter((k) => new RegExp(`\\{${k}\\}`, "i").test(t));
const headlineCards = (g) => lineCards(g.line, g);

function checkLine(l, g) {
  if (!l || typeof l !== "object" || ![0, 1, 2].includes(l.tier)) return "each line needs a tier of 0, 1 or 2";
  if (typeof l.t !== "string" || !l.t.trim() || l.t.length > 200 || /[<>]/.test(l.t)) return "lines are 1–200 characters, no angle brackets";
  const ok = new Set([...cardKeys(g), ...cardKeys(g).map((k) => k[0].toUpperCase() + k.slice(1)), ...(g.pronouns ? [...PRONOUN_TOKENS, "P"] : [])]);
  for (const m of l.t.matchAll(/\{([^}]*)\}/g)) if (!ok.has(m[1])) return `unknown token {${m[1]}}`;
  if ((l.t.match(/[{}]/g) || []).length % 2) return "unbalanced braces";
  return "";
}

// Returns "" if the form is valid in grammar g, or the first reason it isn't.
function checkForm(f, g) {
  if (!f || typeof f !== "object") return "not a form";
  if (typeof f.name !== "string" || !cleanWord(f.name) || f.name.length > 40) return "a form needs a name up to 40 characters";
  const beats = f.beats && typeof f.beats === "object" ? f.beats : null;
  if (!beats) return "a form needs beats (an empty {} is fine for a headline-only form)";
  for (const [k, b] of Object.entries(beats)) {
    if (!/^[a-z][a-z0-9]{0,15}$/.test(k)) return `beat key "${k}" should be short lowercase letters`;
    if (!b || typeof b.name !== "string" || !b.name.trim()) return `beat "${k}" needs a name`;
    if (b.byMood && !g.moodCard) return `beat "${k}" is by mood, but this grammar has no mood card`;
    const pools = b.byMood ? ["1", "0", "-1"].map((m) => b.lines?.[m]) : [b.lines];
    if (pools.some((p) => !Array.isArray(p) || !p.length)) return `beat "${k}" needs lines${b.byMood ? " for every mood (1, 0, -1)" : ""}`;
    if (b.byMood && new Set(pools.map((p) => p.length)).size > 1) return `beat "${k}": every mood needs the same number of lines`;
    for (const p of pools) for (const l of p) { const e = checkLine(l, g); if (e) return `beat "${k}": ${e}`; }
    if (b.role !== undefined && b.role !== "landing") return `beat "${k}": the only role is "landing"`;
  }
  if (!Array.isArray(f.stanzas) || f.stanzas.length < 1 || f.stanzas.length > 6) return "a form needs 1–6 stanzas";
  const head = headlineCards(g);
  for (const [i, st] of f.stanzas.entries()) {
    const n = i + 1;
    if (!st || typeof st.name !== "string" || !st.name.trim()) return `stanza ${n} needs a name`;
    if (!Array.isArray(st.slots) || !head.every((k) => st.slots.includes(k)) || !st.slots.every((k) => cardKeys(g).includes(k))) return `stanza ${n}: cards must include ${head.join(", ")}, and only cards this grammar has`;
    if (!Array.isArray(st.paras) || !st.paras.every((p) => Array.isArray(p) && p.length)) return `stanza ${n}: paragraphs must be non-empty lists of beats`;
    if (i === 0 && st.paras.length) return "stanza 1 is the headline itself and has no beats";
    const used = st.paras.flat();
    for (const k of used) {
      const b = beats[k];
      if (!b) return `stanza ${n} uses beat "${k}", which doesn't exist`;
      const pools = b.byMood ? Object.values(b.lines) : [b.lines];
      if (pools.some((p) => !p.some((l) => lineCards(l.t, g).every((c) => st.slots.includes(c))))) return `stanza ${n}: beat "${k}" has no line that fits its cards`;
    }
    if (g.rules?.landing && used.length && !st.paras[st.paras.length - 1].some((k) => beats[k].role === "landing")) return `stanza ${n}: the last paragraph needs a landing beat`;
  }
  return "";
}

// ---------- whole grammars ----------
// For grammars from the library, a link, a pack or a jam. Returns "" or the first problem.
const GRAMMAR_MAX = 200 * 1024;
const PAIR_ON = ["mood", "register", "sound"];
// No markup anywhere in a grammar: every string in it ends up on the page.
function hasMarkup(x) {
  if (typeof x === "string") return /[<>]/.test(x);
  if (Array.isArray(x)) return x.some(hasMarkup);
  if (x && typeof x === "object") return Object.entries(x).some(([k, v]) => /[<>]/.test(k) || hasMarkup(v));
  return false;
}
function checkGrammar(g) {
  if (!g || typeof g !== "object") return "not a grammar";
  try { if (JSON.stringify(g).length > GRAMMAR_MAX) return "too big (200 KB max)"; } catch { return "not JSON"; }
  if (hasMarkup(g)) return "no angle brackets anywhere: a grammar is text, not markup";
  if (typeof g.id !== "string" || !/^[a-z][a-z0-9-]{1,39}$/.test(g.id)) return "id must be a short lowercase slug";
  if (typeof g.name !== "string" || !cleanWord(g.name) || g.name.length > 40) return "needs a name up to 40 characters";
  if (g.description !== undefined && (typeof g.description !== "string" || g.description.length > 400)) return "description is up to 400 characters";
  if (!Number.isInteger(g.maxDepth) || g.maxDepth < 0 || g.maxDepth > 3) return "maxDepth must be 0–3";
  if (!Array.isArray(g.cards) || g.cards.length < 1 || g.cards.length > 8) return "needs 1–8 cards";
  const keys = new Set();
  for (const c of g.cards) {
    if (!c || typeof c.key !== "string" || !/^[a-z][a-z0-9]{0,11}$/.test(c.key) || keys.has(c.key)) return "card keys are short, lowercase and unique";
    if (typeof c.label !== "string" || !c.label.trim() || c.label.length > 30) return `card "${c.key}" needs a label`;
    keys.add(c.key);
  }
  if (!g.schemas || typeof g.schemas !== "object") return "needs schemas";
  const tokenOk = (t) => [...t.matchAll(/\{([^}]*)\}/g)].every((m) => keys.has(m[1]) || (g.pronouns && PRONOUN_TOKENS.includes(m[1])));
  for (const key of keys) {
    const sc = g.schemas[key];
    if (!sc || !Array.isArray(sc.parts) || sc.parts.length < 1 || sc.parts.length > 6) return `card "${key}" needs 1–6 slots`;
    const pk = new Set(sc.parts.map((p) => p?.k));
    if (pk.size !== sc.parts.length) return `card "${key}": slot keys must be unique`;
    const head = sc.parts.find((p) => p.k === "n");
    if (!head || head.opt) return `card "${key}" needs a required head slot "n"`;
    for (const p of sc.parts) {
      if (typeof p.k !== "string" || !/^[a-z]$/.test(p.k)) return `card "${key}": slot keys are single letters`;
      if (typeof p.name !== "string" || !p.name.trim() || p.name.length > 24) return `card "${key}" slot "${p.k}" needs a name`;
      if (p.needs !== undefined && p.needs !== "adj" && !pk.has(p.needs)) return `card "${key}" slot "${p.k}" needs a slot that doesn't exist`;
      if (p.det !== undefined && (!Array.isArray(p.det) || !p.det.length || !p.det.every((d) => typeof d === "string" && d.length <= 12))) return `card "${key}" slot "${p.k}": det is a short list of starting words`;
      if (!Array.isArray(p.pool) || !p.pool.length || p.pool.length > 300) return `card "${key}" slot "${p.k}" needs 1–300 words`;
      for (const w of p.pool) {
        if (!w || typeof w.t !== "string" || !w.t.trim() || w.t.length > 120 || /[<>]/.test(w.t) || !tokenOk(w.t)) return `card "${key}" slot "${p.k}": bad word ${JSON.stringify(w?.t ?? w)}`;
        if (![0, 1, 2].includes(w.tier)) return `card "${key}" slot "${p.k}": every word needs a tier 0–2`;
        if (p.mood && ![-1, 0, 1].includes(w.v)) return `card "${key}" slot "${p.k}": every word needs a mood -1, 0 or 1`;
        if (p.det && !p.det.includes(w.det)) return `card "${key}" slot "${p.k}": every word needs a starting word from its list`;
        if (p.pronouns && !PRONOUN_TOKENS.every((t) => typeof w[t] === "string")) return `card "${key}" slot "${p.k}": every word needs pronouns`;
      }
    }
  }
  if (g.pronouns !== undefined && g.pronouns !== null && !g.schemas[g.pronouns]?.parts.find((p) => p.k === "n")?.pronouns) return "pronouns must name a card whose head slot has pronouns";
  if (g.moodCard !== undefined && g.moodCard !== null && !g.schemas[g.moodCard]?.parts.find((p) => p.k === "n")?.mood) return "moodCard must name a card whose head slot has a mood";
  if (g.headline !== undefined && (typeof g.headline !== "string" || g.headline.length > 30)) return "headline is a short label";
  if (g.rules?.dialName !== undefined && (typeof g.rules.dialName !== "string" || g.rules.dialName.length > 30)) return "rules.dialName is a short label";
  if (typeof g.line !== "string" || g.line.length > 200 || !tokenOk(g.line.replace(/\{P\}/g, "")) || !headlineCards(g).length) return "line is a short template naming at least one card";
  const r = g.rules;
  if (!r || typeof r !== "object") return "needs rules";
  if (typeof r.landing !== "boolean") return "rules.landing must be true or false";
  if (!Array.isArray(r.dialLabels) || r.dialLabels.length !== 3 || !Array.isArray(r.dialNotes) || r.dialNotes.length !== 3) return "rules need 3 dial labels and 3 dial notes";
  if (!Array.isArray(r.pairs) || r.pairs.length > 6) return "rules.pairs is a list of up to 6 pairs";
  for (const p of r.pairs) {
    if (!p || !keys.has(p.a) || !keys.has(p.b) || p.a === p.b || !PAIR_ON.includes(p.on)) return "each pair names two different cards and clashes on mood, register or sound";
    if (p.on === "mood" && ![p.a, p.b].every((k) => g.schemas[k].parts.find((x) => x.k === "n").mood)) return "a mood pair needs two cards with moods";
  }
  if (r.grounded !== undefined && !keys.has(r.grounded)) return "rules.grounded must name a card";
  if (r.constraints !== undefined && (!Array.isArray(r.constraints) || r.constraints.length > 6 || !r.constraints.every((c) => c && CONSTRAINT_TYPES.includes(c.type)))) return "constraints are a short list of known types";
  if (!g.forms || typeof g.forms !== "object" || !Object.keys(g.forms).length || Object.keys(g.forms).length > 16) return "needs 1–16 forms";
  for (const [k, f] of Object.entries(g.forms)) {
    if (!/^[a-z][a-z0-9-]{0,23}$/.test(k)) return `form key "${k}" should be a short lowercase slug`;
    const e = checkForm(f, g);
    if (e) return `form "${k}": ${e}`;
  }
  return "";
}
