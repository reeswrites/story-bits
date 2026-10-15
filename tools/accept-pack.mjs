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
const ctx = vm.createContext({});
vm.runInContext(
  `${fs.readFileSync("data.js", "utf8")}\n${fs.readFileSync("grammar.js", "utf8")}\n` +
    "this.SCHEMAS = SCHEMAS; this.FORMS = FORMS; this.checkEntry = checkEntry; this.checkForm = checkForm; this.cleanWord = cleanWord;",
  ctx,
);
const { SCHEMAS, FORMS, checkEntry, checkForm, cleanWord } = ctx;

const block = BODY.match(/```json\s*([\s\S]*?)```/);
if (!block) fail("No ```json block found in the issue.");
let pack;
try { pack = JSON.parse(block[1]); } catch (e) { fail(`The json block doesn't parse: ${e.message}`); }
const words = Array.isArray(pack?.words) ? pack.words : [];
const forms = pack?.forms && typeof pack.forms === "object" && !Array.isArray(pack.forms) ? pack.forms : {};
if (!words.length && !Object.keys(forms).length) fail("The pack has no words or forms.");

// Everything already shared: the built-in pools plus earlier packs.
const indexPath = "packs/index.json";
const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
const known = new Set();
const keyOf = (e) => `${e.s}.${e.k}.${e.t.toLowerCase()}`;
for (const [s, schema] of Object.entries(SCHEMAS)) for (const p of schema.parts) for (const w of p.pool) known.add(`${s}.${p.k}.${w.t.toLowerCase()}`);
const knownForms = new Set(Object.keys(FORMS));
for (const f of index) {
  const p = JSON.parse(fs.readFileSync(`packs/${f}`, "utf8"));
  for (const e of p.words || []) known.add(keyOf(e));
  for (const k of Object.keys(p.forms || {})) knownForms.add(k);
}

const accepted = [], rejected = [];
for (const raw of words) {
  // Keep only the fields a word may have, in a stable order.
  const e = raw && typeof raw === "object"
    ? Object.fromEntries(["s", "k", "t", "tier", "v", "det", "pr"].filter((f) => raw[f] !== undefined).map((f) => [f, raw[f]]))
    : raw;
  const err = checkEntry(e) || (known.has(keyOf(e)) ? "already in the shared bank" : "");
  if (err) rejected.push(`- \`${cleanWord(raw?.t) || "?"}\`: ${err}`);
  else { accepted.push(e); known.add(keyOf(e)); }
}
// Forms: checked whole (every stanza must land), keyed by a short slug that's never reused.
const acceptedForms = {};
for (const [k, f] of Object.entries(forms)) {
  const err = !/^[a-z][a-z0-9-]{0,23}$/.test(k) ? "key must be a short lowercase slug" : knownForms.has(k) ? "that form key is taken" : checkForm(f);
  if (err) rejected.push(`- form \`${cleanWord(k)}\`: ${err}`);
  else { acceptedForms[k] = f; knownForms.add(k); }
}
const nForms = Object.keys(acceptedForms).length;
if (!accepted.length && !nForms) fail(`Nothing new and valid.\n${rejected.join("\n")}`);

const file = `issue-${NUMBER}.json`;
const name = cleanWord(pack.name).slice(0, 60) || `Pack from #${NUMBER}`;
fs.writeFileSync(`packs/${file}`, JSON.stringify({ name, source: `#${NUMBER}`, words: accepted, ...(nForms && { forms: acceptedForms }) }, null, 1) + "\n");
if (!index.includes(file)) fs.writeFileSync(indexPath, JSON.stringify([...index, file], null, 1) + "\n");

summary(`Accepted ${accepted.length} word${accepted.length === 1 ? "" : "s"}${nForms ? ` and ${nForms} form${nForms === 1 ? "" : "s"}` : ""} into \`packs/${file}\`.` +
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
