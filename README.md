# Story Bits

**Write with a grammar, word by word.** Tune a piece from plain to strange, one word or line at a time, in a grammar you can swap, fork and share. Alone and local-first by default; open a jam when you want company.

> your uncle just got his boating license and he's really excited about it

Live: https://reeswrites.com/story-bits/ · Design notes: [docs/design.md](docs/design.md)

Story Bits began with one rule for funny stories, from a note: *something happened to someone, and they feel some way about it*, and a funny story is an incongruity that lands somewhere it's safe to laugh. That rule is now one grammar. Poems, sayings, origin myths and dating-app prompts are others. Make your own.

## The page

It opens calm: the piece, one hint (*tap any word*), and **Shuffle**. The first time, one headline word pulses gently under a *tap to change* bubble. Everything else is one step away.

**Mad-lib blanks.** Every word you can change sits on a dotted line, like the blank on a Mad Libs page. Each card keeps its own (muted) color, and in the headline a small label under each phrase names the part from the grammar (*Who*, *What happened*, *How they feel*; *Image*, *Motion*, *Place*, *Time*), with *thing, inside* for a nested phrase. Labels show on a first visit and fade after a few tunes; **Show parts** in Rules turns them on or off. Pins, comments and someone else's cursor keep their own marks; the picker says what each mark means.

**Reload starts fresh.** Reloading a plain piece link makes a new piece in the same grammar, form, length and dial; the one you had is kept, and **Back to your last piece** offers it for ten seconds. A link opened any other way opens exactly, and jams, challenges, copies, compares, grammars, spaces, packs and today's bit never change on reload.

Everything else:

- **Rules** (above the piece) holds the grammar, form, length, the dial, the pairs it clashes, and *Reroll one card*.
- **With others** has *Start a jam*, *Pass it around* and *Today's bit*.
- **More** (next to Shuffle) has *Retell*, *Keep this character* and *Copy link*.
- **↶ ↷** undo and redo appear once there's something to undo (also **⌘Z** / **Ctrl+Z**, **⇧⌘Z** / **Ctrl+Shift+Z**), and **History** opens the whole timeline. See *Everything is reversible*, below.
- **On a phone**, Undo · Shuffle · Redo · History sit in a bar at the bottom of the screen, in reach of your thumb (big targets, clear of the home indicator); it steps aside while a word's picker is open.
- **Word bank**, **Grammars & spaces** and the grammar's **kept shelf** (*The cast*, *Images*…) fold away below the piece.

Which of these are open is remembered in this browser. In a jam or a challenge, its bar stays on the page.

**Keyboard and screen readers**: words are buttons named for what they are (*landlord, Who: person*); each sentence has a tune button that shows when focused. The picker is a dialog: focus moves into it, ← → step, **1**–**3** use a preview, Escape closes it and returns focus to the word; on a phone it's a modal sheet and Tab stays inside it. Small text holds 6:1 contrast or better; nothing is faded unless it's done (a resolved comment), and unavailable buttons are outlined dashed rather than greyed.

## Everything is reversible

One undo timeline holds everything you do, not only the piece: tuning words and lines, form, length and the dial, switching grammar, edits to your grammars (words, lines, pairs, constraints, the dial, JSON, forking, deleting), the word bank (add and remove), keeping and forgetting things on the kept shelf, and saving or deleting drafts. Each step has a plain label (*added “ugly” to Who · descriptor*), and undoing one says what it put back (*Undid: …*).

**History** (next to Shuffle; on a phone, in the bottom bar) opens a sheet, full height on a phone and a panel at the side on a wider screen, with three views:

- **Timeline**: newest first. Tap any step to go back to just before it; what you undo stays above the *now* line, ready to redo, until you change something new.
- **Drafts**: *Save a draft* keeps the piece exactly as it is, named, in this browser (up to 30; also under **More**). Open one, delete one (undo brings it back), or tick a few and **Compare** them with the piece as it is now: side by side on a wide screen, swipe cards on a phone, with what each draft changed highlighted.
- **Versions**: every saved edit to one of your grammars is a version (up to 50 each). Step back and forward through them with your piece told under each, and **Restore** one: it's saved again as the newest version, so nothing is ever deleted. Your library's cards have a **History** button too.

Pieces made with your own grammar pin the version they were made with, so they keep opening here whichever version is current; their links still carry the grammar itself, so they open anywhere.

In a together jam, undoing a change to the piece goes out like any other edit and only puts back what you changed (others' edits stay). A grammar edit from the picker is on your timeline too: undoing it puts the jam's grammar (and piece) back for everyone, as one whole-grammar change. A grammar edit from the library editor that changes the jam's piece isn't on your timeline, but it's still a version you can restore. Starting or leaving a jam or a challenge clears the piece's steps (they were about another piece); the rest of the timeline stays. The timeline lasts until you reload; drafts and versions are kept.

## Writing alone

- **Tap any word** to open it. The word sits big at the top with **‹ plainer · stranger ›** (or ← →), stepping it live. Below it, **moves** go sideways instead of up the scale:
  - **Sideways**: another word at the same register in the same slot, words that share a tag first (*uncle* → *aunt*). On a phone, swipe the word left or right.
  - **Zoom out**: put the phrase inside a bigger one (*your uncle* → *your uncle's dentist*; *lost his dog* → *lost his dog thanks to a goose*).
  - **Add**: fill an empty slot (*your uncle* → *your ugly uncle*).
  - **Flip**: the opposite mood at about the same register (*thrilled* → *devastated*).
  - **Sound**: alliterate with a word or phrase next to it.

  Tap a move to see three previews, each the whole line with the change marked; **More** shows the next three. The one you're looking at (hovered or focused; on a phone, the first) shows in the piece itself, ghosted with a dashed outline, and nothing changes until you tap it (or press **1**–**3**). Moves with nothing to offer don't show. In a challenge each preview says which move it would be, or that it's over your limit. **All words** opens the full list grouped by register; *Surprise me*, *Pin* (shuffles keep it), *Remove*, or type your own.
- **On a phone** the picker is a bottom sheet that takes at most about half the screen; the line you're tuning scrolls into view above it, and every button is a 44px target.
- **Change the grammar here**, at the bottom of a word's picker, changes the grammar itself right where you're tuning, without a trip to the library:
  - **Words**: add a word to this slot (with its register, and the mood, starting word or pronouns the slot needs; the word bank's checks say as you type whether it can go in), or **Never offer ‘uncle’ again**. A retired word stays in pieces that already have it, so old links still read the same; **↺** brings it back.
  - **This word**: its register, mood, starting word, pronouns and free tags (*family*, *work*: Sideways prefers words that share one).
  - **Slots**: this slot's starting words, where it has them (*the*, *a*, *my*); the card's optional slots, with **Remove**; and new optional slots around the head word: a describing word before it, a detail after it, or a relation (*your uncle* → *your uncle's dentist*, then **Zoom out** or the `+ relation` chip uses it).

  Editing a built-in, shared or space grammar makes your own copy first (*Story Bits (yours)*) and switches to it with the piece as it was, so nothing on screen changes except the edit; the sheet says so the first time. Every edit is one step on the timeline (the copy included) and a version of your grammar: ⌘Z, the bottom bar's Undo, or **Undo** right in the sheet takes it back. In a together jam editors' changes go to everyone as a whole-grammar change; commenters and viewers don't see the section, and it's hidden in a challenge or workshop (it isn't a move).
- **Tap the rest of a sentence** to tune that line (the beat) the same way.
- **Ghost slots**: with a word selected, dashed `+ adverb` / `+ clause` chips show where an optional word can go.
- **Nesting**: some words hold a whole phrase of another card (*blames …*, *brought back from …*), tunable inside. Hover a word to see which phrase it belongs to.
- **Form and length**: each grammar has forms (a funny story as *The bit*, *Local news*, *Wedding toast*, *Complaint to the manager*; a poem as *Couplets* or *Refrain*; a saying on a pillow sampler or in a fortune cookie). Grow the piece a stanza at a time; earlier lines stay put.
- **The dial** sets how much the parts disagree. What disagreement means is the grammar's call (below).
- **Word bank**: your own words, per grammar, kept in this browser. They show up in shuffles and the picker and travel inside links. *Copy pack link* shares them.
- **The kept shelf**: every grammar says what's worth keeping and what its shelf is called: Story Bits keeps characters (*The cast*), Small Poems images, Sayings its suspects, Just-so stories creatures, Hinge prompts your answers. **More → Keep this…** (**k**) shelves the phrase with the headline it was in; **Tell another** pins it and shuffles everything else.
- **Links** carry the whole piece: every word (yours too), the grammar (inline if it's yours), form, tuned lines, dial, length. Older links still open.

Nothing here needs an account, and nothing leaves your browser unless you share a link, open a jam, or put something in a space.

## Grammars

A grammar is one JSON document ([docs/design.md](docs/design.md) has the full model):

| part | what it is |
|---|---|
| `cards` | the pieces of a piece: *who, what happened, how they feel, where, thing*; or *image, motion, place, time* |
| `schemas` | each card's ordered word slots, like `[intensity] [quality] noun [clause]`, with word pools; slot flags for mood, determiners (`det`, or a whole `determiner` slot), pronouns, trailing clauses, `relation`s; pool words carry `tags` (word families, for Sideways) |
| `line` | the headline template: `{who} {what}, and {p} {is} {feel}.` |
| `forms` | shapes of a telling: stanzas of beats; each beat line tiered plain → strange |
| `rules` | what the dial clashes (pairs of cards, on **mood**, **register** or **sound**), whether forms must **land**, and **constraints** |
| `keep` | what's worth keeping: `{ card, name, verb }`, e.g. `{ card: "who", name: "The cast", verb: "Keep this character" }` |

Built in:

- **Story Bits**: the humor grammar. Event ↔ feeling clash on mood; place ↔ event and thing ↔ place on register; every form lands. *Who* is a small grammar of its own: whose (*your / his / someone's / a*…), a descriptor, a person, and optionally a relation that nests another who: *your uncle's dentist*, *your sister's ex's landlord*. The pronouns are the outer person's.
- **Small Poems**: an image, what it does, where, when. Image ↔ place clash on sound (alliteration fits), motion ↔ time on register. Nothing has to land. Forms render line by line; *Refrain* repeats its line like a ghazal.
- **Sayings**: advice, who it's about, and why: *Never trust a heron that knows your name, for it has already told the others.* Advice ↔ subject clash on register, advice ↔ reason on mood (a warning with a cheerful reason). Forms: the bare saying, *As grandmother said*, a pillow sampler, a fortune cookie with lucky numbers.
- **Just-so stories**: *Why the heron stands on one leg.* The old world, what it did, and how it's been ever since. Creature ↔ quirk clash on register, the deed ↔ *ever since* on mood (a punishment that's a reward). Every telling lands on *and that is why*. Forms: the tale, at bedtime (with questions), a field guide entry.
- **Hinge prompts**: a fixed dating-app prompt and the answer you tune: *My most irrational fear: geese.* Prompt ↔ answer clash on mood (the fear is warm bread). Forms: one prompt (with who liked it), a three-prompt profile, a classified ad (*Retired lighthouse keeper seeks someone to argue with about soup. Must love weather.*).

**Constraints**, Oulipo-style, filter what a grammar offers, so it can't produce a word that breaks them: a **lipogram** (no letter *e*, covering words, determiners and lines), **alliteration** (every word starts with a letter), **short words** (a syllable cap), or **closed** (no word bank).

The grammar makes pieces well-formed. Whether one works is up to the dial, the words, and you. `grammar.js` holds the checks (`checkEntry`, `checkForm`, `checkGrammar`) the page, the library, links and the pack tool all share.

### The library

Under **Grammars & spaces** on the page: **Fork** any grammar into your library, **Edit** your copy (basics, words per slot, beat lines, constraints, the dial, the landing rule, or the whole thing as JSON; every edit is checked before it saves; removing a word retires it, so pieces that use it keep it), **Copy link** to share it (the link offers it to whoever opens it, never adds it silently), or **Suggest** it for everyone.

## Jams

Open one with **Start a jam**. A jam is a shared session on the room server; everything else stays local.

- **Roles**, like a shared doc: the jam bar has an **edit link**, a **comment link** and a **view link**.
- **Together**: one shared piece. Editors tune it live (each change goes out per card and per line, so two people on different cards never collide); everyone sees who's looking at which word. Comments anchor to a word or a line, with the quoted text, and can be resolved.
- **Workshop**: the host starts everyone from the same piece; writers tune their own copies; the host reveals them side by side, changes highlighted, for critique: notes on each copy, and claps if the host turned them on. A move limit (or none) is the host's call too. With a limit and claps it's a game; without, it's a writers' workshop.

**Pass it around** is the same workshop without a server: a link everyone opens, versions sent back as links, compared on one page.

## Spaces

A **space** is a shared folder for a group, kept until you delete it: its grammars, word packs, kept pieces, kept shelves, **lore** (kept phrases), comments and jam history. Create one under **Grammars & spaces**; invite people with its edit, comment or view link, like a jam.

- **Grammars are versions.** Publishing an edit adds version *n + 1*; nothing is overwritten, and a piece kept with version 1 still opens in version 1 (*Open in v3* moves it, if its words still fit). Publishing from an old version, after someone else published, is refused rather than silently merged.
- **Side by side**: the Grammars list shows this browser's grammars next to each space's. *Fork to mine* copies one into your library; *Publish ↑* sends one of yours to a space (as the next version of what you forked, or as a new grammar).
- **Pieces, words, kept shelves**: keep the piece on the page in a space; put your word bank or shelf there; add a space's words or kept phrases to yours.
- **Lore**: tap a word, then *Keep as lore*, to keep the phrase it's in. Lore can be dropped back into a piece; in a workshop, a copy that brings back a kept phrase is marked as a **callback**. Lore and the shelf hold the same thing (a card's phrase): lore is the group's and takes any card; your shelf takes the grammar's keep card and remembers headlines. A lore phrase on that card has a *Keep* button that puts it on your shelf.
- **Jams in a space**: *Start a jam here* (or *Open in a space* from a jam's bar). Everyone in the jam gets the space's grammars and lore through the jam, without its keys; kept phrases and finished rounds go back to the space.
- **Public spaces** are how things get published: anyone with the id can view (never change) them. A grammar's link becomes `#sp=K7Q2M9XA/its-id` instead of a 13 KB `#grammar=` link, and a piece made with a public space's grammar links by version instead of carrying the grammar.
- **Export** saves a whole space, every version included, to a file; *Make one from an exported file* restores it as a new space.

Your spaces and their keys are listed in this browser only. Every client checks what a space sends with the same checks links use.

## What's stored

- **In your browser** (localStorage): your grammars and their versions (stored as what changed from one to the next), drafts, word bank, kept shelf (`story-bits-kept`; the older `story-bits-cast` is copied over once and left as it was), nickname, the list of spaces you've joined with their invite keys, which sections are open, whether you've seen the first-run hint, whether part labels show (and how many words you've tuned, up to a few), and the piece you had before your last reload. Nothing else, and nothing leaves unless you share a link, open a jam, or put something in a space.
- **In a jam** (its own storage on Cloudflare): the shared piece, comments (with nicknames), finished workshop rounds (the start, each copy, notes, claps; up to 50), and, if it's in a space, that space's id and name and a copy of its grammars, lore and cast. How long it's kept is the host's call: a month or a year after it's last used, or until the host deletes it (a year by default). The host can wipe its history and comments, or delete the whole jam, any time.
- **In a space** (its own storage on Cloudflare): its name and keys, grammars (every version), word packs, kept pieces, cast, lore, comments (with nicknames), and a summary of each linked jam's rounds (names and winners). Up to 6 MB. How long it's kept is the owner's call: **until they delete it** (the default), or a year or a month after it's last used; choosing a time asks first, and the space shows the date it would go, highlighted near the end. The owner can delete it any time, and export it first.

No accounts, emails or IPs anywhere. Only allowed pages can reach jams and spaces.

## Growing the built-in bank

Publishing is a public space now. The GitHub route below is only for curating what ships **built in** for everyone.

**Suggest for everyone** (on your word bank or a grammar) opens a pre-filled GitHub issue. When a maintainer adds the `accepted-pack` label, [`word-pack.yml`](.github/workflows/word-pack.yml) runs [`tools/accept-pack.mjs`](tools/accept-pack.mjs): it checks every grammar, word and form with the same checks the page uses, skips anything taken, writes `packs/issue-<n>.json`, adds it to `packs/index.json`, and opens a pull request. Merge it and it ships.

- Packs can hold `grammars`, `words` (each with its grammar `g`), and `forms` (for `pack.grammar`).
- `packs/index.json` is append-only: old links depend on word positions in built-in and shared grammars.
- The workflow needs *Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests*.

## Run it

No build step. Plain HTML/CSS/JS, loaded in this order: `data.js` (built-in grammars), `grammar.js` (checks), `engine.js` (phrases, the dial, beats, snapshots and links; no DOM), `timeline.js` (the undo timeline, grammar versions, drafts and step labels; no DOM), `grammar-ops.js` (grammar edits: words, slots, tags, fork-on-write, piece remap; no DOM), `edit-plan.js` (what the picker's grammar section offers; no DOM), then the page: `library.js`, `history.js` (the timeline's stores and the History sheet), `picker-edit.js` (the picker's *Change the grammar here*), `jam.js`, `spaces.js`, then the page's own code split by concern: `ui-core.js` (`$`, toast, copy, stored values, library storage), `render.js` (the piece, headline, story, part labels), `picker.js` (word actions, the sheet, moves and previews), `controls.js` (folds, menus, first-run hint, reload, grammar/form/length), `game.js` (challenges, passing copies, compare), `bank.js` (word bank, kept shelf, packs), and `app.js` (event wiring and boot).

```bash
python3 -m http.server 4290
```

Engine tests (Node 22+, no dependencies) load `data.js`, `grammar.js`, `engine.js` and `timeline.js` in a vm and cover generation for every grammar, form, length and dial setting, the dial's clashes, constraints (every built-in grammar's required slots keep at least three words under no-*e*, alliteration on *s* and a two-syllable cap; Story Bits' older pools are listed as known gaps), the kept shelf (keep, migration from the cast, *Tell another*), v1–v4 link round-trips, `checkGrammar`, nested phrases, escaping, history (the timeline, grammar versions and their storage, pinned versions, drafts, step labels), grammar edits (every op, tombstones, forks, piece remaps) and the picker's grammar section (who sees it, its offers, the add form's checks, one step per fork and edit). Every test runs over every built-in grammar, so a new one is covered by adding it. CI (`.github/workflows/test.yml`) runs them and `node --check` on every script, on every push and pull request:

```bash
node --test test/*.test.mjs
```

Jams and spaces run on `party/`, a [partyserver](https://github.com/cloudflare/partykit/tree/main/packages/partyserver) Durable Object (Cloudflare's successor to PartyKit):

```bash
cd party && npm install
npm run dev        # local jams and spaces on :8799 (the page uses them when served from localhost)
npm test           # end to end: jams (roles, together, comments, workshop, retention) and spaces
                   # (keys, versions, items, lore, public, export, jams in a space, delete)
npm run deploy     # then set ROOMS_PROD in jam.js to the printed workers.dev host
```

Test a pack locally:

```bash
BODY="$(cat issue-body.md)" NUMBER=1 node tools/accept-pack.mjs
```
