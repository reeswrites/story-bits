// Every built-in grammar, form, length and dial setting generates; nested phrases stay valid.
import { test } from "node:test";
import assert from "node:assert/strict";
import { engine } from "./load.mjs";

test("every built-in grammar, form, length and dial setting generates", () => {
  const { json } = engine();
  const problems = json(`(() => {
    const out = [];
    eachCase((g, f, l, d) => {
      for (let k = 1; k <= 2; k++) {
        const where = g.id + "/" + f + "/" + l + "/dial " + d + "/seed " + k;
        try {
          fresh(g, f, l, d, k);
          rerollPick(SLOTS.map((c) => c.key));
          rerollPick([SLOTS[SLOTS.length - 1].key]);
          for (const c of SLOTS) if (!validPhrase(c.key, state.pick[c.key], 0)) out.push(where + ": invalid " + c.key);
          const text = pieceText();
          if (/undefined|null|NaN|[{}]/.test(text)) out.push(where + ": bad text " + text);
          const ctx = context();
          const html = bitHtml(ctx) + story(ctx).join("") + staticHtml(fixedSnapshot(), []);
          if (/undefined|[{}]/.test(html)) out.push(where + ": bad html");
          for (const [key, i] of Object.entries(beatChoices(ctx))) if (!beatLines(key, ctx)[i]) out.push(where + ": no line for beat " + key);
        } catch (e) { out.push(where + ": " + e.message); }
      }
    });
    return out;
  })()`);
  assert.deepEqual(problems, []);
});

test("nested phrases stay valid", () => {
  const { json } = engine();
  const r = json(`(() => {
    const problems = [];
    let nested = 0, deepest = 0, trailing = 0;
    for (const g of Object.values(GRAMMARS)) {
      for (let k = 1; k <= 60; k++) {
        fresh(g, undefined, 2, k % 3, k);
        for (const c of SLOTS) {
          const top = state.pick[c.key];
          const at = (path) => g.id + " seed " + k + " " + c.key + "." + path.join(".");
          if (!validPhrase(c.key, top, 0)) problems.push(at([]) + ": invalid");
          walk(c.key, top, (schema, part, ph, depth, path) => {
            deepest = Math.max(deepest, depth);
            if (depth > MAX_DEPTH) problems.push(at(path) + ": too deep");
            if (!allowed(schema, ph, part)) problems.push(at(path) + ": not allowed here");
            if (locate(c.key, top, path)?.ph !== ph) problems.push(at(path) + ": locate lost it");
            const inner = subSchema(schema, ph, part.k);
            if (!inner) { if (ph.sub && ph.sub[part.k]) problems.push(at(path) + ": orphan nested phrase"); return; }
            nested++;
            if (!ph.sub || !ph.sub[part.k]) { problems.push(at(path) + ": nests nothing"); return; }
            // A phrase in a noun card's trailing clause takes no trailing clause of its own.
            if (SCHEMAS[schema].noun && part.trailing) {
              trailing++;
              if (!ph.sub[part.k].x) problems.push(at(path) + ": not marked x");
              if (SCHEMAS[inner].parts.some((p) => p.trailing && p.k in ph.sub[part.k].w)) problems.push(at(path) + ": trailing clause in a trailing clause");
            }
          });
          // Swapping any word for any of its options, or dropping an optional one, keeps the phrase valid.
          walk(c.key, top, (schema, part, ph, depth, path) => {
            for (const v of options(schema, part, depth).slice(0, 25)) {
              if (!validPhrase(c.key, variants(c.key, path, [v])[0], 0)) problems.push(at(path) + ": swapping breaks it");
            }
            if (part.opt) {
              const t = clone(top);
              const here = locate(c.key, t, path);
              dropWord(here.schema, here.ph, here.k);
              if (!validPhrase(c.key, t, 0)) problems.push(at(path) + ": dropping breaks it");
            }
          });
        }
      }
    }
    // A phrase that nests is invalid where nesting is no longer allowed.
    useGrammar(GRAMMARS["story-bits"]);
    let tooDeep = null;
    for (let k = 1; k < 500 && tooDeep === null; k++) {
      rng = seeded(k);
      const p = randomPhrase("where");
      if (p.sub) tooDeep = validPhrase("where", p, MAX_DEPTH);
    }
    return { problems: problems.slice(0, 20), nested, deepest, trailing, tooDeep };
  })()`);
  assert.deepEqual(r.problems, []);
  assert.ok(r.nested > 50, `only ${r.nested} nested phrases checked`);
  assert.ok(r.trailing > 0, "no trailing clauses checked");
  assert.ok(r.deepest >= 1);
  assert.equal(r.tooDeep, false, "a nesting phrase read at max depth should be invalid");
});
