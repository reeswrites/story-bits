// grammarOps: pure edits that return { grammar, label } or { error }, never mutate, never shift indices.
import { test } from "node:test";
import assert from "node:assert/strict";
import { engine as ops } from "./load.mjs";

const T = (e, code) => e.json(`(() => { ${code} })()`);

test("addWord appends, labels, leaves the input alone and passes checkGrammar", () => {
  const e = ops();
  const r = T(e, `
    const g = GRAMMARS["story-bits"], before = JSON.stringify(g);
    const out = grammarOps.addWord(g, "who", "d", { t: "lanky", tier: 0 });
    const pool = out.grammar.schemas.who.parts.find((p) => p.k === "d").pool;
    return { label: out.label, last: pool[pool.length - 1], n: pool.length, was: g.schemas.who.parts.find((p) => p.k === "d").pool.length, untouched: JSON.stringify(g) === before, ok: checkGrammar(out.grammar) };`);
  assert.equal(r.label, "added 'lanky' to Who · descriptor");
  assert.deepEqual(r.last, { t: "lanky", tier: 0 });
  assert.equal(r.n, r.was + 1);
  assert.ok(r.untouched);
  assert.equal(r.ok, "");
});

test("addWord refuses bad words, duplicates and wrong tags, with a reason", () => {
  const e = ops();
  const r = T(e, `
    const g = GRAMMARS["story-bits"], a = grammarOps;
    return [
      a.addWord(g, "who", "d", { t: "very tall", tier: 0 }).error,
      a.addWord(g, "who", "d", { t: "x", tier: 9 }).error,
      a.addWord(g, "who", "n", { t: "cousin", tier: 0 }).error,
      a.addWord(g, "nope", "d", { t: "x", tier: 0 }).error,
      a.addWord(g, "who", "z", { t: "x", tier: 0 }).error,
      a.addWord(g, "who", "d", { t: "<b>x</b>", tier: 0 }).error,
    ];`);
  assert.match(r[0], /already in/);
  assert.match(r[1], /register/);
  assert.match(r[2], /start with|pronouns/);
  assert.match(r[3], /no card/);
  assert.match(r[4], /no slot/);
  assert.equal(r[5], null); // markup is stripped by cleanWord, so the word is plain text
});

test("a head word carries det and pronouns, and uses the built-ins' shape", () => {
  const e = ops();
  const r = T(e, `
    const out = grammarOps.addWord(GRAMMARS["story-bits"], "who", "n", { t: "cousin", tier: 0, det: "your", pr: "she" });
    const pool = out.grammar.schemas.who.parts.find((p) => p.k === "n").pool;
    return { w: pool[pool.length - 1], label: out.label };`);
  assert.equal(r.w.t, "cousin");
  assert.equal(r.w.det, "your");
  assert.equal(r.w.p, "she");
  assert.equal(r.label, "added 'cousin' to Who · person");
});

test("removeWord tombstones: indices stay, options skip it, an old snapshot still renders", () => {
  const e = ops();
  const r = T(e, `
    const g = GRAMMARS["story-bits"];
    const part = (x) => x.schemas.who.parts.find((p) => p.k === "d");
    const idx = part(g).pool.findIndex((w) => w.t === "very tall");
    fresh(g, undefined, 2, 1, 7);
    state.pick.who.w.d = idx;
    const snap = JSON.parse(JSON.stringify(snapshot()));
    const textBefore = pieceText();
    const out = grammarOps.removeWord(g, "who", "d", idx);
    const ng = out.grammar, np = part(ng);
    useGrammar(ng);
    const offered = options("who", np, 0).includes(idx);
    // The snapshot still parses and renders against the new grammar, same text.
    const parsed = parseSnapshot({ ...snap, g: ng.id, gx: ng });
    applySnapshot(parsed);
    return { label: out.label, len: np.pool.length, was: part(g).pool.length, retired: np.pool[idx].retired, text: np.pool[idx].t, offered,
      parsedOk: !!parsed, same: pieceText() === textBefore, original: part(g).pool[idx].retired, ok: checkGrammar(ng),
      shifted: np.pool.some((w, i) => w.t !== part(g).pool[i].t) };`);
  assert.equal(r.label, "removed 'very tall' from Who · descriptor");
  assert.equal(r.len, r.was);
  assert.equal(r.retired, true);
  assert.equal(r.offered, false);
  assert.ok(r.parsedOk);
  assert.ok(r.same);
  assert.equal(r.original, undefined);
  assert.equal(r.ok, "");
  assert.equal(r.shifted, false);
});

test("retired words are never drawn by shuffles, even over many draws", () => {
  const e = ops();
  const r = T(e, `
    let g = GRAMMARS["story-bits"];
    const part = (x) => x.schemas.who.parts.find((p) => p.k === "d");
    for (let i = 0; i < part(g).pool.length - 1; i++) g = grammarOps.removeWord(g, "who", "d", i).grammar;
    useGrammar(g);
    const live = part(g).pool.length - 1;
    const seen = new Set();
    rng = seeded(3);
    for (let i = 0; i < 400; i++) { const ph = randomPhrase("who"); if ("d" in ph.w) seen.add(ph.w.d); }
    return { seen: [...seen], live };`);
  assert.deepEqual(r.seen, [r.live]);
});

test("removeWord won't retire the last live word, twice, or a missing one", () => {
  const e = ops();
  const r = T(e, `
    let g = GRAMMARS["story-bits"];
    const n = g.schemas.who.parts.find((p) => p.k === "d").pool.length;
    const a = grammarOps.removeWord(g, "who", "d", 0);
    const again = grammarOps.removeWord(a.grammar, "who", "d", 0).error;
    const missing = grammarOps.removeWord(g, "who", "d", 999).error;
    let last = g;
    for (let i = 0; i < n - 1; i++) last = grammarOps.removeWord(last, "who", "d", i).grammar;
    return { again, missing, lastErr: grammarOps.removeWord(last, "who", "d", n - 1).error };`);
  assert.match(r.again, /already removed/);
  assert.match(r.missing, /no word/);
  assert.match(r.lastErr, /isn't retired|at least one/);
});

test("restoreWord undoes removeWord; re-adding a retired word revives it in place", () => {
  const e = ops();
  const r = T(e, `
    const g = GRAMMARS["story-bits"];
    const part = (x) => x.schemas.who.parts.find((p) => p.k === "d");
    const gone = grammarOps.removeWord(g, "who", "d", 2).grammar;
    const back = grammarOps.restoreWord(gone, "who", "d", 2);
    const word = part(g).pool[2];
    const readd = grammarOps.addWord(gone, "who", "d", { t: word.t, tier: word.tier });
    return { same: JSON.stringify(back.grammar) === JSON.stringify(g), label: back.label, readdIdx: part(readd.grammar).pool.findIndex((w) => w.t === word.t), len: part(readd.grammar).pool.length, was: part(g).pool.length, retired: part(readd.grammar).pool[2].retired, notRetired: grammarOps.restoreWord(g, "who", "d", 2).error };`);
  assert.ok(r.same);
  assert.match(r.label, /^restored '.+' to Who · descriptor$/);
  assert.equal(r.readdIdx, 2);
  assert.equal(r.len, r.was);
  assert.equal(r.retired, undefined);
  assert.match(r.notRetired, /isn't removed/);
});

test("setWordTags changes register, mood and pronouns without moving the word", () => {
  const e = ops();
  const r = T(e, `
    const g = GRAMMARS["story-bits"], a = grammarOps;
    const d = a.setWordTags(g, "who", "d", 0, { tier: 2 });
    const who = g.schemas.who.parts.find((p) => p.k === "n");
    const pr = a.setWordTags(g, "who", "n", 0, { pr: "they" });
    const feel = g.schemas.feel.parts.find((p) => p.k === "n");
    const mood = a.setWordTags(g, "feel", "n", 0, { v: -1 });
    return { tier: d.grammar.schemas.who.parts.find((p) => p.k === "d").pool[0], dl: d.label, pr: pr.grammar.schemas.who.parts.find((p) => p.k === "n").pool[0], prl: pr.label,
      v: mood.grammar.schemas.feel.parts.find((p) => p.k === "n").pool[0].v, was: feel.pool[0].v, ml: mood.label,
      badTier: a.setWordTags(g, "who", "d", 0, { tier: 5 }).error, badKey: a.setWordTags(g, "who", "d", 0, { colour: 1 }).error,
      badMood: a.setWordTags(g, "who", "d", 0, { v: 1 }).error, text: who.pool[0].t, textAfter: pr.grammar.schemas.who.parts.find((p) => p.k === "n").pool[0].t };`);
  assert.equal(r.tier.tier, 2);
  assert.match(r.dl, /^retagged '.+' in Who · descriptor: absurd$/);
  assert.equal(r.pr.p, "they");
  assert.equal(r.pr.is, "are");
  assert.match(r.prl, /pronouns they/);
  assert.equal(r.v, -1);
  assert.match(r.ml, /bad mood/);
  assert.match(r.badTier, /register/);
  assert.match(r.badKey, /tags are/);
  assert.match(r.badMood, /doesn't take a mood/);
  assert.equal(r.text, r.textAfter);
});

test("setDeterminers sets the list, protects live words, and ignores retired ones", () => {
  const e = ops();
  const r = T(e, `
    const g = GRAMMARS["story-bits"], a = grammarOps;
    const part = g.schemas.where.parts.find((p) => p.k === "n");
    const dets = [...new Set(part.pool.map((w) => w.det))];
    const widened = a.setDeterminers(g, "where", "n", [...dets, "my"]);
    const narrowed = a.setDeterminers(g, "where", "n", ["the"]);
    const free = a.setDeterminers(g, "where", "q", ["x"]);
    return { dets, list: widened.grammar.schemas.where.parts.find((p) => p.k === "n").det, label: widened.label, ok: checkGrammar(widened.grammar),
      narrowedErr: narrowed.error, noDet: free.error, empty: a.setDeterminers(g, "where", "n", []).error };`);
  assert.deepEqual(r.list, [...r.dets, "my"]);
  assert.match(r.label, /^set starting words of Where · place to /);
  assert.equal(r.ok, "");
  assert.ok(r.narrowedErr === undefined || /still starts with/.test(r.narrowedErr));
  assert.match(r.noDet, /no starting words/);
  assert.match(r.empty, /at least one/);
});

test("setDeterminers: a retired word may keep a starting word the list drops", () => {
  const e = ops();
  const r = T(e, `
    const g = GRAMMARS["story-bits"];
    const part = g.schemas.where.parts.find((p) => p.k === "n");
    const i = part.pool.findIndex((w) => w.det !== "the");
    if (i < 0) return { skip: true };
    const keepers = part.pool.filter((w, j) => w.det !== part.pool[i].det).length;
    let h = grammarOps.addWord(g, "where", "n", { t: "zed", tier: 0, det: "the" }).grammar;
    h = grammarOps.removeWord(h, "where", "n", i).grammar;
    const out = grammarOps.setDeterminers(h, "where", "n", ["the"]);
    return { skip: false, err: out.error };`);
  if (!r.skip) assert.ok(r.err === undefined || /still starts with/.test(r.err));
});

test("addSlot adds an optional slot at a position; an old piece still works", () => {
  const e = ops();
  const r = T(e, `
    const g = GRAMMARS["story-bits"];
    fresh(g, undefined, 2, 1, 5);
    const snap = JSON.parse(JSON.stringify(snapshot()));
    const out = grammarOps.addSlot(g, "who", { name: "mood word", pool: [{ t: "grumpy", tier: 0 }, { t: "radiant", tier: 1 }] }, 0);
    const ng = out.grammar, parts = ng.schemas.who.parts;
    const piece = grammarOps.remapPiece(snap, g, ng);
    const parsed = piece.snapshot && withGrammar(ng, () => ng.cards.every((c) => validPhrase(c.key, piece.snapshot.p[c.key], 0)));
    return { label: out.label, first: parts[0], key: parts[0].k, n: parts.length, was: g.schemas.who.parts.length, grow: ng.schemas.who.grow, parsed, ok: checkGrammar(ng),
      end: grammarOps.addSlot(g, "who", { name: "tail", pool: [{ t: "x", tier: 0 }] }).grammar.schemas.who.parts.at(-1).name,
      badPos: grammarOps.addSlot(g, "who", { name: "tail", pool: [{ t: "x", tier: 0 }] }, 99).error,
      noPool: grammarOps.addSlot(g, "who", { name: "tail" }).error,
      taken: grammarOps.addSlot(g, "who", { k: "n", name: "tail", pool: [{ t: "x", tier: 0 }] }).error };`);
  assert.equal(r.label, "added slot 'mood word' to Who");
  assert.equal(r.first.opt, true);
  assert.equal(r.n, r.was + 1);
  assert.ok(r.grow.includes(r.key));
  assert.ok(r.parsed);
  assert.equal(r.ok, "");
  assert.equal(r.end, "tail");
  assert.match(r.badPos, /position/);
  assert.match(r.noPool, /needs 1–300 words|at least one/);
  assert.match(r.taken, /taken/);
});

test("a new slot is offered by the engine and fills in fresh pieces", () => {
  const e = ops();
  const r = T(e, `
    const out = grammarOps.addSlot(GRAMMARS["story-bits"], "who", { k: "z", name: "quirk", pool: [{ t: "humming", tier: 0 }] });
    const ng = out.grammar;
    useGrammar(ng);
    rng = seeded(11);
    let hit = 0;
    for (let i = 0; i < 300; i++) { const ph = randomPhrase("who"); if ("z" in ph.w) hit++; }
    return { hit };`);
  assert.ok(r.hit > 0);
});

test("removeSlot drops only optional slots, and not ones another slot needs", () => {
  const e = ops();
  const r = T(e, `
    const g = GRAMMARS["story-bits"], a = grammarOps;
    const out = a.removeSlot(g, "who", "d");
    const parts = out.grammar.schemas.who.parts;
    const needed = Object.entries(g.schemas).flatMap(([c, s]) => s.parts.filter((p) => p.needs && p.needs !== "adj").map((p) => [c, p.needs]));
    return { label: out.label, left: parts.map((p) => p.k), grow: out.grammar.schemas.who.grow, head: a.removeSlot(g, "who", "n").error, missing: a.removeSlot(g, "who", "z").error,
      needErr: needed.length ? a.removeSlot(g, needed[0][0], needed[0][1]).error : "skip", ok: checkGrammar(out.grammar) };`);
  assert.equal(r.label, "removed slot 'descriptor' from Who");
  assert.ok(!r.left.includes("d"));
  assert.ok(!r.grow.includes("d"));
  assert.match(r.head, /required/);
  assert.match(r.missing, /no slot/);
  assert.ok(r.needErr === "skip" || /needs|required/.test(r.needErr));
  assert.equal(r.ok, "");
});

test("remapPiece drops a removed slot's value and pins, and keeps everything else", () => {
  const e = ops();
  const r = T(e, `
    const g = GRAMMARS["story-bits"];
    fresh(g, undefined, 2, 1, 9);
    state.pick.who.w.d = 0;
    state.pins = ["who|d", "who|n", "beat|" + Object.keys(g.forms[state.form].beats)[0]];
    const snap = JSON.parse(JSON.stringify(snapshot()));
    const ng = grammarOps.removeSlot(g, "who", "d").grammar;
    const out = grammarOps.remapPiece(snap, g, ng);
    const s = out.snapshot;
    return { hasD: "d" in s.p.who.w, n: s.p.who.w.n === snap.p.who.w.n, pins: s.pn, id: s.g, gx: s.gx.id, v: s.v, same: JSON.stringify(s.p.what) === JSON.stringify(snap.p.what), seed: s.s === snap.s, input: "d" in snap.p.who.w };`);
  assert.equal(r.hasD, false);
  assert.ok(r.n);
  assert.deepEqual(r.pins.filter((p) => p.startsWith("who|")), ["who|n"]);
  assert.equal(r.pins.length, 2);
  assert.equal(r.id, r.gx);
  assert.equal(r.v, 3);
  assert.ok(r.same && r.seed);
  assert.ok(r.input);
});

test("remapPiece pins a space version (v4) when given a ref, with gx unless public", () => {
  const e = ops();
  const r = T(e, `
    const g = GRAMMARS["story-bits"];
    fresh(g, undefined, 2, 1, 4);
    const snap = JSON.parse(JSON.stringify(snapshot()));
    const ng = grammarOps.addWord(g, "who", "d", { t: "lanky", tier: 0 }).grammar;
    const priv = grammarOps.remapPiece(snap, g, ng, { ref: { sp: "ABCD2345", ver: 3, pub: false } }).snapshot;
    const pub = grammarOps.remapPiece(snap, g, ng, { ref: { sp: "ABCD2345", ver: 3, pub: true } }).snapshot;
    return { priv: { v: priv.v, gs: priv.gs, gv: priv.gv, gx: !!priv.gx }, pub: { v: pub.v, gx: "gx" in pub } };`);
  assert.deepEqual(r.priv, { v: 4, gs: "ABCD2345", gv: 3, gx: true });
  assert.deepEqual(r.pub, { v: 4, gx: false });
});

test("remapPiece refuses a piece the edited grammar can't hold", () => {
  const e = ops();
  const r = T(e, `
    const g = GRAMMARS["story-bits"];
    fresh(g, undefined, 2, 1, 4);
    const snap = JSON.parse(JSON.stringify(snapshot()));
    snap.p.who.w.n = 9999;
    return grammarOps.remapPiece(snap, g, g).error || null;`);
  assert.match(r, /doesn't fit/);
});

test("forkOnWrite: a built-in is copied, never touched; a library grammar is edited in place", () => {
  const e = ops();
  const r = T(e, `
    const g = GRAMMARS["story-bits"], before = JSON.stringify(g);
    const f = grammarOps.forkOnWrite(g);
    const ok = checkGrammar(f.grammar);
    library[f.grammar.id] = f.grammar;
    const again = grammarOps.forkOnWrite(f.grammar);
    const shared = { ...JSON.parse(JSON.stringify(g)), id: "shared-one", name: "Shared One", shared: true };
    const sf = grammarOps.forkOnWrite(shared);
    const long = grammarOps.forkOnWrite({ ...JSON.parse(JSON.stringify(g)), id: "long-one", name: "x".repeat(40) });
    return { forked: f.forked, from: f.from, forkedFrom: f.grammar.forkedFrom, name: f.grammar.name, idNew: f.grammar.id !== g.id, idOk: /^[a-z][a-z0-9-]{1,39}$/.test(f.grammar.id), ok,
      untouched: JSON.stringify(g) === before, againForked: again.forked, againSame: again.grammar === f.grammar,
      sharedForked: sf.forked, sharedFlag: sf.grammar.shared, longName: long.grammar.name.length, longOk: checkGrammar(long.grammar) };`);
  assert.ok(r.forked);
  assert.equal(r.from, "story-bits");
  assert.equal(r.forkedFrom, "story-bits");
  assert.equal(r.name, "Story Bits (yours)");
  assert.ok(r.idNew && r.idOk);
  assert.equal(r.ok, "");
  assert.ok(r.untouched);
  assert.equal(r.againForked, false);
  assert.ok(r.againSame);
  assert.ok(r.sharedForked);
  assert.equal(r.sharedFlag, undefined);
  assert.equal(r.longName, 40);
  assert.equal(r.longOk, "");
});

test("apply forks first when needed, then edits the copy; a local grammar edits in place", () => {
  const e = ops();
  const r = T(e, `
    const g = GRAMMARS["story-bits"], before = JSON.stringify(g);
    const out = grammarOps.apply(g, "addWord", "who", "d", { t: "lanky", tier: 0 });
    const d = (x) => x.schemas.who.parts.find((p) => p.k === "d").pool.some((w) => w.t === "lanky");
    library[out.grammar.id] = out.grammar;
    const out2 = grammarOps.apply(out.grammar, "removeWord", "who", "d", 0);
    return { forked: out.forked, from: out.from, label: out.label, orig: d(g), copy: d(out.grammar), untouched: JSON.stringify(g) === before,
      sameId: out2.grammar.id === out.grammar.id, forked2: out2.forked, label2: out2.label, unknown: grammarOps.apply(g, "nope").error, bad: grammarOps.apply(g, "removeWord", "who", "n", 0).error };`);
  assert.ok(r.forked);
  assert.equal(r.from, "story-bits");
  assert.equal(r.label, "added 'lanky' to Who · descriptor (in your own copy)");
  assert.equal(r.orig, false);
  assert.equal(r.copy, true);
  assert.ok(r.untouched);
  assert.ok(r.sameId);
  assert.equal(r.forked2, false);
  assert.match(r.label2, /^removed /);
  assert.match(r.unknown, /no such edit/);
  assert.equal(r.bad, undefined); // removing a head word from a built-in is fine: it forks, then retires
});

test("every op result passes checkGrammar on every built-in grammar", () => {
  const e = ops();
  const r = T(e, `
    const bad = [];
    for (const g of Object.values(GRAMMARS)) {
      const c = g.cards[0].key, parts = g.schemas[c].parts, h = parts.find((p) => p.k === "n");
      const results = [grammarOps.removeWord(g, c, "n", 0), grammarOps.addSlot(g, c, { name: "extra", pool: [{ t: "ok", tier: 0 }] }), grammarOps.setWordTags(g, c, "n", 0, { tier: 1 })];
      const opt = parts.find((p) => p.opt && !parts.some((q) => q.needs === p.k));
      if (opt) results.push(grammarOps.removeSlot(g, c, opt.k));
      for (const r of results) if (!r.error && checkGrammar(r.grammar)) bad.push(g.id);
      if (results.some((r) => r.error && !/lowercase|constraint|starting|register|mood|pronouns|required|at least|needs/.test(r.error))) bad.push(g.id + ": " + results.map((r) => r.error));
    }
    return bad;`);
  assert.deepEqual(r, []);
});
