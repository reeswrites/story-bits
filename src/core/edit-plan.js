// What the picker's "Change the grammar here" section offers for one word, and who may use it.
// Pure: no DOM, no storage. A plain script loaded after grammar-ops.js; the page half is in
// picker-edit.js, the edits themselves in grammar-ops.js. Tests: test/edit-plan.test.mjs.

// Who may change the grammar from the picker, here: "" if you may, else why not. Editing the
// grammar isn't a move, so a challenge or a workshop round hides it; in a together jam only
// editors see it (their edits go to the jam as a whole-grammar change).
// where = { game: bool, room: null | { mode, role } }
function editBlocked(where = {}) {
  if (where.game) return "challenge";
  const room = where.room;
  if (room) {
    if (room.mode !== "together") return "workshop";
    if (room.role !== "edit") return "role";
  }
  return "";
}

const editCard = (g, card) => g.cards.find((c) => c.key === card);
const editPart = (g, card, k) => g.schemas[card]?.parts.find((p) => p.k === k);
const editWhere = (g, card, k) => `${editCard(g, card).label} · ${editPart(g, card, k).name}`;

// Why an optional slot can't be removed ("" if it can), as grammarOps.removeSlot would refuse it.
function removeSlotWhy(g, card, k) {
  const part = editPart(g, card, k);
  if (!part) return "there's no such slot";
  if (k === "n" || !part.opt) return `${part.name} is required`;
  const dep = g.schemas[card].parts.find((p) => p.needs === k);
  if (dep) return `${dep.name} needs it`;
  return "";
}

// Optional slots to add around the card's head word, as addSlot defs: a describing word before
// it, a detail after it, and a relation ("your uncle" → "your uncle's dentist": the relation slot
// nests the card's own phrase, so the head word becomes whose it is). names = { head, phrase }
// ("uncle", "your uncle") word the labels. A describing word or detail needs a first word (needsWord); a relation
// brings its own.
const SLOTS_MAX = 6; // checkGrammar's limit per card
function slotOffers(g, card, names = {}) {
  const headText = names.head || "this word";
  const parts = g.schemas[card]?.parts;
  if (!parts || parts.length >= SLOTS_MAX) return [];
  const i = parts.findIndex((p) => p.k === "n");
  const head = parts[i];
  const named = (base) => { let n = base, j = 2; while (parts.some((p) => p.name === n)) n = `${base} ${j++}`; return n; };
  const out = [];
  const prev = parts[i - 1], next = parts[i + 1];
  if (!(prev && prev.opt && !prev.relation)) out.push({ key: "describe", label: `Add a describing word before ‘${headText}’`, position: i, def: { name: named("describing word") }, needsWord: true });
  if (!(next && next.opt)) out.push({ key: "detail", label: `Add a detail after ‘${headText}’`, position: i + 1, def: { name: named("detail") }, needsWord: true });
  if (g.maxDepth >= 1 && !parts.some((p) => p.relation) && (head.det || g.schemas[card].article || parts.some((p) => p.determiner))) {
    out.push({ key: "relation", label: `Add a relation: ‘${names.phrase || headText}’s …’`, position: 0, def: { name: named("relation"), relation: true, pool: [{ t: `{${card}}'s`, tier: 0 }] }, needsWord: false });
  }
  return out;
}

// One word's place in the grammar, for the section: its slot, what the slot asks of a new word,
// the word itself (null for one of your own words, which lives in your word bank), whether it
// can be retired, the retired words that could come back, the card's optional slots and the
// slots you could add.
function slotEdit(g, card, k, val, names) {
  const part = editPart(g, card, k);
  if (!part) return null;
  const live = part.pool.filter((w) => !w.retired).length;
  const w = Number.isInteger(val) ? part.pool[val] : null;
  const prOf = (x) => Object.keys(PRON).find((p) => PRON[p].p === x.p) || "they";
  const word = w && {
    i: val, t: w.t, tier: w.tier, retired: !!w.retired, tags: w.tags || [],
    ...(part.mood && { v: w.v }), ...(part.det && { det: w.det }), ...(part.pronouns && { pr: prOf(w) }),
  };
  return {
    card: editCard(g, card).label, slot: part.name, where: editWhere(g, card, k),
    needs: { mood: !!part.mood, det: part.det || null, pronouns: !!part.pronouns },
    word,
    retireWhy: !word ? "" : word.retired ? "already retired" : live <= 1 ? `it's the only word left in ${part.name}` : "",
    retired: part.pool.map((x, i) => ({ i, t: x.t })).filter((x) => part.pool[x.i].retired),
    dets: part.det || null,
    slots: g.schemas[card].parts.filter((p) => p.opt).map((p) => ({ k: p.k, name: p.name, here: p.k === k, why: removeSlotWhy(g, card, p.k) })),
    offers: slotOffers(g, card, names),
  };
}

// The add-a-word form's values as an entry for slot card.k, keeping only what the slot takes
// (the word bank form's rule): { t, tier, v?, det?, pr? }.
function wordEntry(g, card, k, form = {}) {
  const part = editPart(g, card, k);
  const e = { s: card, k, t: cleanWord(form.t), tier: [0, 1, 2].includes(+form.tier) ? +form.tier : 1 };
  if (part.mood) e.v = [-1, 0, 1].includes(+form.v) ? +form.v : 0;
  if (part.det) e.det = part.det.includes(form.det) ? form.det : part.det[0];
  if (part.pronouns) e.pr = PRON[form.pr] ? form.pr : "they";
  return e;
}
// Can this word join the slot? { error } with the word bank's reasons (checkEntry) or a live
// duplicate; { note } when it brings a retired word back. An empty word is neither.
function addCheck(g, e) {
  if (!e.t) return { error: "", note: "" };
  const err = checkEntry(e, g);
  if (err) return { error: err, note: "" };
  const part = editPart(g, e.s, e.k);
  const same = part.pool.find((w) => w.t.toLowerCase() === e.t.toLowerCase());
  if (same && !same.retired) return { error: `‘${same.t}’ is already in ${editWhere(g, e.s, e.k)}`, note: "" };
  return { error: "", note: same ? `brings back ‘${same.t}’, retired earlier` : "" };
}

// Two grammars are kin when one is another version of the other, or a copy of it (a fork, as
// the picker makes): a word you're on, or a pin, means the same in both.
const kinGrammars = (a, b) => !!a && !!b && (a.id === b.id || a.forkedFrom === b.id || b.forkedFrom === a.id);

// A grammar edit can take two saves (a fork, then the edit): make them one step on the timeline,
// so a single undo takes back both. steps are timeline entries of kind "grammar" for the same
// grammar, oldest first; the first is kept (from where it started) and ends where the last does.
function mergeSteps(t, steps, label) {
  if (!steps.length) return null;
  const [first, ...rest] = steps;
  if (rest.length) first.after = rest[rest.length - 1].after;
  if (label) first.label = label;
  for (const s of rest) for (const list of [t.done, t.undone]) { const i = list.indexOf(s); if (i >= 0) list.splice(i, 1); }
  return first;
}

if (typeof globalThis !== "undefined") globalThis.editPlan = { editBlocked, kinGrammars, removeSlotWhy, slotOffers, slotEdit, wordEntry, addCheck, mergeSteps };
