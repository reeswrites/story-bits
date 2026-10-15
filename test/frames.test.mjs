// Story Bits' what happened and how they feel as frames with holes: "lost {thing}", "quietly
// furious about {thing} and has started a podcast". The verb moves around the object, the object
// is tuned inside, Flip finds the opposite mood, pronouns agree, and old pieces read as before.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { engine } from "./load.mjs";

const OLD = JSON.parse(readFileSync(new URL("./fixtures/pre-frames.json", import.meta.url), "utf8"));

// Helpers inside the engine: a word's index by its text, and a piece with chosen phrases.
const H = `
const at = (s, k, t) => { const i = SCHEMAS[s].parts.find((p) => p.k === k).pool.findIndex((w) => w.t === t); if (i < 0) throw new Error(s + "." + k + ": no " + t); return i; };
const thing = (n) => ({ w: { n: at("thing", "n", n) } });
const person = (w, n) => ({ w: { w: at("who", "w", w), n: at("who", "n", n) } });
const piece = (pick) => { fresh("story-bits", "bit", 1, 1, 7); Object.assign(state.pick, pick); return { line: bitLine(context()), what: phraseText("what"), feel: phraseText("feel"), ok: Object.keys(pick).every((k) => validPhrase(k, clone(state.pick[k]), 0)) }; };
const lost = () => ({ w: { n: at("what", "n", "lost {thing}") }, sub: { n: thing("dog") } });
`;

test("an event frame holds a whole thing, where or who, tunable inside", () => {
  const { json } = engine();
  const r = json(`(() => { ${H} return {
    lost: piece({ what: lost() }),
    banned: piece({ what: { w: { n: at("what", "n", "got banned from {where}") }, sub: { n: { w: { n: at("where", "n", "DMV") } } } } }),
    eloped: piece({ what: { w: { n: at("what", "n", "eloped with {who}") }, sub: { n: person("your", "uncle") } } }),
    attic: piece({ what: { w: { n: at("what", "n", "found {thing} in the attic") }, sub: { n: thing("accordion") } } }),
    html: (() => { piece({ what: lost() }); return phraseHtml("what"); })(),
    fresh: (() => { useGrammar(GRAMMARS["story-bits"]); rng = seeded(3); const out = []; for (let i = 0; i < 400; i++) { const ph = randomPhrase("what"); if (ph.sub?.n) out.push({ card: subSchema("what", ph, "n"), x: !!ph.sub.n.x, ok: validPhrase("what", ph, 0), clause: "c" in ph.sub.n.w }); } return out; })(),
  }; })()`);
  assert.equal(r.lost.what, "lost a dog");
  assert.equal(r.banned.what, "got banned from the DMV");
  assert.equal(r.eloped.what, "eloped with your uncle");
  assert.equal(r.attic.what, "found an accordion in the attic");
  assert.ok(r.lost.ok && r.banned.ok && r.eloped.ok && r.attic.ok);
  // The verb and the nested thing's words are separate handles.
  assert.match(r.html, /data-path="n"/);
  assert.match(r.html, /data-path="n\.n"/);
  // Fresh phrases nest often, stay valid, and an object followed by more words takes no clause.
  assert.ok(r.fresh.length > 50, `only ${r.fresh.length} frames drawn`);
  assert.ok(r.fresh.every((f) => f.ok));
  assert.ok(r.fresh.filter((f) => f.card !== "who").every((f) => f.x && !f.clause));
  assert.deepEqual(new Set(r.fresh.map((f) => f.card)), new Set(["thing", "where", "who"]));
});

test("Sideways on the verb keeps the object; Flip finds the opposite mood around it", () => {
  const { json } = engine();
  const r = json(`(() => { ${H} piece({ what: lost() });
    const side = moveCandidates("what", ["n"], "sideways");
    const flip = moveCandidates("what", ["n"], "flip");
    const v = (ph) => word("what", ph, "n").v;
    const text = (ph) => flat(tokens("what", ph, THEY, "what"));
    return {
      side: side.slice(0, 3).map((c) => ({ text: text(c.ph), dog: same(c.ph.sub?.n, state.pick.what.sub.n) })),
      flip: flip.slice(0, 3).map((c) => ({ text: text(c.ph), v: v(c.ph), dog: same(c.ph.sub?.n, state.pick.what.sub.n) })),
      label: side[0].label,
    };
  })()`);
  assert.ok(r.side.length === 3 && r.side.every((c) => c.dog), JSON.stringify(r.side));
  assert.match(r.side[0].text, / a dog\b/);
  assert.ok(r.flip.length === 3 && r.flip.every((c) => c.v === 1 && c.dog), JSON.stringify(r.flip));
  assert.equal(r.flip[0].text, "won a dog");
  assert.match(r.label, /^Sideways: lost a dog → \w+ a dog/);
});

test("how they feel: intensity, emotion, what it's about, and what they're doing about it", () => {
  const { json } = engine();
  const r = json(`(() => { ${H}
    const feel = (n, extra = {}, sub) => ({ w: { n: at("feel", "n", n), ...extra }, ...(sub && { sub }) });
    const full = feel("furious", { i: at("feel", "i", "quietly"), b: at("feel", "b", "about {thing}"), t: at("feel", "t", "and {has} started a podcast") }, { b: thing("dog") });
    const blame = feel("furious", { t: at("feel", "t", "and blame{s} {who}") }, { t: person("her", "dentist") });
    const say = (who) => piece({ who, feel: clone(full) }).line;
    const sayBlame = (who) => piece({ who, feel: clone(blame) }).feel;
    // "excited about it" already says what it's about; "furious" doesn't.
    const ok = (n) => allowed("feel", { w: { n: at("feel", "n", n) } }, partOf("feel", "b"));
    return {
      they: say(person("your", "roommate")), he: say(person("your", "uncle")), she: say(person("your", "grandmother")),
      blameThey: sayBlame(person("your", "roommate")), blameHe: sayBlame(person("your", "uncle")),
      about: { furious: ok("furious"), excited: ok("excited about it"), pretending: ok("pretending it doesn't bother {o}"), smug: ok("smug") },
      intense: allowed("feel", { w: { n: at("feel", "n", "smug") } }, partOf("feel", "i")),
      valid: validPhrase("feel", clone(full), 0),
      paths: (() => { piece({ feel: clone(full) }); return [...phraseHtml("feel").matchAll(/data-path="([^"]+)"/g)].map((m) => m[1]); })(),
    };
  })()`);
  assert.match(r.they, /, and they are quietly furious about a dog and have started a podcast\.$/);
  assert.match(r.he, /, and he is quietly furious about a dog and has started a podcast\.$/);
  assert.match(r.she, /, and she is quietly furious about a dog and has started a podcast\.$/);
  assert.equal(r.blameThey, "furious and blame her dentist");
  assert.equal(r.blameHe, "furious and blames her dentist");
  assert.deepEqual(r.about, { furious: true, excited: false, pretending: false, smug: true });
  assert.equal(r.intense, true);
  assert.equal(r.valid, true);
  assert.deepEqual(r.paths.filter((p) => !p.includes("|")), ["i", "n", "b", "b.n", "t"]);
});

test("Flip on a feeling flips its mood; Sideways keeps the family", () => {
  const { json } = engine();
  const r = json(`(() => { ${H}
    piece({ feel: { w: { n: at("feel", "n", "furious"), b: at("feel", "b", "about {thing}") }, sub: { b: thing("dog") } } });
    const e = (c) => entryOf("feel", "n", c.ph.w.n);
    const flip = moveCandidates("feel", ["n"], "flip").slice(0, 4).map((c) => ({ v: e(c).v, about: "b" in c.ph.w }));
    const side = moveCandidates("feel", ["n"], "sideways").slice(0, 2).map((c) => e(c).tags);
    return { flip, side };
  })()`);
  assert.ok(r.flip.length && r.flip.every((c) => c.v === 1), JSON.stringify(r.flip));
  assert.ok(r.flip.some((c) => c.about), "an emotion that takes about keeps what it's about");
  assert.ok(r.side.every((t) => t.includes("anger")), JSON.stringify(r.side));
});

test("old pieces keep their headline", () => {
  const { json } = engine();
  const r = json(`(() => ${JSON.stringify(OLD.pieces)}.map((p) => { const snap = parseSnapshot(p.snap); if (!snap) return null; applySnapshot(snap); return bitLine(context()); }))()`);
  assert.equal(r.length, OLD.pieces.length);
  r.forEach((line, i) => assert.equal(line, OLD.pieces[i].line, `piece ${i}`));
});

test("generated text: no “who” after a non-person, no “Is” before a plural, no article on a mass noun", () => {
  const { json } = engine();
  const r = json(`(() => {
    const lines = [];
    for (const g of Object.values(GRAMMARS)) for (const f of Object.keys(g.forms)) {
      const L = g.forms[f].stanzas.length;
      for (let k = 1; k <= 14; k++) { fresh(g, f, 1 + (k % L), k % 3, 1 + ((k * 2654435761) % 4294967291)); lines.push(...pieceText().split(" | ")); }
    }
    // Things, places, creatures and rivals: the last word of every head word on those cards.
    const nouns = new Set();
    const heads = { "story-bits": ["thing", "where"], "small-poems": ["image"], "just-so": ["who", "rival"], sayings: ["who"] };
    for (const [gid, cards] of Object.entries(heads)) for (const c of cards) {
      const part = GRAMMARS[gid].schemas[c].parts.find((p) => p.k === "n");
      for (const w of part.pool) if (!w.pr || w.pr === "it" || w.p === "it" || !w.p) nouns.add(w.t.split(" ").pop().toLowerCase());
    }
    return { lines, nouns: [...nouns] };
  })()`);
  assert.ok(r.lines.length > 400, `only ${r.lines.length} lines`);
  const people = new Set(["god", "king", "gossip", "accountant", "postmaster", "man", "umbrellas", "baker", "tailor", "ex", "mom", "dad"]);
  const nouns = r.nouns.filter((n) => /^[a-z]+$/.test(n) && !people.has(n));
  const whoAfter = new RegExp(`\\b(${nouns.join("|")}) who\\b`, "i");
  const bad = r.lines.filter((l) => whoAfter.test(l));
  assert.deepEqual(bad, []);
  const isPlural = r.lines.filter((l) => { const m = l.match(/\bIs (?:the |an? )?([a-z]+)\b/); return m && /s$/.test(m[1]) && !["this", "his", "its", "us"].includes(m[1]); });
  assert.deepEqual(isPlural, []);
  assert.deepEqual(r.lines.filter((l) => /\b[Aa] (bruised |patient )?weather\b/.test(l) || /[{}]/.test(l)), []);
});

test("every built-in grammar checks clean, and retired words aren't offered", () => {
  const { json } = engine();
  const r = json(`(() => ({
    checks: Object.values(GRAMMARS).map((g) => checkGrammar(g)),
    stars: (() => { useGrammar(GRAMMARS["just-so"]); const p = partOf("rival", "n"); return options("rival", p, 0).some((i) => p.pool[i].t === "stars"); })(),
    weather: (() => { useGrammar(GRAMMARS["small-poems"]); const i = partOf("image", "n").pool.findIndex((w) => w.t === "weather"); return flat(tokens("image", { w: { n: i } }, THEY, "image")); })(),
    needsTypo: (() => { const g = clone(GRAMMARS["story-bits"]); g.schemas.feel.parts.find((p) => p.k === "b").needs = "abuot"; return checkGrammar(g); })(),
  }))()`);
  assert.deepEqual(r.checks, ["", "", "", "", ""]);
  assert.equal(r.stars, false);
  assert.equal(r.weather, "weather");
  assert.match(r.needsTypo, /needs a slot/);
});
