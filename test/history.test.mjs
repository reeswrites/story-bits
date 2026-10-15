// History (timeline.js): the undo timeline, local grammar versions and how pieces pin them,
// compact version storage, drafts, and the plain labels on every step.
import { test } from "node:test";
import assert from "node:assert/strict";
import { engine } from "./load.mjs";

test("the timeline undoes and redoes in order; a new step clears redo", () => {
  const { json } = engine();
  const r = json(`(() => {
    const t = makeTimeline(3);
    const log = [];
    const apply = (e, back) => { log.push((back ? "undo " : "redo ") + e.label); };
    for (const l of ["a", "b", "c", "d"]) tlRecord(t, { kind: "x", label: l });
    const capped = t.done.map((e) => e.label);
    tlUndo(t, apply); tlUndo(t, apply);
    const rows = tlRows(t).map((r) => [r.e.label, r.undone, r.n]);
    tlRedo(t, apply);
    tlRecord(t, { kind: "x", label: "e" });
    return { capped, log, rows, done: t.done.map((e) => e.label), undone: t.undone.length, empty: tlUndo(makeTimeline(), apply) };
  })()`);
  assert.deepEqual(r.capped, ["b", "c", "d"], "keeps at most max steps");
  assert.deepEqual(r.log, ["undo d", "undo c", "redo c"]);
  // Newest first: what you undid (redo-able) above, then what's done; n is how far to travel.
  assert.deepEqual(r.rows, [["d", true, 2], ["c", true, 1], ["b", false, -1]]);
  assert.deepEqual(r.done, ["b", "c", "e"]);
  assert.equal(r.undone, 0, "a new step clears what could be redone");
  assert.equal(r.empty, null);
});

test("a step that can't be applied stays where it was; dropping removes from both sides", () => {
  const { json } = engine();
  const r = json(`(() => {
    const t = makeTimeline();
    tlRecord(t, { kind: "piece", label: "p1" });
    tlRecord(t, { kind: "bank", label: "b1" });
    tlRecord(t, { kind: "piece", label: "p2" });
    const refused = tlUndo(t, () => false);
    const kept = t.done.length;
    tlUndo(t, () => {});
    tlDrop(t, (e) => e.kind === "piece");
    return { refused, kept, done: t.done.map((e) => e.label), undone: t.undone.map((e) => e.label) };
  })()`);
  assert.equal(r.refused, null);
  assert.equal(r.kept, 3);
  assert.deepEqual(r.done, ["b1"], "a jam's piece steps leave; the word bank's stay");
  assert.deepEqual(r.undone, []);
});

test("versions: every save is a version, restore adds one, pruning keeps current and pinned", () => {
  const { json } = engine();
  const r = json(`(() => {
    const s = verInit({ id: "g", x: 0 }, "first", 1);
    for (let i = 1; i <= 5; i++) verPush(s, { id: "g", x: i }, "edit " + i, 1 + i);
    const afterPush = [s.cur, s.list.length];
    s.cur = 2; // undo moved back to v2
    const r1 = verRestore(s, 1, 9);
    const restored = [r1.n, r1.label, s.cur, same(r1.doc, verGet(s, 1).doc), r1.doc !== verGet(s, 1).doc];
    verPrune(s, 3, [2]);
    const kept = s.list.map((v) => v.n);
    s.cur = 6;
    const steps = [verStep(s, 6, -1), verStep(s, 6, 1), verStep(s, 7, 1), verStep(s, 2, -1)];
    return { afterPush, restored, kept, steps };
  })()`);
  assert.deepEqual(r.afterPush, [6, 6]);
  assert.deepEqual(r.restored, [7, "restored v1", 7, true, true], "restoring saves a copy as the newest version");
  assert.deepEqual(r.kept, [2, 6, 7], "oldest go first; v2 is pinned, v7 is current");
  assert.deepEqual(r.steps, [2, 7, null, null]);
});

test("versions are stored as deltas and read back whole", () => {
  const { json } = engine();
  const r = json(`(() => {
    const a = clone(GRAMMARS["story-bits"]); a.id = "mine";
    const s = verInit(a, "forked", 1);
    const b = clone(a); b.schemas.who.parts[0].pool.push({ t: "ugly", tier: 1 }); verPush(s, b, "added ugly", 2);
    const c = clone(b); c.rules.constraints = [{ type: "lipogram", letters: "e" }]; delete c.headline; verPush(s, c, "lipogram", 3);
    const d = clone(c); d.forms.extra = clone(d.forms.bit); d.name = "Mine"; verPush(s, d, "a form", 4);
    s.cur = 3;
    const packed = packVersions(s);
    const text = JSON.stringify(packed);
    const back = unpackVersions(JSON.parse(text));
    return {
      whole: JSON.stringify(a).length, size: text.length, firstWhole: !!packed.list[0].doc, laterDelta: packed.list.slice(1).every((x) => x.d && !x.doc),
      same: back.list.every((v, i) => same(v.doc, s.list[i].doc)), cur: back.cur, labels: back.list.map((v) => v.label),
      bad: [unpackVersions(null), unpackVersions({ list: [] }), unpackVersions({ list: [{ n: 1, d: { set: {} } }] })],
    };
  })()`);
  assert.ok(r.firstWhole && r.laterDelta);
  assert.ok(r.same, "every version reads back exactly");
  assert.equal(r.cur, 3);
  assert.deepEqual(r.labels, ["forked", "added ugly", "lipogram", "a form"]);
  assert.ok(r.size < r.whole * 1.6, `four versions take ${r.size} bytes, one whole grammar ${r.whole}`);
  assert.deepEqual(r.bad, [null, null, null]);
});

test("a piece pins its local grammar version and keeps working after the grammar changes", () => {
  const { json } = engine();
  const r = json(`(() => {
    // Your fork, v1, with a piece made in it.
    const v1 = clone(GRAMMARS["story-bits"]); v1.id = "mine-abcd"; v1.name = "Mine";
    library[v1.id] = setLocalVersion(v1, v1.id, 1);
    fresh(v1, "bit", 2, 1, 7);
    const snap = clone(snapshot());
    // v2 drops every person but one, so the piece no longer fits the current version.
    const v2 = clone(v1);
    const people = v2.schemas.who.parts.find((p) => p.k === "n");
    const used = snap.p.who.w.n;
    people.pool = [people.pool.find((_, i) => i !== used)];
    library[v1.id] = setLocalVersion(v2, v1.id, 2);
    const pinned = parseSnapshot(snap);
    // Another browser: no versions, nothing in the library; the link carries the grammar.
    delete library[v1.id];
    const elsewhere = parseSnapshot({ ...snap, lv: 9 });
    // This browser, the pinned version pruned: the link's own copy still fits.
    library[v1.id] = v2;
    const pruned = parseSnapshot({ ...snap, lv: 1, gx: v1 });
    delete localDocs[v1.id + "@1"];
    const pruned2 = parseSnapshot({ ...snap, gx: clone(v1) });
    return {
      lv: snap.lv, hasGx: !!snap.gx, pinned: pinned && localVer.get(pinned.gram).n,
      underV2: !!snapshotUnder(snap, v2), underV1: !!snapshotUnder(snap, v1),
      elsewhere: !!elsewhere && elsewhere.gram.id, pruned2: !!pruned2,
      builtinNoLv: (() => { fresh("story-bits"); return snapshot().lv; })(),
    };
  })()`);
  assert.equal(r.lv, 1);
  assert.ok(r.hasGx, "links still carry the grammar inline");
  assert.equal(r.pinned, 1, "this browser opens it with v1");
  assert.equal(r.underV2, false);
  assert.equal(r.underV1, true);
  assert.equal(r.elsewhere, "mine-abcd");
  assert.ok(r.pruned2, "falls back to the grammar in the link");
  assert.equal(r.builtinNoLv, undefined);
});

test("drafts: newest first, capped, named", () => {
  const { json } = engine();
  const r = json(`(() => {
    let list = [];
    for (let i = 0; i < 35; i++) list = draftsAdd(list, { id: "d" + i, name: draftName(list) });
    const again = draftsAdd(list, { id: "d34", name: "renamed" });
    return { n: list.length, first: list[0].id, last: list[list.length - 1].id, again: [again.length, again[0].name], name: draftName([{ name: "Draft 2" }]) };
  })()`);
  assert.equal(r.n, 30);
  assert.equal(r.first, "d34");
  assert.equal(r.last, "d5");
  assert.deepEqual(r.again, [30, "renamed"]);
  assert.equal(r.name, "Draft 3");
});

test("each step gets a plain label", () => {
  const { json } = engine();
  const r = json(`(() => {
    fresh("story-bits", "bit", 2, 1, 3);
    const at = () => ({ G, pick: clone(state.pick), beats: { ...state.beats }, form: state.form, len: state.len, dial: state.dial, seed: state.seed });
    const out = {};
    let a = at();
    // One word: swap the person.
    const who = state.pick.who;
    const people = SCHEMAS.who.parts.find((p) => p.k === "n").pool;
    const next = (who.w.n + 1) % people.length;
    state.pick.who = { ...clone(who), w: { ...who.w, n: next } };
    out.swap = pieceLabel(a, at());
    // Add, then remove, the optional descriptor.
    a = at();
    const w = clone(state.pick.who); delete w.w.d; state.pick.who = w;
    const noD = at();
    state.pick.who = { ...clone(w), w: { d: 0, ...w.w } };
    out.add = pieceLabel(noD, at());
    out.remove = pieceLabel(at(), noD);
    a = at(); rerollPick(["what"]); out.reroll = pieceLabel(a, at());
    a = at(); rerollPick(SLOTS.map((c) => c.key)); out.shuffle = pieceLabel(a, at());
    a = at(); state.form = "news"; out.form = pieceLabel(a, at());
    a = at(); state.dial = 2; out.dial = pieceLabel(a, at());
    a = at(); state.len = 1; out.len = pieceLabel(a, at());
    a = at(); state.seed++; out.retell = pieceLabel(a, at());
    a = at(); const k = Object.keys(FORMS.news.beats)[0]; state.beats = { [k]: 0 }; out.beat = pieceLabel(a, at());
    a = at(); useGrammar(GRAMMARS["small-poems"]); out.switch = pieceLabel(a, { ...at(), G });
    useGrammar(GRAMMARS["story-bits"]);
    out.bank = bankLabel({ g: "story-bits", s: "who", k: "d", t: "ugly", tier: 1 }, true);
    out.unbank = bankLabel({ g: "story-bits", s: "who", k: "d", t: "ugly", tier: 1 }, false);
    out.people = [people[who.w.n].t, people[next].t];
    out.d0 = SCHEMAS.who.parts.find((p) => p.k === "d").pool[0].t;
    return out;
  })()`);
  assert.equal(r.swap, `“${r.people[0]}” → “${r.people[1]}” in Who · person`);
  assert.equal(r.add, `added “${r.d0}” to Who · descriptor`);
  assert.equal(r.remove, `removed “${r.d0}” from Who · descriptor`);
  assert.match(r.reroll, /^(rerolled What happened|“.*” → “.*” in What happened · .*|added .*|removed .*)$/);
  assert.equal(r.shuffle, "shuffled");
  assert.equal(r.form, "form: Local news");
  assert.equal(r.dial, "incongruity: Absurd");
  assert.equal(r.len, "cut a stanza (1)");
  assert.equal(r.retell, "retold");
  assert.match(r.beat, /^retuned the line: /);
  assert.equal(r.switch, "switched to Small Poems");
  assert.equal(r.bank, "added “ugly” to Who · descriptor");
  assert.equal(r.unbank, "removed “ugly” from Who · descriptor");
});
