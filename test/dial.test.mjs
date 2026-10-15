// The dial: no clash, the first pair clashing, or every pair clashing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { engine } from "./load.mjs";

test("the dial asks for no clash, the first pair clashing, or every pair clashing", () => {
  const { run, json } = engine();
  // Record every pick under the dial: could any candidate fit every pair, and did the pick?
  run(`
    var picks = [];
    const realPickFrom = pickFrom;
    pickFrom = (slot, ok) => {
      const rules = PAIRS.map((p, i) => ({ p, want: wantClash(i) })).filter((r) => r.p.a === slot || r.p.b === slot);
      const fits = (v) => rules.every((r) => clashes(r.p, { ...state.pick, [slot]: v }) === r.want);
      const grounded = (v) => slot !== G.rules.grounded || phraseTier(slot, v) <= state.dial;
      const could = ok.some((v) => fits(v) && grounded(v));
      realPickFrom(slot, ok);
      picks.push({ g: G.id, slot, could, did: fits(state.pick[slot]) });
    };
  `);
  const r = json(`(() => {
    const exact = {}, total = {};
    eachCase((g, f, l, d) => {
      for (let k = 1; k <= 4; k++) {
        fresh(g, f, l, d, k * 31 + l);
        rerollPick(SLOTS.map((c) => c.key));
        const inPlay = pairsInPlay();
        const want = d === 0 ? 0 : d === 2 ? inPlay.length : inPlay.includes(PAIRS[0]) ? 1 : 0;
        const ok = clashCount() === want && inPlay.every((p) => clashes(p) === wantClash(PAIRS.indexOf(p)));
        total[g.id] = (total[g.id] || 0) + 1;
        exact[g.id] = (exact[g.id] || 0) + (ok ? 1 : 0);
      }
    });
    return { exact, total, broken: picks.filter((p) => p.could && !p.did), soundPairs: Object.values(GRAMMARS).filter((g) => g.rules.pairs.some((p) => p.on === "sound")).map((g) => g.id) };
  })()`);
  // Whenever a candidate fits every pair the dial asks about, the pick fits them all.
  assert.deepEqual(r.broken, []);
  for (const id of Object.keys(r.total)) {
    if (r.soundPairs.includes(id)) {
      // Sound pairs sample a few hundred phrases, and a matching first letter can be rare, so a
      // clash the dial didn't ask for can slip through.
      assert.ok(r.exact[id] / r.total[id] >= 0.9, `${id}: ${r.exact[id]}/${r.total[id]} exactly on the dial`);
    } else assert.equal(r.exact[id], r.total[id], `${id}: every piece exactly on the dial`);
  }
});
