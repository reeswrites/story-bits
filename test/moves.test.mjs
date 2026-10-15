// Moves: the picker's lateral changes (sideways, zoom out, add, flip, sound) and the plain →
// strange steps. Every candidate is a valid whole phrase that differs from the current one, and
// each move does what it says, from grammar data alone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { engine } from "./load.mjs";

// Story Bits' who card has tags on its people and a relation slot ({who}'s).
const TAGGED = `GRAMMARS["story-bits"]`;

test("every move's candidates are valid, new, and labeled", () => {
  const { json } = engine();
  const problems = json(`(() => {
    const out = [];
    for (const g of Object.values(GRAMMARS)) for (let k = 1; k <= 12; k++) {
      fresh(g, undefined, 2, k % 3, k);
      for (const c of SLOTS) walk(c.key, state.pick[c.key], (schema, p, ph, depth, path) => {
        for (const [m, cands] of Object.entries(movesFor(c.key, path))) for (const x of cands) {
          const where = g.id + "/" + k + " " + c.key + "|" + path.join(".") + " " + m;
          if (!validPhrase(c.key, x.ph, 0)) out.push(where + ": invalid");
          if (same(x.ph, state.pick[c.key]) || !x.changed.length) out.push(where + ": no change");
          if (!x.label.includes(" → ") || /undefined|[{}]/.test(x.label)) out.push(where + ": label " + x.label);
          const line = previewLine(c.key, x.ph, x.changed);
          if (/undefined|[{}]/.test(previewLine(c.key, x.ph, x.changed, null, false))) out.push(where + ": bad preview");
        }
      });
    }
    return out;
  })()`);
  assert.deepEqual(problems, []);
});

test("sideways keeps slot and register, and prefers a shared tag", () => {
  const { json } = engine();
  const r = json(`(() => {
    fresh(${TAGGED}, undefined, 2, 1, 4);
    const pool = SCHEMAS.who.parts.find((p) => p.k === "n").pool;
    state.pick.who = { w: { w: 0, n: pool.findIndex((w) => w.t === "uncle") } };
    const c = moveCandidates("who", ["n"], "sideways");
    const heads = c.map((x) => pool[x.ph.w.n].t);
    const firstTags = c.slice(0, 4).map((x) => pool[x.ph.w.n].tags);
    // Without tags it still moves, within the register.
    fresh("story-bits", undefined, 2, 1, 4);
    const ev = moveCandidates("what", ["n"], "sideways");
    const tier = word("what", state.pick.what, "n").tier;
    return { heads, firstTags, untagged: ev.length, sameTier: ev.every((x) => word("what", x.ph, "n").tier === tier), changed: c[0].changed, label: c[0].label };
  })()`);
  assert.ok(r.firstTags.every((t) => t.includes("family")), JSON.stringify(r.firstTags));
  assert.ok(r.heads.includes("dentist"), "words outside the family still follow");
  assert.ok(r.untagged > 0 && r.sameTier);
  assert.deepEqual(r.changed, ["n"]);
  assert.match(r.label, /^Sideways: uncle → /);
});

test("zoom out nests the phrase in a relation, or fills a slot that nests a card", () => {
  const { json } = engine();
  const r = json(`(() => {
    fresh(${TAGGED}, undefined, 2, 1, 5);
    const pool = SCHEMAS.who.parts.find((p) => p.k === "n").pool;
    state.pick.who = { w: { d: 3, n: pool.findIndex((w) => w.t === "uncle") } };
    const c = moveCandidates("who", ["n"], "zoom");
    const text = c.map((x) => flat(tokens("who", x.ph, THEY, "who")));
    // Story Bits, no relation flag: "blames {thing}"-style slots are found by their words.
    fresh("story-bits", undefined, 2, 1, 5);
    state.pick.what = { w: { n: 1 } };
    const z = moveCandidates("what", ["n"], "zoom");
    // At the deepest level, nothing can nest.
    useGrammar(${TAGGED});
    state.pick.who = { w: { r: 0, n: 0 }, sub: { r: { w: { r: 0, n: 1 }, sub: { r: { w: { n: 2 } } } } } };
    const deep = validPhrase("who", state.pick.who, 0) ? moveCandidates("who", ["r", "r", "n"], "zoom").length : -1;
    return { text, z: z.map((x) => ({ nests: !!subSchema("what", x.ph, "t"), changed: x.changed })), deep };
  })()`);
  assert.ok(r.text.length > 0);
  for (const t of r.text) assert.match(t, /^your soft-spoken uncle's [a-z]/, t);
  assert.ok(r.text.every((t) => !/your your/.test(t)));
  assert.ok(r.z.length > 0 && r.z.every((x) => x.nests && x.changed.includes("t")));
  assert.equal(r.deep, 0);
});

test("add fills an empty optional slot that doesn't nest, and respects needs", () => {
  const { json } = engine();
  const r = json(`(() => {
    fresh("story-bits", undefined, 2, 1, 6);
    state.pick.who = { w: { w: 0, n: 0 } };
    const who = moveCandidates("who", ["n"], "add");
    const feelPool = SCHEMAS.feel.parts.find((p) => p.k === "n").pool;
    state.pick.feel = { w: { n: feelPool.findIndex((w) => !w.adj) } };
    const feel = moveCandidates("feel", ["n"], "add");
    return {
      who: who.map((x) => x.changed), whoNest: who.some((x) => x.ph.sub),
      intensity: feel.some((x) => "i" in x.ph.w), feelNest: feel.some((x) => x.ph.sub),
      label: who[0].label,
    };
  })()`);
  assert.ok(r.who.length > 0 && r.who.every((c) => c.length === 1 && c[0] === "d"));
  assert.equal(r.whoNest, false);
  assert.equal(r.intensity, false, "an intensity needs a feeling that takes one");
  assert.equal(r.feelNest, false);
  assert.match(r.label, /^Add: your uncle → your .+ uncle$/);
});

test("flip gives the opposite mood at a similar register", () => {
  const { json } = engine();
  const r = json(`(() => {
    fresh("story-bits", undefined, 2, 1, 7);
    const pool = SCHEMAS.feel.parts.find((p) => p.k === "n").pool;
    const out = [];
    for (const i of [pool.findIndex((w) => w.v === 1 && w.tier === 0), pool.findIndex((w) => w.v === 0), pool.findIndex((w) => w.v === -1 && w.tier === 1)]) {
      state.pick.feel = { w: { n: i } };
      const c = moveCandidates("feel", ["n"], "flip");
      out.push({ v: pool[i].v, tier: pool[i].tier, got: c.map((x) => ({ v: pool[x.ph.w.n]?.v, tier: pool[x.ph.w.n]?.tier })) });
    }
    // From the intensity, flip still turns the feeling.
    state.pick.feel = { w: { i: 0, n: pool.findIndex((w) => w.v === 1 && w.adj) } };
    const fromI = moveCandidates("feel", ["i"], "flip").every((x) => pool[x.ph.w.n].v === -1);
    // Cards without moods have no flip.
    const noMood = moveCandidates("who", ["n"], "flip").length;
    return { out, fromI, noMood };
  })()`);
  for (const o of r.out) {
    assert.ok(o.got.length > 0);
    assert.ok(o.got.every((g) => (o.v === 0 ? g.v !== 0 : g.v === -o.v)));
    assert.equal(o.got[0].tier, o.tier, "nearest register first");
  }
  assert.equal(r.fromI, true);
  assert.equal(r.noMood, 0);
});

test("sound alliterates with a neighbor, or with the current word", () => {
  const { json } = engine();
  const r = json(`(() => {
    const out = [];
    for (const g of Object.values(GRAMMARS)) for (let k = 1; k <= 10; k++) {
      fresh(g, undefined, 2, 1, k);
      for (const c of SLOTS) {
        const cur = state.pick[c.key];
        for (const x of moveCandidates(c.key, ["n"], "sound")) {
          const mine = letterOf(c.key, "n", x.ph.w.n);
          const words = tokens(c.key, x.ph, person(), c.key).filter((t) => t.word);
          const letters = words.map((t) => t.word.trim().charAt(0).toLowerCase());
          const others = SLOTS.filter((s) => s.key !== c.key && stanza().slots.includes(s.key)).map((s) => phraseSound(s.key, state.pick[s.key]));
          // Either the head changed to match a neighbor, or another word now matches the head.
          const ok = x.changed.includes("n") ? (letters.filter((l) => l === mine).length > 1 || others.includes(mine)) : letters.filter((l) => l === mine).length > 1;
          if (!ok) out.push(g.id + "/" + k + " " + c.key + ": " + x.label);
        }
      }
    }
    return out;
  })()`);
  assert.deepEqual(r, []);
});

test("moves respect a grammar's constraints", () => {
  const { json } = engine();
  const bad = json(`(() => {
    const out = [];
    for (const c of [{ type: "lipogram", letters: "e" }, { type: "maxSyllables", n: 2 }]) {
      const g = constrained("story-bits", c);
      for (let k = 1; k <= 8; k++) {
        fresh(g, undefined, 2, 1, k);
        for (const s of SLOTS) for (const cands of Object.values(movesFor(s.key, ["n"]))) for (const x of cands)
          for (const p of x.changed) {
            const at = locate(s.key, x.ph, p.split("."));
            if (at && at.k in at.ph.w && typeof at.ph.w[at.k] === "number" && !entryAllowed(word(at.schema, at.ph, at.k), g)) out.push(c.type + ": " + x.label);
          }
      }
    }
    return out;
  })()`);
  assert.deepEqual(bad, []);
});

test("a preview marks the change in the headline without touching the piece", () => {
  const { json } = engine();
  const r = json(`(() => {
    fresh("story-bits", undefined, 2, 1, 9);
    const before = JSON.stringify(state.pick);
    const x = moveCandidates("who", ["n"], "sideways")[0];
    const html = previewLine("who", x.ph, x.changed);
    return { marked: /class="w changed"/.test(html), words: /class="word/.test(html), same: JSON.stringify(state.pick) === before, sel: state.sel };
  })()`);
  assert.deepEqual(r, { marked: true, words: false, same: true, sel: null });
});

test("swapping a word that nests the same card keeps the phrase inside", () => {
  const { json } = engine();
  const r = json(`(() => {
    fresh("story-bits", undefined, 2, 1, 10);
    const pool = SCHEMAS.what.parts.find((p) => p.k === "t").pool;
    const a = pool.findIndex((w) => w.t === "thanks to {thing}"), b = pool.findIndex((w) => w.t === "because of {thing}");
    state.pick.what = { w: { n: 0, t: a }, sub: { t: { w: { n: 3 } } } };
    return variants("what", ["t"], [b])[0];
  })()`);
  assert.deepEqual(r.sub.t, { w: { n: 3 } });
});
