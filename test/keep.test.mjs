// The kept shelf: every grammar names what's worth keeping, the old cast moves onto the shelf
// without loss, and "Tell another" keeps the kept phrase while everything else moves.
import { test } from "node:test";
import assert from "node:assert/strict";
import { engine } from "./load.mjs";

test("every built-in grammar declares a keep shelf on a headline card", () => {
  const r = engine().json(`Object.values(GRAMMARS).map((g) => ({ id: g.id, keep: g.keep, head: headlineCards(g), of: keepOf(g) }))`);
  for (const g of r) {
    assert.ok(g.keep, `${g.id} has no keep`);
    assert.ok(g.head.includes(g.keep.card), `${g.id}: keep card ${g.keep.card} isn't in the headline`);
    assert.deepEqual(g.of, g.keep, `${g.id}: keepOf uses the declared keep`);
  }
  assert.equal(r.find((g) => g.id === "story-bits").keep.card, "who");
  assert.equal(r.find((g) => g.id === "small-poems").keep.card, "image");
});

test("checkGrammar checks keep, and keepOf falls back for grammars without one", () => {
  const r = engine().json(`(() => {
    const bad = {
      "not an object": (g) => { g.keep = "who"; },
      "unknown card": (g) => { g.keep.card = "nope"; },
      "card not in the headline": (g) => { g.keep.card = "where"; },
      "no name": (g) => { g.keep.name = ""; },
      "long verb": (g) => { g.keep.verb = "x".repeat(31); },
      "long note": (g) => { g.keep.note = "x".repeat(201); },
    };
    const accepted = Object.entries(bad).filter(([, edit]) => { const g = clone(GRAMMARS["story-bits"]); edit(g); return !checkGrammar(g); }).map(([n]) => n);
    const noKeep = (id) => { const g = clone(GRAMMARS[id]); delete g.keep; return { ok: checkGrammar(g), of: keepOf(g) }; };
    return { accepted, story: noKeep("story-bits"), poems: noKeep("small-poems"), hinge: noKeep("hinge") };
  })()`);
  assert.deepEqual(r.accepted, []);
  assert.equal(r.story.ok, "");
  assert.deepEqual(r.story.of, { card: "who", name: "The cast", verb: "Keep this character" });
  assert.equal(r.poems.of.card, "image");
  assert.equal(r.hinge.of.card, "prompt", "no pronouns: the first card the headline names");
});

test("the old cast moves onto the shelf without loss", () => {
  const r = engine().json(`(() => {
    useGrammar(GRAMMARS["story-bits"]);
    const raw = [
      { who: 3, bits: ["Your grandmother got a tattoo of a lighthouse, and she is proud."] }, // oldest: a bare index, no grammar
      { g: "story-bits", who: { w: { d: 1, n: 5 } }, bits: ["a", "b"] },
      { g: "my-fork", who: { w: { n: 0 } }, bits: ["c"] },
      { g: "story-bits", who: null, bits: [] }, // unreadable: dropped
      "junk",
    ];
    const shelf = castToShelf(raw, (g) => (g === "my-fork" ? "hero" : GRAMMARS[g]?.pronouns));
    return { shelf, here: shelfFor(shelf, GRAMMARS["story-bits"]).map(({ i }) => i), poems: shelfFor(shelf, GRAMMARS["small-poems"]).length };
  })()`);
  assert.deepEqual(r.shelf, [
    { g: "story-bits", card: "who", ph: { w: { n: 3 } }, bits: ["Your grandmother got a tattoo of a lighthouse, and she is proud."] },
    { g: "story-bits", card: "who", ph: { w: { d: 1, n: 5 } }, bits: ["a", "b"] },
    { g: "my-fork", card: "hero", ph: { w: { n: 0 } }, bits: ["c"] },
  ]);
  assert.deepEqual(r.here, [0, 1]);
  assert.equal(r.poems, 0);
});

test("keeping merges by head word, and Tell another keeps the phrase in every grammar", () => {
  const r = engine().json(`(() => {
    const out = [];
    for (const g of Object.values(GRAMMARS)) for (const f of Object.keys(g.forms)) {
      fresh(g, f, g.forms[f].stanzas.length, 1, 3);
      const card = keepOf(G).card;
      const list = [];
      const first = shelve(list, { g: G.id, card, ph: clone(state.pick[card]), bits: [bitLine(context())] });
      const text = keptText(card, first.ph);
      // The same head word again, with one more headline: one entry, two headlines.
      shelve(list, { g: G.id, card, ph: clone(state.pick[card]), bits: ["another"] });
      // Tell another: pin it, reroll everything else.
      const before = clone(state.pick);
      pinPhrase(card, list[0].ph);
      rerollPick(SLOTS.map((c) => c.key).filter((k) => k !== card));
      const moved = SLOTS.filter((c) => c.key !== card && !same(state.pick[c.key], before[c.key])).length;
      out.push({ where: g.id + "/" + f, entries: list.length, bits: list[0].bits.length, kept: same(state.pick[card], list[0].ph), inHeadline: bitLine(context()).toLowerCase().includes(text.toLowerCase()), moved, here: shelfFor(list, G).length });
    }
    return out;
  })()`);
  for (const x of r) {
    assert.equal(x.entries, 1, x.where);
    assert.equal(x.bits, 2, x.where);
    assert.ok(x.kept, `${x.where}: the kept phrase stays`);
    assert.ok(x.inHeadline, `${x.where}: the kept phrase is in the new headline`);
    assert.ok(x.moved > 0, `${x.where}: something else moved`);
    assert.equal(x.here, 1, x.where);
  }
});
