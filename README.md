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
- **Beats.** The rest of each sentence is tunable too: tap the plain part of a story sentence to step that beat (*the turn*, *the landing*…) plain to strange, pin it, or send it back to the dice. Forms live in `FORMS` in `data.js`.
- **Forms.** The same bit can be told as *The bit*, *Local news*, *Wedding toast* or *Complaint to the manager*. Each form has its own beats and lengths, and every form lands: `checkForm` in `grammar.js` rejects any stanza whose last paragraph has no landing beat.
- **Today's bit.** One story per day (UTC), the same for everyone: generated from the date alone (no personal word banks), forms rotating daily, played as a 3-move challenge. `#daily` links straight to it.
- **Challenge friends.** *Challenge friends* makes a link: everyone gets the same story and the same few moves (a move is any word or beat that differs from the start; putting it back refunds it). Each player copies their version link back to the group; *Compare* takes a pasted pile of links (a group-chat dump works), shows every version against the original with changes highlighted, and lets the room clap-vote. *Copy compare link* shares the whole set. No server: every copy is a link (`#c=` challenge, `#p=` in progress, `#s=` finished, `#cmp=` a set).
- **Play live.** *Play live* opens a room (a short code like `RUREH`; share the invite link). The host sets up a story and starts a round; everyone tunes their own copy on their own phone and sends it; copies stay hidden until the host reveals them; then everyone gets 5 claps (never for their own) and the host shows results. Rounds are stored in the room, so it keeps a history of winners.
- **The cast.** Keep a bit and its character joins your cast; tell more stories about them and they become someone.
- **Links.** The URL carries every word (yours included), the form, tuned beats, the dial, the length, the seed and your pins. Links are versioned (`v: 2`); older links still load.

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

  Packs can carry **forms** too (`"forms": { "slug": { name, stanzas, beats } }`, same shape as `FORMS` in `data.js`). The tool runs `checkForm` on each and never reuses a taken slug, so links to a form keep meaning the same thing.

  Packs load in `packs/index.json` order and are appended to the pools, so keep that list append-only; old links depend on word positions.

  The workflow needs *Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests*.

## Live rooms

`party/` is the room server: one [partyserver](https://github.com/cloudflare/partykit/tree/main/packages/partyserver) Durable Object per room code on Cloudflare Workers (partyserver is Cloudflare's successor to PartyKit). The room is the single authority on phase, host and claps. It never interprets stories: challenges and copies are size-capped JSON, and every client checks them with the same parsers it uses for links.

**What's stored**, in the room's own storage in this Cloudflare account: the current round, and up to 50 finished rounds (the challenge, each copy with its nickname and clap count). No accounts, emails or IPs. A room deletes itself after 30 days without activity, and the host can wipe its history from the room bar. Only pages listed in `ALLOWED_ORIGINS` (plus localhost) can open a room.

```bash
cd party && npm install
npm run dev        # local rooms on :8799 (the page uses them when served from localhost)
npm test           # end-to-end: a full round, claps, history, host handoff, origin check
npm run deploy     # then set ROOMS_PROD in app.js to the printed workers.dev host
```

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
