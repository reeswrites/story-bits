# Story Bits

Five things, mad-lib style: **something happened to someone, and they feel some way about it.**

> your uncle just got his boating license and he's really excited about it

Live: https://reeswrites.com/story-bits/

## How it works

- **Cards**: who, what happened, how they feel, where, and a thing. The bit reads "*who* *what happened*, and they're *how they feel*." ↻ rerolls a card, and the lock keeps it.
- **Length**: start with just the bit (one line, three cards) and add a stanza at a time, up to five. Each step adds a beat and sometimes a new card; earlier lines stay put, so the story grows instead of rerolling. From two stanzas on, it always lands.
- **Incongruity, in pairs**: every card added brings a new pair that can fit or clash: event ↔ feeling (does the feeling match what happened?), place ↔ event, thing ↔ place (same register, or mundane next to absurd?). *Plausible* = no pair clashes, *Odd* = only the feeling clashes, *Absurd* = every pair in play clashes. The live chips show which. Then the story lands somewhere safe, because a funny story is an incongruity that resolves into something it's OK to laugh at.
- **Word by word**: every card is a phrase of tunable words. Click any word to reroll only that word; − / + drop or add one.
  - who: `[descriptor] person`: *your recently retired uncle*
  - what happened: `[adverb] event [detail]`: *accidentally got banned from a Costco on live local television*
  - feeling: `[intensity] feeling [aftertaste]`: *quietly furious and blames …*
  - where: `[intensity] [quality] place [clause]`: *a very haunted Olive Garden two towns over*
  - thing: `[intensity] [quality] noun [clause]`: *a slightly wet dog that has a lawyer*
- **Nesting**: some words hold a whole thing (*blames {thing}*, *run by {thing}*, *that once swallowed {thing}*). The nested thing shows as a dashed box and tunes the same way, including its own − / +. It can nest again, two levels down (`MAX_DEPTH` in `data.js`). The grammar could recurse forever; the cap is there because each layer dilutes the joke.
- **Registers**: every word has a tier (plausible / odd / absurd), and a phrase counts as its strangest word, nested ones included. That's what the pairs measure, so swapping one word can flip a pair from fits to clashes.
- **The cast**: keep a bit and its character joins your cast. Tell more stories about the same person and they turn into a character you could play.
- **Share**: the URL hash encodes every word, the dial, the length, and the story seed, so a link reproduces the exact story.

No build step, no API, no tracking. Plain HTML/CSS/JS; the cast lives in your browser's localStorage. Add words to the pools in `SCHEMAS` in `data.js`.

## Run locally

```bash
python3 -m http.server 4290
```
