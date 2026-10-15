# Design: grammars, library, jams

Story Bits started as a humor generator. It is now an instrument for writing with grammars: you tune a piece word by word, alone, in your browser; when you want company, you open
a jam. This note records the model and the decisions behind it.

## Principles

- **Single-player and local-first by default.** No account. Your grammars, word bank and cast
  live in your browser; a piece lives in its link. Nothing touches a server unless you open a jam.
- **Selection and recombination, not a blank page.** You choose among supplied words and lines,
  step them plain → strange, and add your own when the supply runs out.
- **Game-ness emerges from collaboration.** Move limits, claps and winners are optional rules a jam
  can switch on, not the default.

## Grammar

A grammar is one shareable, forkable JSON document:

| part | what it is |
|---|---|
| `cards` | the pieces of a piece (story: who, what happened, how they feel, where, thing) |
| `schemas` | each card's ordered word slots (`[intensity] [quality] noun [clause]`) and their word pools; slot flags: `opt`, `needs`, `mood`, `det`, `pronouns`, `trailing` |
| `line` | the headline: a template over cards and pronouns (`{who} {what}, and {p} {is} {feel}.`) |
| `forms` | shapes of a telling: stanzas that bring in cards and fill paragraphs with beats; beat lines are tiered plain → strange |
| `rules` | what the dial means: which card pairs can clash and on what (`mood`, `register`, `sound`), whether every form must land, and word constraints |

Story Bits' humor model is the `story-bits` grammar's rules: event/feeling clash on mood,
place/event and thing/place clash on register, and every form must land. Poetry is another grammar
with other rules (clash on sound and register, no landing). The engine doesn't know about humor.

**Constraints** restrict what a word slot (or the whole grammar) accepts, in the Oulipo spirit:
a lipogram (no letter *e*), alliteration (all words start with the same letter), a syllable cap,
or a closed word set. They filter the options the picker and shuffles draw from, so a constrained
grammar can't produce a word that breaks it.

**Nesting** is any word whose text names a card (`blames {thing}`): that word holds a whole phrase
of that card, tunable the same way, to `maxDepth`.

## Library

Local-first list of grammars: the built-ins plus anything you fork, write or import. Fork copies a
grammar with `forkedFrom`; edits stay in your browser. Share is a link carrying the grammar;
opening it offers to add it to your library. Grammars can also be published to the shared bank
through the same issue → `accepted-pack` → PR pipeline as words.

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

## What's stored

In your browser: grammars you've added, your word bank, your cast. In a jam: the room's piece,
grammar, comments and rounds, in that room's storage in our Cloudflare account; nicknames only; a
room deletes itself after 30 days without activity; the host can wipe it sooner.

## Status (2026-10-15)

Built: grammar documents and checks (`grammar.js`), Story Bits and Small Poems, constraints
(lipogram, alliteration, syllable cap, closed), the library (fork, edit, share, import, suggest),
jams with roles, together mode, presence, comments, and workshop rounds with optional move limits,
claps and critique notes. Packs carry grammars, words and forms.

Next: a data API for publishing and browsing grammars and packs; lore that carries across jams.
