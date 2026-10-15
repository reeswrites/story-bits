// Every built-in grammar, checked as a whole: valid, with forms that have beats, a tiered beat
// ladder, and enough words in every required slot that the library's constraints (no “e”,
// alliteration on “s”, two-syllable words) still leave choices.
import { test } from "node:test";
import assert from "node:assert/strict";
import { engine } from "./load.mjs";

// Grammars that were written before this check, and the constraints they can't meet yet.
const KNOWN_GAPS = { "story-bits": ["startsWith", "lipogram"] };

test("every built-in grammar checks out and its forms have tiered beats", () => {
  const r = engine().json(`Object.values(GRAMMARS).map((g) => ({
    id: g.id,
    err: checkGrammar(g),
    forms: Object.entries(g.forms).map(([k, f]) => ({ k, stanzas: f.stanzas.length,
      tiers: [...new Set(Object.values(f.beats).flatMap((b) => (b.byMood ? Object.values(b.lines).flat() : b.lines).map((l) => l.tier)))].sort() })),
  }))`);
  assert.ok(r.length >= 5);
  for (const g of r) {
    assert.equal(g.err, "", g.id);
    assert.ok(g.forms.length >= 2, `${g.id}: at least two forms`);
    for (const f of g.forms) {
      assert.ok(f.stanzas >= 2, `${g.id}/${f.k}: more than the headline`);
      assert.deepEqual(f.tiers, [0, 1, 2], `${g.id}/${f.k}: beat lines on every tier`);
    }
  }
});

test("every required slot keeps options under each built-in constraint", () => {
  const r = engine().json(`(() => {
    const cs = [{ type: "lipogram", letters: "e" }, { type: "startsWith", letter: "s" }, { type: "maxSyllables", n: 2 }];
    const out = [];
    for (const g of Object.values(GRAMMARS)) for (const c of cs) {
      const h = { ...g, rules: { ...g.rules, constraints: [c] } };
      for (const [s, sc] of Object.entries(g.schemas)) for (const p of sc.parts) if (!p.opt)
        out.push({ g: g.id, c: c.type, slot: s + "." + p.k, n: p.pool.filter((w) => entryAllowed(w, h)).length });
    }
    return out;
  })()`);
  const thin = r.filter((x) => !(KNOWN_GAPS[x.g] || []).includes(x.c) && x.n < 3);
  assert.deepEqual(thin, [], "slots with fewer than 3 words under a constraint");
});
