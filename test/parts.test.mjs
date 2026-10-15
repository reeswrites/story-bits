// The page's mad-lib labels and the reload rule: phrases name their card for the labels, and a
// reload only starts fresh on a plain piece link.
import { test } from "node:test";
import assert from "node:assert/strict";
import { engine } from "./load.mjs";

test("each headline phrase names its card, and nested phrases name theirs", () => {
  const { json } = engine();
  const r = json(`(() => {
    const out = { tops: [], nested: [] };
    // Seeds until a piece nests a phrase (a thing inside a clause), so both kinds are checked.
    for (let k = 1; k < 200 && !out.nested.length; k++) {
      fresh("story-bits", "bit", 2, 1, k);
      const html = bitHtml(context());
      out.tops = [...html.matchAll(/class="ph top [^"]*" data-card="([^"]*)"/g)].map((m) => m[1]);
      out.nested = [...html.matchAll(/class="ph nested" data-card="([^"]*)"/g)].map((m) => m[1]);
      out.cards = SLOTS.map((c) => c.key);
    }
    return out;
  })()`);
  assert.ok(r.tops.length >= 3, "the headline has its card phrases");
  for (const c of r.tops) assert.ok(r.cards.includes(c), `unknown card ${c}`);
  assert.ok(r.nested.length, "some seed nests a phrase");
  for (const c of r.nested) assert.ok(r.cards.includes(c), `nested phrase names unknown card ${c}`);
});

test("a reload starts fresh only for a plain piece link", () => {
  const { json } = engine();
  const cases = json(`(() => {
    const kinds = ["eyJ2IjozfQ", "jam=ABCD~k", "room=ABCD", "c=x", "p=x", "s=x", "cmp=x", "grammar=x", "sp=K/g", "space=x", "pack=x", "daily", ""];
    return Object.fromEntries(["reload", "navigate", "back_forward", undefined].map((t) => [String(t), kinds.map((h) => [h, freshOnReload(t, h)])]));
  })()`);
  for (const [h, fresh] of cases.reload) assert.equal(fresh, h === "eyJ2IjozfQ", `reload of #${h}`);
  for (const t of ["navigate", "back_forward", "undefined"]) for (const [h, fresh] of cases[t]) assert.equal(fresh, false, `${t} of #${h}`);
});
