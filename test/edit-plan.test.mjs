// The picker's "Change the grammar here": who sees it, what it offers for a word, the add form's
// checks, and the edits it makes carried through to the open piece (edit-plan.js, grammar-ops.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { engine } from "./load.mjs";

test("the section shows solo and to jam editors, never in a challenge or workshop", () => {
  const { json } = engine();
  const r = json(`[
    editBlocked({}),
    editBlocked({ game: true }),
    editBlocked({ room: { mode: "together", role: "edit" } }),
    editBlocked({ room: { mode: "together", role: "comment" } }),
    editBlocked({ room: { mode: "together", role: "view" } }),
    editBlocked({ room: { mode: "workshop", role: "edit" } }),
    editBlocked({ room: { role: "edit" } }),
  ]`);
  assert.deepEqual(r, ["", "challenge", "", "role", "role", "workshop", "workshop"]);
});

test("slotEdit describes the slot, the word, retiring and the card's optional slots", () => {
  const { json } = engine();
  const r = json(`(() => {
    const g = GRAMMARS["story-bits"];
    const pool = g.schemas.who.parts.find((p) => p.k === "n").pool;
    const uncle = pool.findIndex((w) => w.t === "uncle");
    const head = slotEdit(g, "who", "n", uncle, { head: "uncle", phrase: "your uncle" });
    const desc = slotEdit(g, "who", "d", 0, { head: "uncle" });
    const own = slotEdit(g, "who", "d", { c: "mine", tier: 1 }, {});
    const what = slotEdit(g, "what", "n", 0, {});
    const where = slotEdit(g, "where", "n", 0, {});
    return { head, desc: { where: desc.where, needs: desc.needs, word: desc.word }, own: own.word, whatNeeds: what.needs, whereDets: where.dets, whereDet: where.word.det };
  })()`);
  assert.equal(r.head.where, "Who · person");
  assert.deepEqual(r.head.needs, { mood: false, det: null, pronouns: true });
  assert.equal(r.head.word.t, "uncle");
  assert.equal(r.head.word.pr, "he");
  assert.deepEqual(r.head.word.tags, ["family"]);
  assert.equal(r.head.retireWhy, "");
  assert.deepEqual(r.head.retired, []);
  assert.deepEqual(r.head.slots, [{ k: "r", name: "relation", here: false, why: "" }, { k: "d", name: "descriptor", here: false, why: "" }]);
  // A describing slot already sits before the head, and Who has its relation: a detail can go in.
  assert.deepEqual(r.head.offers.map((o) => o.key), ["detail"]);
  assert.equal(r.desc.where, "Who · descriptor");
  assert.deepEqual(r.desc.needs, { mood: false, det: null, pronouns: false });
  assert.equal(r.desc.word.v, undefined);
  assert.equal(r.own, null, "your own words live in the bank, not the grammar");
  assert.equal(r.whatNeeds.mood, true);
  assert.ok(r.whereDets.includes(r.whereDet));
});

test("the last live word can't be retired; retired words are listed to bring back", () => {
  const { json } = engine();
  const r = json(`(() => {
    const g = clone(GRAMMARS["story-bits"]);
    const d = g.schemas.who.parts.find((p) => p.k === "d");
    d.pool = d.pool.slice(0, 2);
    const one = grammarOps.removeWord(g, "who", "d", 0).grammar;
    return { left: slotEdit(one, "who", "d", 1, {}), gone: slotEdit(one, "who", "d", 0, {}) };
  })()`);
  assert.match(r.left.retireWhy, /only word left/);
  assert.equal(r.gone.word.retired, true);
  assert.equal(r.gone.retireWhy, "already retired");
  assert.deepEqual(r.left.retired.map((x) => x.i), [0]);
});

test("the add form keeps only what the slot takes, with the word bank's checks", () => {
  const { json } = engine();
  const r = json(`(() => {
    const g = GRAMMARS["story-bits"];
    const dets = g.schemas.where.parts.find((p) => p.k === "n").det;
    const desc = wordEntry(g, "who", "d", { t: " freshly waxed. ", tier: "1", v: 1, det: "your", pr: "he" });
    const head = wordEntry(g, "who", "n", { t: "dentist's twin", tier: 2, det: "the", pr: "she" });
    const place = wordEntry(g, "where", "n", { t: "laundromat", tier: 0, det: dets[dets.length - 1] });
    const odd = wordEntry(g, "where", "n", { t: "laundromat", det: "nonsense" });
    const ev = wordEntry(g, "what", "n", { t: "got lost", tier: 0, v: "-1" });
    const lipo = { ...clone(g), id: "lipo", rules: { ...g.rules, constraints: [{ type: "lipogram", letters: "e" }] } };
    return {
      desc, head, ev, place, dets, odd,
      ok: addCheck(g, desc), dup: addCheck(g, wordEntry(g, "who", "n", { t: "Uncle" })), empty: addCheck(g, wordEntry(g, "who", "d", {})),
      lipo: addCheck(lipo, wordEntry(lipo, "who", "d", { t: "eerie" })),
      rel: addCheck(g, wordEntry(g, "who", "r", { t: "boss" })),
      revive: addCheck(grammarOps.removeWord(g, "who", "d", 0).grammar, wordEntry(g, "who", "d", { t: g.schemas.who.parts.find((p) => p.k === "d").pool[0].t })),
    };
  })()`);
  assert.deepEqual(r.desc, { s: "who", k: "d", t: "freshly waxed", tier: 1 });
  assert.deepEqual(r.head, { s: "who", k: "n", t: "dentist's twin", tier: 2, pr: "she" });
  assert.equal(r.place.det, r.dets[r.dets.length - 1]);
  assert.equal(r.odd.det, r.dets[0], "a starting word the slot doesn't have falls back to its first");
  assert.equal(r.ev.v, -1);
  assert.deepEqual(r.ok, { error: "", note: "" });
  assert.match(r.dup.error, /already in Who · person/);
  assert.deepEqual(r.empty, { error: "", note: "" });
  assert.match(r.lipo.error, /constraints/);
  assert.ok(r.rel.error, "a relation slot takes no words of your own");
  assert.match(r.revive.note, /brings back/);
});

test("added slots: a describing word, a detail, and a relation that nests the card", () => {
  const { json } = engine();
  const r = json(`(() => {
    // Just-so's rival is a bare head with a starting word and a clause: room for a describing
    // word and a relation, not a detail (the clause is already there).
    fresh("just-so", undefined, 2, 1, 3);
    const offers = slotOffers(G, "rival", { head: "x", phrase: "the moon" }).map((o) => o.key);
    const prompt = slotOffers(GRAMMARS.hinge, "prompt", { head: "x" }).map((o) => o.key);
    const pool = SCHEMAS.rival.parts.find((p) => p.k === "n").pool;
    state.pick.rival = { w: { n: 0 } };
    const before = phraseText("rival");
    const o = slotOffers(G, "rival", { head: pool[0].t, phrase: before });
    const rel = o.find((x) => x.key === "relation"), desc = o.find((x) => x.key === "describe");
    let g = grammarOps.addSlot(G, "rival", rel.def, rel.position).grammar;
    const at = g.schemas.rival.parts.findIndex((p) => p.k === "n");
    g = grammarOps.addSlot(g, "rival", { ...desc.def, pool: [{ t: "ugly", tier: 1 }] }, at).grammar;
    useGrammar(g);
    const unchanged = phraseText("rival");
    const r = SCHEMAS.rival.parts.find((p) => p.relation).k;
    const d = SCHEMAS.rival.parts.find((p) => p.name === "describing word").k;
    const nestedPh = { w: { [r]: 0, [d]: 0, n: 1 }, sub: { [r]: { w: { n: 0 } } } };
    state.pick.rival = nestedPh;
    const nested = phraseText("rival");
    state.pick.rival = { w: { n: 0 } };
    const zoom = moveCandidates("rival", ["n"], "zoom").filter((c) => c.changed.includes(r)).length;
    return { offers, prompt, before, unchanged, nested, inner: before, valid: validPhrase("rival", nestedPh, 0), zoom, again: slotOffers(g, "rival", { head: "x" }).map((x) => x.key), parts: SCHEMAS.rival.parts.map((p) => p.name) };
  })()`);
  assert.deepEqual(r.offers, ["describe", "relation"]);
  assert.deepEqual(r.prompt, ["describe", "detail"], "no starting word: no relation");
  assert.equal(r.unchanged, r.before, "an optional slot changes nothing until it's used");
  assert.ok(r.nested.startsWith(r.inner + "'s ugly "), r.nested);
  assert.ok(r.valid);
  assert.ok(r.zoom > 0, "zoom out offers the relation");
  assert.deepEqual(r.again, [], "nothing more to add around the head");
  assert.deepEqual(r.parts.slice(0, 3), ["relation", "describing word", r.parts[2]]);
});

test("a fork and its edit are one step; the piece reads the same on the copy", () => {
  const { json } = engine();
  const r = json(`(() => {
    fresh("story-bits", undefined, 2, 1, 5);
    const text = pieceText();
    const snap = clone(snapshot());
    const f = grammarOps.forkOnWrite(G, { library: {}, rand: () => 0.5 });
    const e = grammarOps.addWord(f.grammar, "who", "d", wordEntry(f.grammar, "who", "d", { t: "freshly waxed", tier: 1 }));
    const m = grammarOps.remapPiece(snap, G, e.grammar, { lv: 2 });
    library = { [e.grammar.id]: e.grammar };
    const parsed = parseSnapshot(m.snapshot);
    applySnapshot(parsed);
    const after = pieceText();
    // The timeline: two saves become one step.
    const t = makeTimeline();
    const a = tlRecord(t, { kind: "grammar", id: e.grammar.id, before: null, after: 1, label: f.label });
    const b = tlRecord(t, { kind: "grammar", id: e.grammar.id, before: 1, after: 2, label: e.label });
    const one = mergeSteps(t, [a, b], e.label + " (in your own copy)");
    return { text, after, name: G.name, id: G.id, forkedFrom: G.forkedFrom, lv: m.snapshot.lv, steps: t.done.length, one: { before: one.before, after: one.after, label: one.label },
      again: grammarOps.forkOnWrite({ ...G, name: "Story Bits (yours)" }, { library: {} }).grammar.name };
  })()`);
  assert.equal(r.after, r.text);
  assert.equal(r.name, "Story Bits (yours)");
  assert.equal(r.forkedFrom, "story-bits");
  assert.equal(r.lv, 2);
  assert.equal(r.steps, 1);
  assert.deepEqual(r.one, { before: null, after: 2, label: "added 'freshly waxed' to Who · descriptor (in your own copy)" });
  assert.equal(r.again, "Story Bits (yours)", "a copy of a copy keeps its name");
});

test("kin grammars: versions and copies of each other", () => {
  const { json } = engine();
  const r = json(`(() => {
    const g = GRAMMARS["story-bits"];
    const f = grammarOps.forkOnWrite(g, { library: {} }).grammar;
    const ff = grammarOps.forkOnWrite(f, { library: {} }).grammar;
    return [kinGrammars(g, clone(g)), kinGrammars(g, f), kinGrammars(f, g), kinGrammars(f, ff), kinGrammars(g, GRAMMARS.hinge), kinGrammars(g, null)];
  })()`);
  assert.deepEqual(r, [true, true, true, true, false, false]);
});

test("removing a slot drops its words from the piece and nothing else", () => {
  const { json } = engine();
  const r = json(`(() => {
    fresh("story-bits", undefined, 2, 1, 7);
    state.pick.what = { w: { a: 0, n: 3, t: 1 } };
    const snap = clone(snapshot());
    const g = grammarOps.removeSlot(G, "what", "a").grammar;
    const m = grammarOps.remapPiece(snap, G, g);
    return { w: m.snapshot.p.what.w, who: same(m.snapshot.p.who, snap.p.who), why: removeSlotWhy(G, "feel", "i"), head: removeSlotWhy(G, "what", "n") };
  })()`);
  assert.deepEqual(r.w, { n: 3, t: 1 });
  assert.ok(r.who);
  assert.equal(r.why, "");
  assert.match(r.head, /required/);
});

test("free tags on words: added, retagged, cleared; the bank follows a fork", () => {
  const { json } = engine();
  const r = json(`(() => {
    const g = GRAMMARS["story-bits"];
    const added = grammarOps.addWord(g, "who", "n", { t: "step-uncle Gary", tier: 0, pr: "he", tags: ["Family", "family", " in laws "] });
    const pool = (x) => x.grammar.schemas.who.parts.find((p) => p.k === "n").pool;
    const w = pool(added).length - 1;
    const re = grammarOps.setWordTags(added.grammar, "who", "n", w, { tags: ["work"] });
    const cleared = grammarOps.setWordTags(re.grammar, "who", "n", w, { tags: [] });
    const it = grammarOps.setWordTags(added.grammar, "who", "n", w, { pr: "it" });
    const kept = grammarOps.setWordTags(re.grammar, "who", "n", w, { tier: 2 });
    // A bank word for Story Bits shows up in your copy of it.
    const f = grammarOps.forkOnWrite(g, { library: {} }).grammar;
    bank = [{ g: "story-bits", s: "who", k: "d", t: "freshly laminated", tier: 1 }];
    useGrammar(f);
    const offered = options("who", f.schemas.who.parts.find((p) => p.k === "d"), 0).some((v) => v.c === "freshly laminated");
    bank = [];
    return { tags: pool(added)[w].tags, re: pool(re)[w].tags, rl: re.label, cleared: pool(cleared)[w].tags, cl: cleared.label, it: pool(it)[w].p, kept: pool(kept)[w].tags, offered,
      bad: grammarOps.setWordTags(g, "who", "n", 0, { tags: "family" }).error,
      many: grammarOps.setWordTags(g, "who", "n", 0, { tags: ["a", "b", "c", "d", "e"] }).error };
  })()`);
  assert.deepEqual(r.tags, ["family", "in-laws"]);
  assert.deepEqual(r.re, ["work"]);
  assert.match(r.rl, /tags work/);
  assert.equal(r.cleared, undefined);
  assert.match(r.cl, /no tags/);
  assert.equal(r.it, "it", "it/its pronouns survive a retag");
  assert.deepEqual(r.kept, ["work"], "retagging the register keeps the free tags");
  assert.ok(r.offered);
  assert.match(r.bad, /list/);
  assert.match(r.many, /up to 4/);
});

test("offers are offered in every built-in grammar, and each one checks", () => {
  const { json } = engine();
  const problems = json(`(() => {
    const out = [];
    for (const g of Object.values(GRAMMARS)) for (const c of g.cards) for (const o of slotOffers(g, c.key, { head: "x" })) {
      const def = o.needsWord ? { ...o.def, pool: [{ t: "new", tier: 1 }] } : o.def;
      const r = grammarOps.addSlot(g, c.key, def, o.position);
      if (r.error) out.push(g.id + "/" + c.key + "/" + o.key + ": " + r.error);
    }
    return out;
  })()`);
  assert.deepEqual(problems, []);
});
