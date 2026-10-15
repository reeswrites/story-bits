// Turn an accepted word-pack issue into packs/issue-<n>.json and list it in packs/index.json.
//
// Run by .github/workflows/word-pack.yml when a maintainer labels an issue `accepted-pack`,
// with the issue body in $BODY and its number in $NUMBER. Run it locally the same way:
//   BODY="$(cat body.md)" NUMBER=12 node tools/accept-pack.mjs
//
// The body is untrusted. It is only ever parsed as JSON and checked word by word against the
// grammar (checkEntry in grammar.js); nothing in it is evaluated.

import fs from "node:fs";
import vm from "node:vm";

const { BODY = "", NUMBER = "" } = process.env;
if (!/^\d+$/.test(NUMBER)) fail("NUMBER must be the issue number.");

// Load the page's own data and grammar, so the rules here can't drift from the site's.
// Registry order = script order in index.html (see grammars/index.js).
const GRAMMAR_FILES = ["index", "story-bits", "small-poems", "sayings", "just-so", "hinge"].map((n) => `grammars/${n}.js`);
const ctx = vm.createContext({});
vm.runInContext(
  `${[...GRAMMAR_FILES, "src/core/grammar.js"].map((f) => fs.readFileSync(f, "utf8")).join("\n")}\n` +
    "this.GRAMMARS = GRAMMARS; this.checkEntry = checkEntry; this.checkForm = checkForm; this.checkGrammar = checkGrammar; this.cleanWord = cleanWord;",
  ctx,
);
const { GRAMMARS, checkEntry, checkForm, checkGrammar, cleanWord } = ctx;

const block = BODY.match(/```json\s*([\s\S]*?)```/);
if (!block) fail("No ```json block found in the issue.");
let pack;
try { pack = JSON.parse(block[1]); } catch (e) { fail(`The json block doesn't parse: ${e.message}`); }
const obj = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
const words = Array.isArray(pack?.words) ? pack.words : [];
const forms = obj(pack?.forms);
const grammars = obj(pack?.grammars);
if (!words.length && !Object.keys(forms).length && !Object.keys(grammars).length) fail("The pack has no words, forms or grammars.");

// Everything already shared: the built-in grammars plus earlier packs (in index order, the order
// the site loads them).
const indexPath = "packs/index.json";
const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const known = new Set();
const keyOf = (e) => `${e.g || "story-bits"}.${e.s}.${e.k}.${e.t.toLowerCase()}`;
const addPools = (g) => { for (const [s, schema] of Object.entries(g.schemas)) for (const p of schema.parts) for (const w of p.pool) known.add(`${g.id}.${s}.${p.k}.${w.t.toLowerCase()}`); };
for (const g of Object.values(GRAMMARS)) addPools(g);
for (const f of index) {
  const p = JSON.parse(fs.readFileSync(`packs/${f}`, "utf8"));
  for (const [id, g] of Object.entries(p.grammars || {})) if (!GRAMMARS[id] && !checkGrammar(g)) { GRAMMARS[id] = g; addPools(g); }
  for (const e of p.words || []) known.add(keyOf(e));
  const fg = GRAMMARS[p.grammar || "story-bits"];
  if (fg) for (const k of Object.keys(p.forms || {})) fg.forms[k] = fg.forms[k] || p.forms[k];
}

const rejected = [];
// Grammars: checked whole; an id is never reused, so links to a grammar keep their meaning.
const acceptedGrammars = {};
for (const [id, g] of Object.entries(grammars)) {
  const err = GRAMMARS[id] ? "that grammar id is taken" : g?.id !== id ? "its id doesn't match its key" : checkGrammar(g);
  if (err) rejected.push(`- grammar \`${cleanWord(id)}\`: ${err}`);
  else { const { shared, ...clean } = g; acceptedGrammars[id] = clean; GRAMMARS[id] = clean; addPools(clean); }
}

const accepted = [];
for (const raw of words) {
  // Keep only the fields a word may have, in a stable order.
  const e = raw && typeof raw === "object"
    ? Object.fromEntries(["g", "s", "k", "t", "tier", "v", "det", "pr"].filter((f) => raw[f] !== undefined).map((f) => [f, raw[f]]))
    : raw;
  const g = GRAMMARS[e?.g || "story-bits"];
  const err = !g ? "belongs to a grammar nobody has" : checkEntry(e, g) || (known.has(keyOf(e)) ? "already in the shared bank" : "");
  if (err) rejected.push(`- \`${cleanWord(raw?.t) || "?"}\`: ${err}`);
  else { accepted.push(e); known.add(keyOf(e)); }
}

// Forms join one grammar (pack.grammar, default Story Bits), checked whole; a key is never reused.
const formGrammar = GRAMMARS[pack.grammar || "story-bits"];
const acceptedForms = {};
for (const [k, f] of Object.entries(forms)) {
  const err = !formGrammar ? "the pack's grammar doesn't exist" : !/^[a-z][a-z0-9-]{0,23}$/.test(k) ? "key must be a short lowercase slug" : formGrammar.forms[k] ? "that form key is taken" : checkForm(f, formGrammar);
  if (err) rejected.push(`- form \`${cleanWord(k)}\`: ${err}`);
  else { acceptedForms[k] = f; formGrammar.forms[k] = f; }
}
const nForms = Object.keys(acceptedForms).length;
const nGrammars = Object.keys(acceptedGrammars).length;
if (!accepted.length && !nForms && !nGrammars) fail(`Nothing new and valid.\n${rejected.join("\n")}`);

const file = `issue-${NUMBER}.json`;
const name = cleanWord(pack.name).slice(0, 60) || `Pack from #${NUMBER}`;
fs.writeFileSync(`packs/${file}`, JSON.stringify({
  name, source: `#${NUMBER}`,
  ...(nGrammars && { grammars: acceptedGrammars }),
  ...(pack.grammar && nForms && { grammar: pack.grammar }),
  words: accepted,
  ...(nForms && { forms: acceptedForms }),
}, null, 1) + "\n");
if (!index.includes(file)) fs.writeFileSync(indexPath, JSON.stringify([...index, file], null, 1) + "\n");

summary(`Accepted ${[nGrammars && `${nGrammars} grammar${nGrammars === 1 ? "" : "s"}`, `${accepted.length} word${accepted.length === 1 ? "" : "s"}`, nForms && `${nForms} form${nForms === 1 ? "" : "s"}`].filter(Boolean).join(", ")} into \`packs/${file}\`.` +
  (rejected.length ? `\n\nSkipped:\n${rejected.join("\n")}` : ""));

function summary(text) {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `count=${accepted.length}\n`);
}
function fail(msg) {
  console.error(msg);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, msg + "\n");
  process.exit(1);
}
