# Design: grammars, library, jams

Story Bits started as a humor generator. It is now an instrument for writing with grammars: you tune a piece word by word, alone, in your browser; when you want company, you open
a jam. This note records the model and the decisions behind it.

## Principles

- **Single-player and local-first by default.** No account. Your grammars, word bank and kept shelf
  live in your browser; a piece lives in its link. Nothing touches a server unless you open a jam or put something in a space.
- **Selection and recombination, not a blank page.** You choose among supplied words and lines,
  step them plain → strange, and add your own when the supply runs out.
- **Game-ness emerges from collaboration.** Move limits, claps and winners are optional rules a jam
  can switch on, not the default.

## Grammar

A grammar is one shareable, forkable JSON document:

| part | what it is |
|---|---|
| `cards` | the pieces of a piece (story: who, what happened, how they feel, where, thing) |
| `schemas` | each card's ordered word slots (`[intensity] [quality] noun [clause]`) and their word pools; slot flags: `opt`, `needs`, `mood`, `det`, `pronouns`, `trailing`, `relation`; pool words may carry `tags` |
| `line` | the headline: a template over cards and pronouns (`{who} {what}, and {p} {is} {feel}.`) |
| `forms` | shapes of a telling: stanzas that bring in cards and fill paragraphs with beats; beat lines are tiered plain → strange |
| `rules` | what the dial means: which card pairs can clash and on what (`mood`, `register`, `sound`), whether every form must land, and word constraints |
| `keep` | what's worth keeping: `{ card, name, verb, note? }`; the card must be in the headline |

Story Bits' humor model is the `story-bits` grammar's rules: event/feeling clash on mood,
place/event and thing/place clash on register, and every form must land. Poetry is another grammar
with other rules (clash on sound and register, no landing). The engine doesn't know about humor.
Sayings, Just-so stories and Hinge prompts are three more (2026-10-15): a proverb (advice ↔ reason
on mood), an origin myth (deed ↔ *ever since* on mood; lands on "and that is why"), and a
dating-app prompt whose stems are a card (prompt ↔ answer on mood and register).

Pair order matters twice: the first pair is the one the middle dial setting clashes, and when a
card is picked against cards that haven't been re-picked yet, the later pairs are the ones that
relax first. Put pairs against already-settled cards (and the `grounded` card) first, or a card
can drift to match a stale neighbor's register.

A slot's `odds` (0–1) sets how often a fresh phrase fills that optional slot (default 0.5), so a
grammar can keep its headline short. Pronoun sets are he, she, they and it.

**Constraints** restrict what a word slot (or the whole grammar) accepts, in the Oulipo spirit:
a lipogram (no letter *e*), alliteration (all words start with the same letter), a syllable cap,
or a closed word set. They filter the options the picker and shuffles draw from, so a constrained
grammar can't produce a word that breaks it.

**Nesting** is any word whose text names a card (`blames {thing}`): that word holds a whole phrase
of that card, tunable the same way, to `maxDepth`.

**Moves** are the picker's lateral changes, generated from grammar data alone (`moveCandidates` in
engine.js). Each returns whole-phrase candidates, nearest first:

| move | from the grammar |
|---|---|
| plainer / stranger | the slot's words ordered by tier (‹ ›) |
| sideways | same slot and tier; words sharing a `tags` entry first (`tags: ["family"]`), then the same mood; with no tags, just the same tier |
| zoom out | an empty (or other) optional slot that nests a card: flagged `relation: true`, or found by its nesting words. A relation slot that nests its own card (`{who}'s`) takes the current phrase inside and offers new heads: *your uncle* → *your uncle's dentist*. A phrase led by a filled relation slot takes no determiner of its own, and a nested phrase's trailing `'s` sticks to it |
| add | an empty optional slot that doesn't nest |
| flip | the opposite mood (`v`) at the nearest tier, on the phrase's mood word |
| sound | the same first letter as a neighboring word or card, or another word in the phrase matched to this one |

Every candidate passes constraints, `needs` and `maxDepth`, like any other word.

### Decision: one kept shelf, declared by the grammar (2026-10-15)

The cast used to exist only for grammars with a pronoun card. Now every grammar declares what's
worth keeping (`keep: { card, name, verb }`): Story Bits keeps the character (*The cast*), Small
Poems the image (*Images*), Sayings the subject (*The usual suspects*), Just-so stories the
creature (*The menagerie*), Hinge prompts the answer (*Your material*). A shelf entry is
`{ g, card, ph, bits }`: the kept phrase and the headlines it appeared in, keyed by grammar, card
and head word. *Tell another* pins the phrase and rerolls every other card, in any grammar. A
grammar without `keep` (an older fork or link) keeps its pronoun card, else the first card its
headline names; forking writes the fallback out, so every new grammar has one.

Storage moved from `story-bits-cast` (`{ g, who, bits }`) to `story-bits-kept`. The first load
copies the cast across and leaves the old key untouched, so nothing is lost if an older page opens
it. In a space, shelf entries are still items of kind `cast` (the room server needs no change),
with `{ g, card, ph, bits }` and, for a `who` card, `who` too, which older pages read.

Lore (a space's kept phrases) is the same shape, `{ g, card, ph }`, and drops back into a piece
through the same pinning as *Tell another*. The gap, kept on purpose for now: lore is shared and
takes any card but has no headlines; the shelf is personal, takes only the keep card, and
remembers headlines. A lore phrase on the keep card can be moved to your shelf; a shelf entry goes
to a space as a kept item, not as lore.

## Library

Local-first list of grammars: the built-ins plus anything you fork, write or import. Fork copies a
grammar with `forkedFrom`; edits stay in your browser. Share is a link carrying the grammar;
opening it offers to add it to your library. Publishing is a public space (below); the issue →
`accepted-pack` → PR pipeline is only for curating what ships built in.

Links to pieces name their grammar by id; a piece made with a custom grammar carries the grammar
inline, so the link works for someone who doesn't have it.

## Jam

An optional shared session, served by the room server (`party/`, partyserver on Cloudflare).

- **Roles**, like a shared doc: view, comment, edit. Each role has its own invite link.
- **Together**: one shared piece. Editors tune words, beats, the form, or the grammar itself, live;
  everyone sees who's on which word. Edits go out as small patches, one per card, per beat line, or
  per setting, so two people on different cards never collide; within one card, last write wins.
  Switching the grammar sends the whole piece.
- **Comments** anchor to a word or a beat (the same `card|path` / `beat|key` addresses links use),
  so feedback sits on the exact thing it's about.
- **Workshop**: everyone tunes their own copy from the same start, then the copies go side by side
  for critique: comments on each copy, and optionally claps. A move limit and claps turn a workshop
  into the game.

The room server never interprets pieces or grammars. It stores JSON, enforces roles, phases and
claps, and every client checks what it receives with the same parsers it uses for links.

## Spaces

A space is a persistent shared folder for a group: its grammars, word banks, kept pieces, cast,
lore (kept phrases), comments and jam history. Jams open inside a space and draw from it. A
**public** space is view-only to anyone with its short id, and is how grammars and pieces get
published: `#sp=K7Q2M9XA` instead of a 13 KB `#grammar=` link, and no GitHub issue. The issue →
`accepted-pack` → PR route stays only for curating what ships built in.

### Decision: versioned grammars, not stable word ids (2026-10-15)

A piece names its words by **pool index** (`p.who.w.n = 14`) and its beat lines by index too. A
grammar that several people can edit would silently change every saved piece that points into it:
remove one word and every later index shifts. Two ways out:

1. **Stable word ids**: every pool word gets an id and pieces reference ids. That changes the value
   type the whole engine passes around (options, stepping, diffs, moves, links), still needs a
   mapping for every v1–v3 link, and doesn't cover beat lines, forms or rules changing under a
   piece: a piece that reads well is the words *and* the grammar that frames them.
2. **Versioned grammars**: a grammar in a space is a sequence of immutable versions. Publishing an
   edit appends version *n + 1*; nothing is ever rewritten. A piece pins the version it was made
   with.

We chose **versions**. It's the rule the built-ins already follow (pools are append-only, so old
indices stay put), generalized: instead of "never remove", "never change, only add a version". The
engine is untouched: a pinned piece is indices into a document that can't move. Version numbers
are assigned by the space server, so they can't collide or be forged; a publish names the version
it was edited from and is refused if someone published in between (no silent overwrite). Moving a
piece to a newer version is explicit: it opens in the new version only if it still parses there.

Links:

- **v1–v3 links are unchanged** and still open: v1/v2 have no grammar (Story Bits), v3 names a
  built-in by id or carries a custom grammar inline (`gx`).
- **v4** adds `gs` (space id) and `gv` (version) to a piece whose grammar came from a space. If
  the space is public, the link drops `gx`: the page fetches that exact version by id, so the link
  is short. If it's private, `gx` stays, so the link still opens for someone outside the space.
- A v4 link to a version the page can't fetch (the space was deleted) falls back to `gx` if
  present, else it won't open, the same as a v3 link to a grammar you don't have.

### Model

| part | what it holds | who may change it |
|---|---|---|
| grammars | each a list of immutable versions; the head is the latest | editors publish versions |
| words | word packs: lists of checked bank entries for a grammar | editors |
| pieces | kept pieces: v4 snapshots pinned to a version | editors |
| cast | kept-shelf entries: a phrase and its running headlines (any grammar's keep card) | editors |
| lore | kept phrases, from the page or from a jam in the space | editors; linked jams |
| comments | notes on any item | commenters |
| jams | the jams opened in the space, and their finished rounds | linked jams |

Roles come from keys, like jams: **owner** (rename, public or private, retention, delete),
**edit**, **comment**, **view**. A private space needs a key even to view; a public one is
viewable by id. The space server, like the jam server, never interprets what it stores: it checks
shapes and sizes; every client checks what a space sends with `checkGrammar`, `checkEntry` and
`parseSnapshot` before using it.

Local-first: nothing leaves the browser unless you create or join a space and put something in it.
Joined spaces are listed in this browser only ("my spaces", with their keys). Export saves a
space, every version included, to a file; import makes a new space from one.

Retention is the owner's setting: **until I delete it** (the default for spaces), or a year or a
month after it's last used. Choosing a time-based setting asks first, and the space shows the date
it would go if unused, highlighted in the last weeks. Delete now removes everything at once.

### Jams in a space

A jam opened from a space is linked to it by its host (who holds an edit key). The jam server
fetches the space's context (grammars, lore, kept shelves) and relays it to everyone in the jam, so
people in the jam don't need the space's keys. A phrase kept in the jam goes to the space's lore;
finished workshop rounds go to its jam history. At a workshop reveal, a copy that reuses a kept
phrase is marked as a **callback**.

## History: everything is reversible (2026-10-15)

Every action can be taken back, and the design assumes most of it happens on a phone.

**One timeline** (`timeline.js`, pure; `history.js`, the page). An entry is plain data
`{ kind, label, ... }`; `history.js` keeps an undoer per kind. Kinds: `piece` (render() notes
each change as `{ from, to }`, as the calm-view undo did; undo puts back only what the step
changed), `grammar` (`{ id, before, after }` are version numbers, `null` meaning not in the
library; `piece` rides along when the edit moved the piece, so one undo puts both back), `bank`,
`shelf`, `drafts` (whole before/after values). Labels are made where the change is known:
`pieceLabel(from, to)` diffs two pieces (one word: *“sad” → “ugly” in Who · descriptor*; added,
removed, rerolled a card, shuffled, form, dial, length, retold, a line), `bankLabel`, and each
library edit passes its own (*constraints: lipogram*). An action can name the next piece step with
`hintNext(label)` (*opened draft “x”*).

API for other parts of the page (the picker's fork-on-write, say):

```js
remember(kind, label, before, after)   // one entry; undo puts `before` back, redo `after`
onUndo(kind, (value, entry, back) => {})  // how to put a value of that kind back (return false: can't)
hintNext(label)                        // a label for the next change to the piece
saveGrammarVersion(id, doc, label)     // a new version of a library grammar, on the timeline
```

Jams: a piece step undone in a together jam is an ordinary edit, so it goes out as patches and
leaves others' edits alone; remote applies move the baseline without adding a step; read-only
roles can't undo piece steps (their bank and drafts still can). A grammar edit that changes the
jam's piece is saved as a version but not put on the timeline. Entering or leaving a jam or a
challenge drops piece steps only.

**Local grammar versions.** Each library grammar has a store `{ cur, list: [{ n, at, label, doc }] }`
in its own key (`story-bits-grammar-versions`), up to 50 versions. `library[id]` is always the
current version's object, so a grammar object *is* a version: `setLocalVersion(doc, id, n)` tells
the engine, and `grammarFields` adds `lv: n` to snapshots of library grammars (alongside `gx`, so
links still carry the grammar). `resolveGrammar` finds a pinned version before the current one;
if the version is gone and the current one doesn't fit, `parseSnapshot` falls back to the link's
own `gx`. `saveLibrary(label)` notices every change (forks, edits, imports, spaces) and saves a
version. Undo moves `cur`; restore saves the old doc again as a new version; nothing is deleted
except by pruning, which drops the oldest but never the current version or one a draft pins.
Storage is a delta chain: the first version whole, each later one as what changed two levels deep
(a card's schema, a form, the rules): word edits to a fork take about a tenth of whole copies.
On a full quota, fewer
versions are kept. This mirrors spaces (every published version kept, pieces pin `gs/gv`), but
local and private.

**Drafts**: named snapshots, up to 30, in `story-bits-drafts`. A draft of your own grammar drops
`gx` and pins `lv` (kept from pruning). Compare shows drafts beside the current piece using the
challenge compare cards, with `changes()` marked when grammar, form and length match.

**Phone layout.** Below 640px: a fixed bottom bar (Undo · Shuffle · Redo · History, ≥44px targets,
safe-area insets) replaces the inline buttons and hides while the picker sheet or History is open;
History is a full-height sheet (a side panel on wider screens), a modal dialog with focus kept
inside; Compare becomes horizontal scroll-snap cards. Desktop keeps the inline controls.

## What's stored

In your browser: grammars you've added and their versions, drafts, your word bank, your kept shelf, and the spaces you've joined
(with their keys). In a space: its grammars (every version), items, lore, comments (nicknames) and
jam summaries; kept until the owner deletes it by default. In a jam: the room's piece,
grammar, comments and rounds, in that room's storage in our Cloudflare account; nicknames only; a
room is kept as long as its host chooses (a month or a year after last use, or until deleted; a year
by default), and the host can wipe or delete it any time. Retention is a setting, not a limit.

## Status (2026-10-15)

Built: grammar documents and checks (`grammar.js`), Story Bits, Small Poems, Sayings, Just-so
stories and Hinge prompts, a kept shelf per grammar, constraints
(lipogram, alliteration, syllable cap, closed), the library (fork, edit, share, import, suggest),
jams with roles, together mode, presence, comments, and workshop rounds with optional move limits,
claps and critique notes. Packs carry grammars, words and forms.

Spaces (2026-10-15): persistent shared folders with owner/edit/comment/view keys, versioned
grammars and v4 links, pieces, word packs, cast, lore and comments, jams linked to a space (context
relay, lore, round history, callbacks at reveals), public spaces with short links, export/import,
owner-set retention (until deleted by default) with warnings. This replaces the planned data API
and lore across jams. Tests: `party/test/spaces.test.mjs`.
