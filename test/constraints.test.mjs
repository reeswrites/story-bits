// Constraints (lipogram, alliteration, syllable cap, closed) restrict which words a grammar offers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { engine } from "./load.mjs";

test("constraints hold wherever the grammar has words that meet them", () => {
  const { json } = engine();
  const constraints = [
    { type: "lipogram", letters: "e" },
    { type: "lipogram", letters: "ai" },
    { type: "startsWith", letter: "s" },
    { type: "maxSyllables", n: 2 },
  ];
  for (const c of constraints) {
    const r = json(`(() => {
      const out = { broken: [], words: 0, lines: 0 };
      for (const id of Object.keys(GRAMMARS)) {
        const g = constrained(id, ${JSON.stringify(c)});
        if (checkGrammar(g)) { out.broken.push(id + ": " + checkGrammar(g)); continue; }
        for (const f of Object.keys(g.forms)) for (let l = 1; l <= g.forms[f].stanzas.length; l++) for (let k = 1; k <= 2; k++) {
          fresh(g, f, l, (l + k) % 3, k);
          const where = id + "/" + f + "/" + l + "/seed " + k;
          // Words, and the determiners they bring.
          for (const card of SLOTS) walk(card.key, state.pick[card.key], (schema, part, ph, depth, path) => {
            const e = word(schema, ph, part.k);
            const possible = part.pool.some((w) => (depth < MAX_DEPTH || !nests(w)) && entryAllowed(w, G));
            if (possible && !entryAllowed(e, G)) out.broken.push(where + " " + card.key + "." + path.join(".") + ": " + (e.det ? e.det + " " : "") + e.t);
            else out.words++;
          });
          // Beat lines, which a lipogram covers too.
          const ctx = context();
          for (const [key, i] of Object.entries(beatChoices(ctx))) {
            const line = beatLines(key, ctx)[i];
            const possible = beatLines(key, ctx).some((x) => lineFits(x) && lipogramOk(x.t, G));
            if (possible && !lipogramOk(line.t, G)) out.broken.push(where + " beat " + key + ": " + line.t);
            else out.lines++;
          }
        }
      }
      return out;
    })()`);
    assert.deepEqual(r.broken, [], JSON.stringify(c));
    assert.ok(r.words > 100 && r.lines > 50, `${JSON.stringify(c)}: checked only ${r.words} words, ${r.lines} lines`);
  }
});

test("a constrained or closed grammar keeps your own words out", () => {
  const { json } = engine();
  const r = json(`(() => {
    const lipo = constrained("small-poems", { type: "lipogram", letters: "e" });
    const open = constrained("small-poems", { type: "maxSyllables", n: 6 });
    const closed = constrained("small-poems", { type: "closed" });
    const entry = (g, t) => ({ g: g.id, s: "image", k: "n", t, tier: 0 });
    const offered = (g, t) => withGrammar(g, () => options("image", partOf("image", "n"), 0).some((v) => typeof v === "object" && v.c === t));
    bank = [entry(lipo, "a red door"), entry(lipo, "a moth"), entry(open, "a moth"), entry(closed, "a moth")];
    return {
      lipoErr: checkEntry(entry(lipo, "a red door"), lipo),
      lipoOk: checkEntry(entry(lipo, "a moth"), lipo),
      lipoOffersBreaking: offered(lipo, "a red door"),
      lipoOffersOk: offered(lipo, "a moth"),
      openOffers: offered(open, "a moth"),
      closed: grammarClosed(closed),
      closedOffers: offered(closed, "a moth"),
    };
  })()`);
  assert.match(r.lipoErr, /constraints/);
  assert.equal(r.lipoOk, "");
  assert.equal(r.lipoOffersBreaking, false);
  assert.equal(r.lipoOffersOk, true);
  assert.equal(r.openOffers, true);
  assert.equal(r.closed, true);
  assert.equal(r.closedOffers, false);
});

test("syllable counts and constraint descriptions", () => {
  const { json } = engine();
  const r = json(`({
    s: ["cat", "table", "banana", ""].map(syllables),
    d: [{ type: "lipogram", letters: "ea" }, { type: "startsWith", letter: "s" }, { type: "maxSyllables", n: 1 }, { type: "closed" }].map(describeConstraint),
  })`);
  assert.deepEqual(r.s, [1, 2, 3, 0]);
  assert.ok(r.d.every(Boolean));
});
