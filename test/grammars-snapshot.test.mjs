// The built-in grammars must stay exactly as they were: links depend on word positions and order.
// The fixture was taken from data.js before it was split into grammars/*.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { engine } from "./load.mjs";

const OLD = JSON.parse(readFileSync(new URL("./fixtures/builtin-grammars.json", import.meta.url), "utf8"));

test("GRAMMARS is deep-equal to the pre-split snapshot, registry order included", () => {
  const { json } = engine();
  const now = json("GRAMMARS");
  assert.deepStrictEqual(Object.keys(now), Object.keys(OLD));
  assert.deepStrictEqual(now, OLD);
});
