# Story Bits

**Write with a grammar, word by word.** Tune a piece from plain to strange, one word or line at a time, in a grammar you can swap, fork and share. Alone and local-first by default; open a jam when you want company.

> your uncle just got his boating license and he's really excited about it

Live: https://reeswrites.com/story-bits/ · Design notes: [docs/design.md](docs/design.md)

Story Bits began with one rule for funny stories, from a note: *something happened to someone, and they feel some way about it*, and a funny story is an incongruity that lands somewhere it's safe to laugh. That rule is now one grammar. Poems are another. Make your own.

## The page

It opens calm: the piece, one hint (*tap any word*), and **Shuffle**. The first time, one headline word pulses gently under a *tap to change* bubble. Everything else is one step away.

**Mad-lib blanks.** Every word you can change sits on a dotted line, like the blank on a Mad Libs page. Each card keeps its own (muted) color, and in the headline a small label under each phrase names the part from the grammar (*Who*, *What happened*, *How they feel*; *Image*, *Motion*, *Place*, *Time*), with *thing, inside* for a nested phrase. Labels show on a first visit and fade after a few tunes; **Show parts** in Rules turns them on or off. Pins, comments and someone else's cursor keep their own marks; the picker says what each mark means.

**Reload starts fresh.** Reloading a plain piece link makes a new piece in the same grammar, form, length and dial; the one you had is kept, and **Back to your last piece** offers it for ten seconds. A link opened any other way opens exactly, and jams, challenges, copies, compares, grammars, spaces, packs and today's bit never change on reload.

Everything else:

- **Rules** (above the piece) holds the grammar, form, length, the dial, the pairs it clashes, and *Reroll one card*.
- **With others** has *Start a jam*, *Pass it around* and *Today's bit*.
- **More** (next to Shuffle) has *Retell*, *Keep this character* and *Copy link*.
- **↶ ↷** undo and redo appear once there's something to undo (also **⌘Z** / **Ctrl+Z**, **⇧⌘Z** / **Ctrl+Shift+Z**). Undo covers words, lines, form, length, the dial and the grammar. In a together jam an undo goes out like any other edit and only puts back what you changed; in a challenge it counts like putting a change back.
- **Word bank**, **Grammars & spaces** and **The cast** fold away below the piece.

Which of these are open is remembered in this browser. In a jam or a challenge, its bar stays on the page.

**Keyboard and screen readers**: words are buttons named for what they are (*landlord, Who: person*); each sentence has a tune button that shows when focused. The picker is a dialog: focus moves into it, ← → step, Escape closes it and returns focus to the word; on a phone it's a modal sheet and Tab stays inside it. Small text holds 6:1 contrast or better; nothing is faded unless it's done (a resolved comment), and unavailable buttons are outlined dashed rather than greyed.

## Writing alone

- **Tap any word** to open it: **‹ ›** (or ← →) step it plain → strange, live; the full list grouped by register; *Surprise me*, *Pin* (shuffles keep it), *Remove*; or type your own.
- **Tap the rest of a sentence** to tune that line (the beat) the same way.
- **Ghost slots**: with a word selected, dashed `+ adverb` / `+ clause` chips show where an optional word can go.
- **Nesting**: some words hold a whole phrase of another card (*blames …*, *brought back from …*), tunable inside. Hover a word to see which phrase it belongs to.
- **Form and length**: each grammar has forms (a funny story as *The bit*, *Local news*, *Wedding toast*, *Complaint to the manager*; a poem as *Couplets* or *Refrain*). Grow the piece a stanza at a time; earlier lines stay put.
- **The dial** sets how much the parts disagree. What disagreement means is the grammar's call (below).
- **Word bank**: your own words, per grammar, kept in this browser. They show up in shuffles and the picker and travel inside links. *Copy pack link* shares them.
- **The cast**: in grammars with characters, keep one and tell more stories about them.
- **Links** carry the whole piece: every word (yours too), the grammar (inline if it's yours), form, tuned lines, dial, length. Older links still open.

Nothing here needs an account, and nothing leaves your browser unless you share a link, open a jam, or put something in a space.

## Grammars

A grammar is one JSON document ([docs/design.md](docs/design.md) has the full model):

| part | what it is |
|---|---|
| `cards` | the pieces of a piece: *who, what happened, how they feel, where, thing*; or *image, motion, place, time* |
| `schemas` | each card's ordered word slots, like `[intensity] [quality] noun [clause]`, with word pools; slot flags for mood, determiners, pronouns, trailing clauses |
| `line` | the headline template: `{who} {what}, and {p} {is} {feel}.` |
| `forms` | shapes of a telling: stanzas of beats; each beat line tiered plain → strange |
| `rules` | what the dial clashes (pairs of cards, on **mood**, **register** or **sound**), whether forms must **land**, and **constraints** |

Built in:

- **Story Bits**: the humor grammar. Event ↔ feeling clash on mood; place ↔ event and thing ↔ place on register; every form lands.
- **Small Poems**: an image, what it does, where, when. Image ↔ place clash on sound (alliteration fits), motion ↔ time on register. Nothing has to land. Forms render line by line; *Refrain* repeats its line like a ghazal.

**Constraints**, Oulipo-style, filter what a grammar offers, so it can't produce a word that breaks them: a **lipogram** (no letter *e*, covering words, determiners and lines), **alliteration** (every word starts with a letter), **short words** (a syllable cap), or **closed** (no word bank).

The grammar makes pieces well-formed. Whether one works is up to the dial, the words, and you. `grammar.js` holds the checks (`checkEntry`, `checkForm`, `checkGrammar`) the page, the library, links and the pack tool all share.

### The library

Under **Grammars & spaces** on the page: **Fork** any grammar into your library, **Edit** your copy (basics, words per slot, beat lines, constraints, the dial, the landing rule, or the whole thing as JSON; every edit is checked before it saves), **Copy link** to share it (the link offers it to whoever opens it, never adds it silently), or **Suggest** it for everyone.

## Jams

Open one with **Start a jam**. A jam is a shared session on the room server; everything else stays local.

- **Roles**, like a shared doc: the jam bar has an **edit link**, a **comment link** and a **view link**.
- **Together**: one shared piece. Editors tune it live (each change goes out per card and per line, so two people on different cards never collide); everyone sees who's looking at which word. Comments anchor to a word or a line, with the quoted text, and can be resolved.
- **Workshop**: the host starts everyone from the same piece; writers tune their own copies; the host reveals them side by side, changes highlighted, for critique: notes on each copy, and claps if the host turned them on. A move limit (or none) is the host's call too. With a limit and claps it's a game; without, it's a writers' workshop.

**Pass it around** is the same workshop without a server: a link everyone opens, versions sent back as links, compared on one page.

## Spaces

A **space** is a shared folder for a group, kept until you delete it: its grammars, word packs, kept pieces, cast, **lore** (kept phrases), comments and jam history. Create one under **Grammars & spaces**; invite people with its edit, comment or view link, like a jam.

- **Grammars are versions.** Publishing an edit adds version *n + 1*; nothing is overwritten, and a piece kept with version 1 still opens in version 1 (*Open in v3* moves it, if its words still fit). Publishing from an old version, after someone else published, is refused rather than silently merged.
- **Side by side**: the Grammars list shows this browser's grammars next to each space's. *Fork to mine* copies one into your library; *Publish ↑* sends one of yours to a space (as the next version of what you forked, or as a new grammar).
- **Pieces, words, cast**: keep the piece on the page in a space; put your word bank or cast there; add a space's words or characters to yours.
- **Lore**: tap a word, then *Keep as lore*, to keep the phrase it's in. Lore can be dropped back into a piece; in a workshop, a copy that brings back a kept phrase is marked as a **callback**.
- **Jams in a space**: *Start a jam here* (or *Open in a space* from a jam's bar). Everyone in the jam gets the space's grammars and lore through the jam, without its keys; kept phrases and finished rounds go back to the space.
- **Public spaces** are how things get published: anyone with the id can view (never change) them. A grammar's link becomes `#sp=K7Q2M9XA/its-id` instead of a 13 KB `#grammar=` link, and a piece made with a public space's grammar links by version instead of carrying the grammar.
- **Export** saves a whole space, every version included, to a file; *Make one from an exported file* restores it as a new space.

Your spaces and their keys are listed in this browser only. Every client checks what a space sends with the same checks links use.

## What's stored

- **In your browser** (localStorage): your grammars, word bank, cast, nickname, the list of spaces you've joined with their invite keys, which sections are open, whether you've seen the first-run hint, whether part labels show (and how many words you've tuned, up to a few), and the piece you had before your last reload. Nothing else, and nothing leaves unless you share a link, open a jam, or put something in a space.
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

No build step. Plain HTML/CSS/JS, loaded in this order: `data.js` (built-in grammars), `grammar.js` (checks), `engine.js` (phrases, the dial, beats, snapshots and links; no DOM), then the page: `library.js`, `jam.js`, `spaces.js`, `app.js`.

```bash
python3 -m http.server 4290
```

Engine tests (Node 22+, no dependencies) load `data.js`, `grammar.js` and `engine.js` in a vm and cover generation for every grammar, form, length and dial setting, the dial's clashes, constraints, v1–v4 link round-trips, `checkGrammar`, nested phrases and escaping. CI (`.github/workflows/test.yml`) runs them and `node --check` on every script, on every push and pull request:

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
