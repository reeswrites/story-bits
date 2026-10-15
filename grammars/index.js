// Built-in grammars. A grammar is one document: cards, their word slots and pools, a headline
// line, forms (templates of beats), and rules (what the dial clashes, whether forms must land,
// word constraints). See docs/design.md. The engine (src/core/engine.js) knows nothing about any one grammar.
//
// Story Bits: every card is a phrase built from words, each tunable on its own. Each word carries
// a tier (0 = plausible, 1 = odd, 2 = absurd); a phrase's register is its strangest word. Event and
// feeling cores also carry a mood (+1 good, 0 mixed, -1 bad). The dial makes pairs of cards fit or
// clash on these, and every form lands.
//
// Phrases nest: a word whose text names a card ({thing}) holds a whole phrase of that card,
// tunable the same way, up to the grammar's maxDepth.
// Pronoun tokens in word text: {p} {o} {pos} {is} {has} {was} {s}.

const HE = { p: "he", o: "him", pos: "his", is: "is", has: "has", was: "was", s: "s" };
const SHE = { p: "she", o: "her", pos: "her", is: "is", has: "has", was: "was", s: "s" };
const THEY = { p: "they", o: "them", pos: "their", is: "are", has: "have", was: "were", s: "" };
const IT = { p: "it", o: "it", pos: "its", is: "is", has: "has", was: "was", s: "s" };

// Built-in grammars: shared bits first, then one file per grammar, each registering itself.
//
// To add a grammar: write grammars/<name>.js (consts for its schemas and forms, then
// `GRAMMARS[MY_GRAMMAR.id] = MY_GRAMMAR;`) and add one <script src="grammars/<name>.js"> tag to
// index.html after this file. Registry order is the order of those tags; test/load.mjs and
// tools/accept-pack.mjs each list the grammar files (GRAMMAR_FILES), so add the file to both.
// Never reorder or edit existing words: links depend on word positions.
//
// B(tier, t) builds a beat line.
const B = (tier, t) => ({ tier, t });

const GRAMMARS = {};
