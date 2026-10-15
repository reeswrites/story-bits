// Story Bits' who card as a grammar: whose, relations, pronouns from the outer head, old links
// and kept phrases from before "whose", and word families (tags) for lateral moves.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { engine } from "./load.mjs";

const OLD = JSON.parse(readFileSync(new URL("./fixtures/old-links.json", import.meta.url), "utf8"));

// Helpers inside the engine: a who phrase from words ("your", "uncle"), a relation around one.
const WHO = `
useGrammar(GRAMMARS["story-bits"]);
const at = (k, t) => SCHEMAS.who.parts.find((p) => p.k === k).pool.findIndex((w) => w.t === t);
const who = (w, n, d) => ({ w: { w: at("w", w), n: at("n", n), ...(d && { d: at("d", d) }) } });
const rel = (inner, n) => ({ w: { r: 0, n: at("n", n) }, sub: { r: inner } });
const say = (ph) => { fresh("story-bits", "bit", 1, 1, 2); state.pick.who = ph; return { who: phraseText("who"), line: bitLine(context()), ok: validPhrase("who", clone(ph), 0) }; };
`;

test("whose is its own slot, and a/an agrees with the next word", () => {
  const { json } = engine();
  const r = json(`(() => { ${WHO} return [
    say(who("your", "uncle")), say(who("his", "dentist", "soft-spoken")), say(who("a", "uncle")),
    say(who("a", "uncle", "very tall")), say(who("someone's", "ex")), say(who("the", "kid down the street")),
  ]; })()`);
  assert.deepEqual(r.map((x) => x.who), ["your uncle", "his soft-spoken dentist", "an uncle", "a very tall uncle", "someone's ex", "the kid down the street"]);
  assert.ok(r.every((x) => x.ok));
  assert.match(r[0].line, /^Your uncle /);
});

test("relations nest another who, which brings the determiner; pronouns come from the outer head", () => {
  const { json } = engine();
  const r = json(`(() => { ${WHO} return {
    dentist: say(rel(who("your", "uncle"), "dentist")),
    chain: say(rel(rel(who("your", "sister"), "ex"), "landlord")),
    her: say(rel(who("my", "mom", "freshly divorced"), "therapist")),
    tooDeep: validPhrase("who", rel(rel(rel(who("your", "sister"), "ex"), "ex"), "landlord"), 0),
    whoseToo: validPhrase("who", { ...rel(who("your", "uncle"), "dentist"), w: { r: 0, w: 0, n: at("n", "dentist") } }, 0),
    html: (() => { state.pick.who = rel(who("your", "uncle"), "dentist"); return phraseHtml("who", true); })(),
  }; })()`);
  assert.equal(r.dentist.who, "your uncle's dentist");
  assert.match(r.dentist.line, /^Your uncle's dentist .*, and he is /);
  assert.equal(r.chain.who, "your sister's ex's landlord");
  assert.match(r.chain.line, /, and they are /, "the landlord's pronouns, not the sister's");
  assert.equal(r.her.who, "my freshly divorced mom's therapist");
  assert.match(r.her.line, /, and she is /);
  assert.ok(r.dentist.ok && r.chain.ok && r.her.ok);
  assert.equal(r.tooDeep, false, "relations chain only to maxDepth");
  assert.equal(r.whoseToo, false, "a relation and a whose can't both lead");
  // The possessive sticks to the nested phrase, and every word stays tunable.
  assert.match(r.html, /uncle<\/button><\/span><span class="plain">&#39;s<\/span> <button/);
  assert.match(r.html, /data-path="r\.w"/);
  assert.match(r.html, /data-path="r\.n"/);
  assert.match(r.html, /data-path="n"/);
});

test("adding and dropping a relation keeps the phrase grammatical", () => {
  const { json } = engine();
  const r = json(`(() => { ${WHO}
    const ph = who("his", "uncle");
    setWord("who", ph, "r", 0, 0);
    const added = { w: ph.w.w, hasSub: !!ph.sub?.r?.w?.w };
    const inner = clone(rel(who("her", "brother"), "barber"));
    dropWord("who", inner, "r");
    fresh("story-bits", "bit", 1, 1, 2); state.pick.who = inner;
    return { added, dropped: phraseText("who"), droppedW: inner.w };
  })()`);
  assert.equal(r.added.w, undefined, "a relation replaces whose");
  assert.equal(r.added.hasSub, true, "the nested who has its own whose");
  assert.equal(r.dropped, "her barber", "dropping the relation hands its whose back");
});

test("fresh who phrases are always grammatical, nest at most maxDepth, and read cleanly", () => {
  const { json } = engine();
  const r = json(`(() => {
    const out = { bad: [], depths: new Set(), rel: 0 };
    fresh("story-bits", "bit", 1, 1, 12345);
    for (let k = 1; k <= 400; k++) {
      const ph = state.pick.who = randomPhrase("who");
      let d = 0; for (let p = ph; p.sub?.r; p = p.sub.r) d++;
      out.depths.add(d);
      if (d) out.rel++;
      const t = phraseText("who");
      if (!validPhrase("who", clone(ph), 0) || / {2}|^ | $| 's|\\ba [aeiou]/i.test(t) || !/^(your|my|his|her|their|our|the|an?|someone's) /.test(t)) out.bad.push(t);
    }
    return { bad: out.bad, depths: [...out.depths].sort(), rel: out.rel };
  })()`);
  assert.deepEqual(r.bad, []);
  assert.deepEqual(r.depths, [0, 1, 2]);
  assert.ok(r.rel > 20 && r.rel < 150, `relations are occasional (${r.rel}/400)`);
});

test("links made before whose still open, reading exactly as they did", () => {
  const { json } = engine();
  for (const v of ["v1", "v2", "v3"]) {
    const r = json(`(() => {
      const snap = parseSnapshot(${JSON.stringify(OLD[v].snap)});
      if (!snap) return null;
      applySnapshot(snap);
      return { line: bitLine(context()), who: state.pick.who.w };
    })()`);
    assert.ok(r, `${v} opens`);
    assert.equal(r.line, OLD[v].text, v);
    assert.ok("w" in r.who, `${v}: the who phrase gained its whose`);
  }
  // v4: a space's fork of Story Bits from before, carried inline, keeps working as it was written.
  const r4 = json(`(() => { const ok = fromHash(${JSON.stringify(OLD.v4.link)}); return ok && { g: G.id, line: bitLine(context()) }; })()`);
  assert.deepEqual(r4, { g: "club-bits", line: OLD.v4.text });
});

test("old words in the bank and old kept phrases still fit", () => {
  const { json } = engine();
  const r = json(`(() => {
    useGrammar(GRAMMARS["story-bits"]);
    const g = GRAMMARS["story-bits"];
    return {
      oldBank: checkEntry({ g: g.id, s: "who", k: "n", t: "piano tuner", tier: 0, det: "the", pr: "she" }, g),
      newBank: checkEntry({ g: g.id, s: "who", k: "n", t: "piano tuner", tier: 0, pr: "she" }, g),
      badDet: checkEntry({ g: g.id, s: "who", k: "n", t: "piano tuner", tier: 0, det: "zz", pr: "she" }, g),
      whose: checkEntry({ g: g.id, s: "who", k: "w", t: "Gary's", tier: 1 }, g),
      relation: checkEntry({ g: g.id, s: "who", k: "r", t: "Gary's", tier: 1 }, g),
      kept: (() => { const s = [{ g: g.id, card: "who", ph: { w: { n: 7, d: 2 } }, bits: [] }]; const ok = shelfFor(s, g).length; return { ok, text: keptText("who", s[0].ph) }; })(),
    };
  })()`);
  assert.equal(r.oldBank, "");
  assert.equal(r.newBank, "");
  assert.notEqual(r.badDet, "");
  assert.equal(r.whose, "");
  assert.notEqual(r.relation, "");
  assert.deepEqual(r.kept, { ok: 1, text: "the very tall guy from the coffee shop" });
});

test("checkGrammar checks tags, determiner slots and relation slots", () => {
  const { json } = engine();
  const r = json(`(() => {
    const bad = {
      "tags not a list": (g) => { g.schemas.who.parts.find((p) => p.k === "n").pool[0].tags = "family"; },
      "empty tags": (g) => { g.schemas.who.parts.find((p) => p.k === "n").pool[0].tags = []; },
      "uppercase tag": (g) => { g.schemas.who.parts.find((p) => p.k === "n").pool[0].tags = ["Family"]; },
      "long tag": (g) => { g.schemas.who.parts.find((p) => p.k === "n").pool[0].tags = ["a".repeat(17)]; },
      "too many tags": (g) => { g.schemas.who.parts.find((p) => p.k === "n").pool[0].tags = ["a", "b", "c", "d", "e"]; },
      "repeated tag": (g) => { g.schemas.who.parts.find((p) => p.k === "n").pool[0].tags = ["a", "a"]; },
      "optional determiner": (g) => { g.schemas.who.parts.find((p) => p.k === "w").opt = true; },
      "determiner after head": (g) => { const ps = g.schemas.who.parts; ps.push(ps.splice(ps.findIndex((p) => p.k === "w"), 1)[0]); },
      "nesting determiner": (g) => { g.schemas.who.parts.find((p) => p.k === "w").pool.push({ t: "{thing}'s", tier: 0 }); },
      "required relation": (g) => { delete g.schemas.who.parts.find((p) => p.k === "r").opt; },
      "relation of another card": (g) => { g.schemas.who.parts.find((p) => p.k === "r").pool[0].t = "{thing}'s"; },
      "relation flag not true": (g) => { g.schemas.who.parts.find((p) => p.k === "r").relation = "yes"; },
    };
    const out = {};
    for (const [k, edit] of Object.entries(bad)) { const g = clone(GRAMMARS["story-bits"]); edit(g); out[k] = checkGrammar(g); }
    return { out, all: Object.values(GRAMMARS).map((g) => checkGrammar(g)) };
  })()`);
  for (const [k, v] of Object.entries(r.out)) assert.notEqual(v, "", k);
  assert.deepEqual(r.all, r.all.map(() => ""));
});

test("every built-in word has a family, and most have a neighbor in it", () => {
  const { json } = engine();
  const r = json(`(() => {
    const untagged = [], lonely = [];
    let words = 0;
    for (const g of Object.values(GRAMMARS)) for (const [card, sc] of Object.entries(g.schemas)) for (const p of sc.parts) {
      if (p.relation) continue;
      for (const w of p.pool) {
        words++;
        if (!w.tags) { untagged.push(g.id + " " + card + "." + p.k + " " + w.t); continue; }
        // A neighbor: another word in the slot, same register, sharing a tag.
        if (!p.pool.some((x) => x !== w && x.tier === w.tier && (x.tags || []).some((t) => w.tags.includes(t)))) lonely.push(g.id + " " + card + "." + p.k + " " + w.t);
      }
    }
    return { untagged, lonely, words };
  })()`);
  assert.deepEqual(r.untagged, []);
  assert.ok(r.lonely.length / r.words < 0.1, `${r.lonely.length} of ${r.words} words have no neighbor: ${r.lonely.slice(0, 10).join("; ")}`);
});

test("Story Bits people all have neighbors: same register, shared family", () => {
  const { json } = engine();
  const lonely = json(`(() => {
    const pool = GRAMMARS["story-bits"].schemas.who.parts.find((p) => p.k === "n").pool;
    return pool.filter((w) => !pool.some((x) => x !== w && x.tier === w.tier && x.tags.some((t) => w.tags.includes(t)))).map((w) => w.t);
  })()`);
  assert.deepEqual(lonely, []);
});
