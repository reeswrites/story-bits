# Story Bits

Five things, mad-lib style: **something happened to someone, and they feel some way about it.**

> your uncle just got his boating license and he's really excited about it

Live: https://reeswrites.com/story-bits/

## How it works

- **Five bits**: who, what happened, how they feel, where, and a thing. Click a card to reroll it; lock the ones you like.
- **Length**: start with just the bit (one line, three cards) and add a stanza at a time, up to five. Each step adds a beat and sometimes a new card; earlier lines stay put, so the story grows instead of rerolling. From two stanzas on, it always lands.
- **Incongruity, in pairs**: every card added brings a new pair that can fit or clash: event ↔ feeling (does the feeling match what happened?), place ↔ event, thing ↔ place (same register, or mundane next to absurd?). *Plausible* = no pair clashes, *Odd* = only the feeling clashes, *Absurd* = every pair in play clashes. The live chips show which. Then the story lands somewhere safe, because a funny story is an incongruity that resolves into something it's OK to laugh at.
- **Word by word**: the thing is built from tunable words: `[intensity] [quality] noun [clause]`, as in *a slightly wet dog that has a lawyer*. Click any word to reroll just that word; − / + drop or add a word. Each word has its own register, and the thing counts as its strangest word, so swapping "quiet" for "sentient" can flip thing ↔ place from fits to clashes.
- **The cast**: keep a bit and its character joins your cast. Tell more stories about the same person and they turn into a character you could play.
- **Share**: the URL hash encodes the five picks, the dial, the length, and the story seed, so a link reproduces the exact story.

No build step, no API, no tracking. Plain HTML/CSS/JS; the cast lives in your browser's localStorage. Add to the pools in `data.js`.

## Run locally

```bash
python3 -m http.server 4290
```
