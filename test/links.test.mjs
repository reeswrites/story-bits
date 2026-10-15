// Links: v1–v4 snapshots round-trip, bad ones are rejected; challenges, copies and the daily bit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { engine } from "./load.mjs";

// Make a piece in one engine, then read its link in another that has never seen its grammar.
function roundTrip(make, prepare = "") {
  const a = engine();
  const made = a.json(`(() => { ${make}; return { link: b64(JSON.stringify(snapshot())), snap: snapshot(), text: pieceText() }; })()`);
  const b = engine();
  b.run(prepare);
  const read = b.json(`(() => {
    const snap = parseSnapshot(JSON.parse(unb64(${JSON.stringify(made.link)})));
    if (!snap) return null;
    applySnapshot(snap);
    return { snap: snapshot(), text: pieceText(), grammar: G.id };
  })()`);
  return { made, read };
}

test("v1 links (Story Bits, no form, no beats) still open", () => {
  const v1 = engine().json(`(() => { fresh("story-bits", "bit", 3, 1, 5); const s = snapshot(); return { p: s.p, d: s.d, s: s.s, l: s.l, pn: [] }; })()`);
  const r = engine().json(`(() => { applySnapshot(parseSnapshot(${JSON.stringify(v1)})); return { snap: snapshot(), g: G.id }; })()`);
  assert.equal(r.g, "story-bits");
  assert.equal(r.snap.f, "bit");
  assert.equal(r.snap.v, 3);
  assert.equal(r.snap.gx, undefined);
  assert.deepEqual(r.snap.p, v1.p);
  assert.deepEqual(r.snap.b, {});
});

test("v2 links (form and tuned beats, no grammar) round-trip", () => {
  const v2 = engine().json(`(() => {
    fresh("story-bits", "news", 4, 2, 9);
    state.beats = beatChoices(context());
    state.pins = ["who|n"];
    const s = snapshot(); delete s.v; delete s.g; return s;
  })()`);
  const r = engine().json(`(() => { applySnapshot(parseSnapshot(${JSON.stringify(v2)})); return snapshot(); })()`);
  assert.equal(r.v, 3);
  assert.equal(r.g, "story-bits");
  delete r.v; delete r.g;
  assert.deepEqual(r, v2);
});

test("v3 links round-trip for every built-in grammar", () => {
  for (const id of engine().json(`Object.keys(GRAMMARS)`)) {
    const { made, read } = roundTrip(`fresh(${JSON.stringify(id)}, undefined, 3, 2, 4); state.beats = { [stanza().paras.flat()[0]]: 0 }`);
    assert.equal(made.snap.v, 3);
    assert.equal(made.snap.gx, undefined, "built-ins travel by id");
    assert.deepEqual(read.snap, made.snap);
    assert.equal(read.text, made.text);
  }
});

test("v3 links carry a custom grammar inline, and only a valid one", () => {
  const make = `
    const g = clone(GRAMMARS["small-poems"]);
    g.id = "my-poems"; g.name = "My \\"poems\\"";
    g.schemas.image.parts.find((p) => p.k === "n").pool.push({ t: "a lantern & a kite", tier: 2 });
    library[g.id] = g;
    fresh(g, "refrain", 2, 2, 3)`;
  const { made, read } = roundTrip(make);
  assert.equal(made.snap.v, 3);
  assert.equal(made.snap.gx.id, "my-poems");
  assert.deepEqual(read.snap, made.snap);
  assert.equal(read.text, made.text);
  assert.equal(read.grammar, "my-poems");

  // A tampered grammar, or one with markup, doesn't open.
  const b = engine();
  const tamper = (edit) => b.json(`(() => { const x = ${JSON.stringify(made.snap)}; ${edit}; return parseSnapshot(x); })()`);
  assert.equal(tamper(`x.gx.name = "<b>mine</b>"`), null);
  assert.equal(tamper(`x.gx.cards[0].label = "<img src=x onerror=alert(1)>"`), null);
  assert.equal(tamper(`x.gx.rules.constraints = [{ type: "maxSyllables", n: "\\" autofocus x=\\"" }]`), null);
  assert.equal(tamper(`x.gx.maxDepth = 9`), null);
  assert.equal(tamper(`x.gx.id = "other-id"`), null);
  assert.equal(tamper(`delete x.gx`), null);

  // A link can't redefine a built-in grammar by carrying it inline.
  const builtin = b.json(`(() => {
    fresh("story-bits", "bit", 2, 1, 1);
    const x = snapshot();
    x.gx = clone(GRAMMARS["story-bits"]); x.gx.name = "Not Story Bits";
    return parseSnapshot(x).gram === GRAMMARS["story-bits"];
  })()`);
  assert.equal(builtin, true);
});

test("v4 links pin a space grammar's version", () => {
  const version = (pub) => `{ const g = clone(GRAMMARS["small-poems"]); g.id = "club-poems"; g.name = "Club poems"; addVersion("ABCD2345", 3, g, ${pub}); }`;
  const make = (pub) => `${version(pub)}; fresh(knownVersion({ gs: "ABCD2345", gv: 3 }, "club-poems"), "couplets", 2, 1, 8)`;

  // A private space's piece carries the grammar inline, so it opens anywhere and keeps its pin.
  const { made, read } = roundTrip(make(false));
  assert.equal(made.snap.v, 4);
  assert.equal(made.snap.gs, "ABCD2345");
  assert.equal(made.snap.gv, 3);
  assert.equal(made.snap.gx.id, "club-poems");
  assert.deepEqual(read.snap, made.snap);
  assert.equal(read.text, made.text);

  // A public space's piece leaves the grammar out: it opens once that version is known.
  const pub = roundTrip(make(true));
  assert.equal(pub.made.snap.gx, undefined);
  assert.equal(pub.read, null, "unknown version and no inline grammar: doesn't open");
  const known = roundTrip(make(true), version(true));
  assert.deepEqual(known.read.snap, known.made.snap);
  assert.equal(known.read.text, known.made.text);

  // Malformed references aren't v4; a space grammar can't take a built-in's id.
  const r = engine().json(`({
    refs: [{ gs: "abcd2345", gv: 1 }, { gs: "ABCD2345", gv: 0 }, { gs: "ABCD2345", gv: 1001 }, { gs: "ABCD234", gv: 1 }, { gs: "ABCD2345", gv: 1.5 }].map(refOf),
    good: refOf({ gs: "ABCD2345", gv: 7 }),
    builtin: addVersion("ABCD2345", 1, clone(GRAMMARS["story-bits"]), true),
  })`);
  assert.deepEqual(r.refs, [null, null, null, null, null]);
  assert.deepEqual(r.good, { gs: "ABCD2345", gv: 7 });
  assert.equal(r.builtin, null);
});

test("snapshots that don't fit their grammar are rejected", () => {
  const r = engine().json(`(() => {
    fresh("story-bits", "bit", 2, 1, 2);
    const ok = snapshot();
    const who = (w) => ({ ...ok, p: { ...ok.p, who: { w: { ...ok.p.who.w, ...w } } } });
    const tries = {
      dial: { ...ok, d: 3 },
      len0: { ...ok, l: 0 },
      lenBig: { ...ok, l: 99 },
      seed: { ...ok, s: "x" },
      form: { ...ok, f: "nope" },
      grammar: { ...ok, g: "nope" },
      index: who({ n: 99999 }),
      slot: who({ zz: 0 }),
      markup: who({ n: { c: "<b>x</b>", tier: 0, pr: "they" } }),
      card: { ...ok, p: { ...ok.p, who: undefined } },
      nothing: null,
    };
    // Junk beats and pins are dropped, not fatal.
    const lenient = parseSnapshot({ ...ok, b: { nope: 1, [Object.keys(form().beats)[0]]: -1 }, pn: [1, "who|n"] });
    return {
      ok: !!parseSnapshot(ok),
      out: Object.fromEntries(Object.entries(tries).map(([k, x]) => [k, parseSnapshot(x)])),
      beats: lenient.b, pins: lenient.pn,
      hash: fromHash("not base64!"),
    };
  })()`);
  assert.equal(r.ok, true);
  for (const [k, v] of Object.entries(r.out)) assert.equal(v, null, k);
  assert.deepEqual(r.beats, {});
  assert.deepEqual(r.pins, ["who|n"]);
  assert.equal(r.hash, false);
});

test("challenges, copies, moves and pasted links", () => {
  const r = engine().json(`(() => {
    fresh("story-bits", "toast", 3, 1, 12);
    const c = { h: "Sam <3", n: 2, s: fixedSnapshot() };
    const parsed = parseChallenge(JSON.parse(JSON.stringify(c)));
    // Tune one beat: one move.
    const key = stanza().paras.flat()[0];
    state.beats = { ...c.s.b, [key]: (c.s.b[key] + 1) % beatLines(key, context()).length };
    const me = fixedSnapshot();
    const copy = { c, me, name: "Jo" };
    const chat = "lol look #s=" + b64(JSON.stringify(copy)) + " and #s=garbage and #p=" + b64(JSON.stringify({ ...copy, name: "Al" }));
    return {
      name: parsed.h, n: parsed.n,
      moves: changes(parsed.s, parseSnapshot(me)),
      none: changes(parsed.s, parsed.s),
      copies: linksIn(chat).map((x) => x.name),
      badN: parseChallenge({ ...c, n: 10 }),
      otherForm: parseCopy({ c, me: { ...me, f: "bit", l: 1 }, name: "x" }),
      sameId: challengeId(c) === challengeId(JSON.parse(JSON.stringify(c))),
    };
  })()`);
  assert.equal(r.name, "Sam 3");
  assert.equal(r.n, 2);
  assert.deepEqual(r.moves.filter((m) => m.startsWith("beat|")).length, 1);
  assert.deepEqual(r.none, []);
  assert.deepEqual(r.copies, ["Jo", "Al"]);
  assert.equal(r.badN, null);
  assert.equal(r.otherForm, null);
  assert.equal(r.sameId, true);
});

test("today's bit is the same for everyone and doesn't disturb the piece in progress", () => {
  const a = engine(), b = engine();
  const day = `dailyChallenge(new Date("2026-10-15T08:00:00Z"))`;
  const x = a.json(day);
  a.run(`fresh("small-poems", "refrain", 2, 2, 1)`);
  const before = a.json(`snapshot()`);
  assert.deepEqual(a.json(day), x);
  assert.deepEqual(a.json(`snapshot()`), before);
  assert.deepEqual(b.json(day), x);
  assert.equal(x.d, 1);
  assert.equal(x.n, 3);
  assert.equal(b.json(`!!parseChallenge(${day})`), true);
  assert.notDeepEqual(b.json(`dailyChallenge(new Date("2026-10-16T08:00:00Z"))`).s, x.s);
});
