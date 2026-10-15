// Loads the page's DOM-free scripts (data.js, grammar.js, engine.js, timeline.js, grammar-ops.js) into a
// fresh vm context, the way index.html does: plain scripts sharing one global scope. Returns run(code), which evaluates
// code in that scope (so tests can reach `state`, `G`, `rng` and friends directly).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
export const FILES = ["data.js", "grammar.js", "engine.js", "timeline.js", "grammar-ops.js"];

export function loadEngine(files = FILES.map((f) => root + f)) {
  const ctx = vm.createContext({ console, TextEncoder, TextDecoder, btoa, atob, structuredClone });
  for (const f of files) vm.runInContext(readFileSync(f, "utf8"), ctx, { filename: f });
  return (code) => vm.runInContext(code, ctx);
}

// Helpers that run inside the engine's scope.
const HELPERS = `
// A fresh piece, the way switching grammar makes one: random phrases, then the pairs settled
// under the dial (every card after the first), with a seeded rng so failures reproduce.
function fresh(gram, f, l = 2, d = 1, k = 1) {
  const g = typeof gram === "string" ? GRAMMARS[gram] : gram;
  rng = seeded(k);
  useGrammar(g);
  Object.assign(state, { grammar: g.id, form: f ?? Object.keys(g.forms)[0], len: l, dial: d, beats: {}, pins: [], sel: null, pick: {}, view: null, game: null });
  for (const c of SLOTS) state.pick[c.key] = randomPhrase(c.key);
  state.seed = 1 + rand(1e9);
  for (const c of SLOTS.slice(1)) pickFrom(c.key, Array.from({ length: 300 }, () => randomPhrase(c.key)));
}
// Every grammar, form, length and dial setting.
function eachCase(fn) {
  for (const g of Object.values(GRAMMARS)) for (const f of Object.keys(g.forms))
    for (let l = 1; l <= g.forms[f].stanzas.length; l++) for (const d of [0, 1, 2]) fn(g, f, l, d);
}
// Every filled slot in a phrase, nested ones included.
function walk(schema, ph, fn, depth = 0, path = []) {
  for (const p of SCHEMAS[schema].parts) if (p.k in ph.w) {
    fn(schema, p, ph, depth, [...path, p.k]);
    const inner = subSchema(schema, ph, p.k);
    if (inner) walk(inner, ph.sub[p.k], fn, depth + 1, [...path, p.k]);
  }
}
// A built-in grammar with one constraint added, under a new id.
function constrained(gid, c) {
  const g = clone(GRAMMARS[gid]);
  return { ...g, id: gid + "-c", rules: { ...g.rules, constraints: [c] } };
}
// The headline and every beat line in play, as text.
function pieceText() {
  const ctx = context();
  const choice = beatChoices(ctx);
  return [bitLine(ctx), ...stanza().paras.flat().map((key) => fillText(beatLines(key, ctx)[choice[key]].t, ctx))].join(" | ");
}
`;

// A fresh engine with the helpers loaded. run(code) evaluates code in the engine's scope;
// json(code) brings the result out as plain JSON (vm objects come from another realm).
export function engine() {
  const run = loadEngine();
  run(HELPERS);
  const json = (code) => JSON.parse(run(`JSON.stringify(${code})`) ?? "null");
  return { run, json };
}
