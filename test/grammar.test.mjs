// checkGrammar and checkEntry: what a grammar or a word may contain.
import { test } from "node:test";
import assert from "node:assert/strict";
import { engine } from "./load.mjs";

test("checkGrammar accepts every built-in grammar and rejects malformed ones", () => {
  const r = engine().json(`(() => {
    const builtins = Object.values(GRAMMARS).map((g) => [g.id, checkGrammar(g)]);
    const firstForm = (g) => Object.values(g.forms)[0];
    const plainBeat = (g) => Object.values(firstForm(g).beats).find((b) => !b.byMood);
    const edits = {
      "not an object": () => "story",
      "array": () => [],
      "bad id": (g) => { g.id = "Story Bits"; },
      "no name": (g) => { g.name = ""; },
      "long description": (g) => { g.description = "x".repeat(401); },
      "too deep": (g) => { g.maxDepth = 4; },
      "no cards": (g) => { g.cards = []; },
      "duplicate card": (g) => { g.cards.push({ ...g.cards[0] }); },
      "card without schema": (g) => { g.cards.push({ key: "extra", label: "Extra" }); },
      "no head slot": (g) => { g.schemas.who.parts = g.schemas.who.parts.filter((p) => p.k !== "n"); },
      "optional head": (g) => { g.schemas.who.parts.find((p) => p.k === "n").opt = true; },
      "empty pool": (g) => { g.schemas.what.parts[0].pool = []; },
      "bad tier": (g) => { g.schemas.what.parts[0].pool[0].tier = 3; },
      "unknown token": (g) => { g.schemas.what.parts[0].pool[0].t = "eats {lunch}"; },
      "missing mood": (g) => { delete g.schemas.feel.parts.find((p) => p.k === "n").pool[0].v; },
      "missing pronouns": (g) => { delete g.schemas.who.parts.find((p) => p.k === "n").pool[0].pos; },
      "needs a missing slot": (g) => { g.schemas.who.parts.find((p) => p.k !== "n").needs = "z"; },
      "line names no card": (g) => { g.line = "Nothing happened."; },
      "bad pronoun card": (g) => { g.pronouns = "where"; },
      "bad mood card": (g) => { g.moodCard = "where"; },
      "no rules": (g) => { delete g.rules; },
      "two dial labels": (g) => { g.rules.dialLabels = ["a", "b"]; },
      "pair with itself": (g) => { g.rules.pairs[0].b = g.rules.pairs[0].a; },
      "pair on taste": (g) => { g.rules.pairs[0].on = "taste"; },
      "mood pair without moods": (g) => { g.rules.pairs[0] = { a: "where", b: "thing", on: "mood" }; },
      "unknown constraint": (g) => { g.rules.constraints = [{ type: "palindrome" }]; },
      "lipogram of digits": (g) => { g.rules.constraints = [{ type: "lipogram", letters: "1" }]; },
      "startsWith two letters": (g) => { g.rules.constraints = [{ type: "startsWith", letter: "st" }]; },
      "maxSyllables as text": (g) => { g.rules.constraints = [{ type: "maxSyllables", n: "3" }]; },
      "maxSyllables too big": (g) => { g.rules.constraints = [{ type: "maxSyllables", n: 7 }]; },
      "no forms": (g) => { g.forms = {}; },
      "form without stanzas": (g) => { firstForm(g).stanzas = []; },
      "headline stanza with beats": (g) => { const f = firstForm(g); f.stanzas[0].paras = [[Object.keys(f.beats)[0]]]; },
      "stanza missing the headline's cards": (g) => { firstForm(g).stanzas[1].slots = ["where"]; },
      "missing beat": (g) => { firstForm(g).stanzas[1].paras = [["nope"]]; },
      "beat line with unknown token": (g) => { plainBeat(g).lines[0].t = "Then {lunch}."; },
      "unbalanced braces": (g) => { plainBeat(g).lines[0].t = "Then {who."; },
      "no landing": (g) => { for (const b of Object.values(firstForm(g).beats)) delete b.role; },
      "too big": (g) => { g.schemas.what.parts[0].pool[0].extra = "x".repeat(210 * 1024); },
    };
    const accepted = [];
    for (const [name, edit] of Object.entries(edits)) {
      let g = clone(GRAMMARS["story-bits"]);
      const out = edit(g);
      if (out !== undefined) g = out;
      if (!checkGrammar(g)) accepted.push(name);
    }
    return { builtins, accepted };
  })()`);
  for (const [id, err] of r.builtins) assert.equal(err, "", id);
  assert.deepEqual(r.accepted, [], "malformed grammars that passed");
});

test("checkGrammar rejects angle brackets anywhere", () => {
  const errs = engine().json(`(() => {
    const firstForm = (g) => Object.values(g.forms)[0];
    const edits = [
      (g) => { g.name = "Poems <3"; },
      (g) => { g.description = "<script>alert(1)</script>"; },
      (g) => { g.headline = "<b>Line</b>"; },
      (g) => { g.cards[0].label = "<i>Image</i>"; },
      (g) => { g.cards[0].hint = "an <img>"; },
      (g) => { g.schemas.image.parts[0].name = "<u>head</u>"; },
      (g) => { g.schemas.image.parts[0].pool[0].t = "a <b>kettle</b>"; },
      (g) => { g.schemas.image.parts[0].frame = "a ___ >"; },
      (g) => { g.rules.dialLabels[0] = "<"; },
      (g) => { g.rules.dialNotes[1] = "x > y"; },
      (g) => { g.rules.pairs[0].label = "<svg onload=alert(1)>"; },
      (g) => { firstForm(g).name = "<em>Form</em>"; },
      (g) => { Object.values(firstForm(g).beats)[0].name = "<b>beat</b>"; },
      (g) => { firstForm(g).stanzas[0].name = "<h1>"; },
      (g) => { g.extra = { deep: [{ deeper: "<iframe>" }] }; },
      (g) => { g.extra = { "<key>": 1 }; },
    ];
    return edits.map((edit) => { const g = clone(GRAMMARS["small-poems"]); edit(g); return checkGrammar(g); });
  })()`);
  for (const [i, err] of errs.entries()) assert.match(err, /angle brackets/, `edit ${i}`);
});

test("cleanWord and checkEntry keep markup and template tokens out of words", () => {
  const r = engine().json(`(() => {
    const g = GRAMMARS["story-bits"];
    return {
      clean: ["  a <b>bold</b> {who} move!! ", "x>y<z", null].map(cleanWord),
      ok: checkEntry({ s: "what", k: "n", t: "ate soup", tier: 0, v: 0 }, g),
      bad: [
        { s: "what", k: "n", t: "ate <b>soup</b>", tier: 0, v: 0 },
        { s: "what", k: "n", t: "ate {who}", tier: 0, v: 0 },
        { s: "what", k: "n", t: "x".repeat(61), tier: 0, v: 0 },
        { s: "what", k: "n", t: "ate soup", tier: 5, v: 0 },
        { s: "what", k: "n", t: "ate soup", tier: 0 },
        { s: "nope", k: "n", t: "ate soup", tier: 0 },
        { g: "small-poems", s: "what", k: "n", t: "ate soup", tier: 0, v: 0 },
        "soup",
      ].map((e) => checkEntry(e, g)),
    };
  })()`);
  assert.deepEqual(r.clean, ["a bold who move", "xyz", ""]);
  assert.equal(r.ok, "");
  for (const [i, err] of r.bad.entries()) assert.ok(err, `bad entry ${i} accepted`);
});
