# Story Bits

Five things, mad-lib style: **something happened to someone, and they feel some way about it.**

> your uncle just got his boating license and he's really excited about it

Live: https://reeswrites.github.io/story-bits/

## How it works

- **Five bits**: who, what happened, how they feel, where, and a thing. Click a card to reroll it; lock the ones you like.
- **Incongruity dial**: *Plausible* matches the feeling to the event. *Absurd* deliberately mismatches them and pulls from stranger pools. Then every story lands somewhere safe, because a funny story is an incongruity that resolves into something it's OK to laugh at.
- **The cast**: keep a bit and its character joins your cast. Tell more stories about the same person and they turn into a character you could play.
- **Share**: the URL hash encodes the five picks, the dial, and the story seed, so a link reproduces the exact story.

No build step, no API, no tracking. Plain HTML/CSS/JS; the cast lives in your browser's localStorage. Add to the pools in `data.js`.

## Run locally

```bash
python3 -m http.server 4290
```
