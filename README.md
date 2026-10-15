# Story Bits

**Something happened to someone, and they feel some way about it.** A mad-lib story generator you tune word by word.

> your uncle just got his boating license and he's really excited about it

Live: https://reeswrites.com/story-bits/

## How it works

- **Tune in the sentence.** Every word in the bit and the story is a button. Tap one and the picker opens:
  - **‹ ›** (or ← →) step it from plain to strange, live.
  - The full list, grouped *plausible / odd / absurd*.
  - **Surprise me**, **Pin** (shuffles keep pinned words), **Remove** (optional words).
  - **Your own…**: type any word; it joins your word bank.
- **Ghost slots.** With a word selected, dashed `+ adverb` / `+ clause` chips appear exactly where an optional word can go in that phrase. Tap one to fill it.
- **Cards.** The colored chips above the bit (*who, what happened, how they feel, where, thing*) reroll one card at a time, keeping pins. The bit reads "*who* *what happened*, and they're *how they feel*."
- **Length.** Start with just the bit and add a stanza at a time, up to five. Earlier lines stay put, so the story grows instead of rerolling. From two stanzas on, it always lands.
- **Incongruity, in pairs.** Each card brings a pair that can fit or clash: event ↔ feeling (mood), place ↔ event and thing ↔ place (register). *Plausible* = none clash, *Odd* = only the feeling, *Absurd* = all. Then the story lands somewhere safe, because a funny story is an incongruity that resolves into something it's OK to laugh at.
- **Nesting.** Some words hold a whole thing (*blames …*, *run by …*, *that once swallowed …*), tunable the same way, up to two levels down (`MAX_DEPTH`). Hovering a word outlines the phrase it belongs to.
- **The cast.** Keep a bit and its character joins your cast; tell more stories about them and they become someone.
- **Links.** The URL carries every word (yours included), the dial, the length, the seed and your pins.

## The grammar

`data.js` (`SCHEMAS`) is a small generative grammar. Each card is a phrase of ordered slots:

| card | slots | e.g. |
|---|---|---|
| who | `[descriptor] person` | *your recently retired uncle* |
| what happened | `[adverb] event [detail]` | *accidentally got banned from a Costco on live local television* |
| how they feel | `[intensity] feeling [aftertaste]` | *quietly furious and blames …* |
| where | `[intensity] [quality] place [clause]` | *a very haunted Olive Garden two towns over* |
| thing | `[intensity] [quality] noun [clause]` | *a slightly wet dog that has a lawyer* |

Words carry features: a register (tier 0–2) on every word, a mood on events and feelings, a determiner on people and places, pronouns on people. The rules that keep sentences well-formed are stated, not hand-tuned:

- a slot with `needs` only appears alongside what it needs (no *very* without a quality; no *really* before *drafting a memoir*);
- a thing nested inside a noun's clause takes no clause of its own, so every trailing clause belongs to exactly one noun;
- things nest at most `MAX_DEPTH` deep; a/an and pronoun agreement are computed.

`grammar.js` states what each slot accepts (`SLOT_INFO`: a test frame like *"a ___ dog"* and a hint) and the check every word must pass (`checkEntry`). The page and the pack tooling share it, so a word that's valid in your bank is valid for everyone.

The grammar guarantees well-formed, not funny. Funny is the dial's job, and the words'.

## Word bank

- **Yours.** Add words in the *Word bank* section (with a live preview in the slot's frame) or by typing your own in any picker. They live in your browser, show up in shuffles and pickers, and travel inline inside story links.
- **Share a pack.** *Copy pack link* gives a `#pack=…` URL. Opening it adds those words to the opener's bank.
- **Grow the shared bank.** *Suggest for everyone* opens a pre-filled GitHub issue with your words as JSON. When a maintainer adds the `accepted-pack` label, [`word-pack.yml`](.github/workflows/word-pack.yml) runs [`tools/accept-pack.mjs`](tools/accept-pack.mjs): it checks every word against the grammar, drops duplicates, writes `packs/issue-<n>.json`, adds it to `packs/index.json`, and opens a pull request. Merge it and the words ship to everyone.

  Packs load in `packs/index.json` order and are appended to the pools, so keep that list append-only; old links depend on word positions.

  The workflow needs *Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests*.

### Later

- A small data API for packs (publish, browse, subscribe), so sharing doesn't need a long URL or an issue.
- Votes on suggested words, and per-pack toggles in the picker.

## Run locally

No build step, no tracking. Plain HTML/CSS/JS.

```bash
python3 -m http.server 4290
```

Test a pack locally:

```bash
BODY="$(cat issue-body.md)" NUMBER=1 node tools/accept-pack.mjs
```
