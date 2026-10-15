# Security review: jams, spaces and what they put on the page

Reviewed 2026-10-15, at commit 4aee18a ("Escape grammar text everywhere; reject markup in grammars").
Scope: the room server (`party/src/server.js`, the jam `StoryRoom`; `party/src/space.js`, the
space `StorySpace`), the clients `src/collab/jam.js` and `src/collab/spaces.js`, and how `src/ui/app.js` and `src/collab/library.js`
render anything that came from a jam, a space or a link.

The threat model: Story Bits has no accounts. Access is by keys in links, a jam's code is enough
to watch it, and a public space's id is enough to read it. So anyone may hold a code or a view
link, links get forwarded, and anything a jam, a space or a link sends is untrusted. The page
runs on reeswrites.com, so script injected into it runs on Rees's site.

Line numbers below are at 4aee18a. Every finding is fixed in the commit that adds this file;
tests are in `party/test/security.test.mjs` (plus updates to `rooms.test.mjs` and
`spaces.test.mjs`).

## Findings

| # | Severity | Where | What |
|---|---|---|---|
| 1 | Critical | `party/src/server.js:200`, `:122` | Anyone can become a jam's host by copying the owner's id |
| 2 | High | `src/ui/app.js:283`, `src/ui/app.js:297` | Markup injection through grammar slot names in attributes |
| 3 | High | `src/core/grammar.js:228`, `src/collab/library.js:206` | Constraint settings go unchecked into the grammar editor's inputs |
| 4 | Medium | `party/src/space.js:114`, `:335` | Public spaces (and jams in a space) hand out jam codes |
| 5 | Medium | `src/collab/jam.js:21` | Jam codes are short enough to guess, and a code is a view key |
| 6 | Medium | `party/src/server.js:200` | Viewers can fill a jam so its writers can't join; one connection can add many people |
| 7 | Medium | `party/src/server.js:191`, `party/src/space.js:129` | No rate limits: message floods, comment spam, scripts opening jams and spaces in bulk |
| 8 | Medium | `party/src/server.js:149`, `:340`; `party/src/space.js:316`, `:371` | Stored values can outgrow what a Durable Object value holds, breaking the jam or space |
| 9 | Low | `party/src/server.js:351`; `party/src/space.js:165`, `:290` | Retention accepts inherited names (`"toString"`) |
| 10 | Low | `party/src/server.js:244`, `:320`, `:268` | Patches, claps and notes accept `__proto__` keys |
| 11 | Low | `party/src/server.js:170`, `:157`, `:354`; `party/src/space.js:84` | Retention paths: unjoined jams kept forever; delete/alarm leave the alarm and open connections |
| 12 | Low | `src/collab/spaces.js:139`, `src/collab/spaces.js:46`; `party/src/space.js:134` | Space keys and comment ids travel in URLs |
| 13 | Info | `src/collab/jam.js:372`, `src/ui/app.js:87` | Defense in depth: one unescaped server value; `esc` didn't escape `'` |

### 1. Critical: anyone can become a jam's host by copying the owner's id

A connection's identity was the `pid` it sent in `hello`, and the jam sent every pid to everyone:
`room.owner`, `room.host`, `players[].id`, `presence[].pid`, `comments[].pid`. A viewer with no
key could send `hello` with the owner's pid; `fixHost` then made that pid host (the owner "is
here"), and `isHost` is `pid === r.host`. So a keyless viewer could delete the jam, change its
retention, forget its history, switch modes, run rounds, link it to a space, and delete anyone's
comments. A connection could also change its pid with a second `hello`.

**Fix.** The pid a page sends is now a secret. The jam only ever sends out `publicId(pid)`, a
SHA-256 of it (`server.js` `publicId`), and keys players, owner, host, comments, copies and claps
by that. Sending a public id as your pid just hashes to some other id. A connection keeps the id
it first said hello with. Jams stored before this are migrated on load (`migrateIds`). The client
compares against `you.pid` (`jamMe()` in `src/collab/jam.js`) instead of its own pid. Residual: in a jam
created before this fix, someone who was in it and saw the owner's raw pid could still claim it.
Those jams are a day old at most.

### 2. High: markup injection through grammar slot names

`checkGrammar` now rejects `<` and `>`, but slot names may contain `"`, and two places put them
in an attribute unescaped: the ghost "add a …" button's `title` (`src/ui/app.js:283`) and each word's
`aria-label` (`src/ui/app.js:297`). A grammar from a link, a jam or a space with a slot named
`" onfocus=eval(name) x="` adds an event handler to every word button: script on reeswrites.com
when the word gets focus (a click or a tab). Grammars legitimately contain double quotes
(the built-ins do), so rejecting them isn't the fix.

**Fix.** Both are escaped. `esc` now also escapes `'`.

### 3. High: constraint settings go unchecked into the grammar editor

`checkGrammar` checked only each constraint's `type`. `maxSyllables.n` is rendered unescaped into
the editor's `<input value="…">` (`src/collab/library.js:206`); a shared grammar with
`n: "\" autofocus onfocus=… x=\""` runs script when you open it in the editor. `letters` and
`letter` were escaped there but went unchecked into the word filter.

**Fix.** `checkGrammar` requires `lipogram.letters` to be 1–10 letters, `startsWith.letter` one
letter, and `maxSyllables.n` an integer 1–6. The editor rounds what's typed.

### 4. Medium: public spaces hand out jam codes

A space's view included its jam history (`jams[].code`) and each lore entry's `jam` code, for
every role, including anyone reading a public space by its id. A jam code is enough to watch the
jam (no key needed): its piece, comments with nicknames, and workshop history. The same codes
went to everyone in any jam linked to the space (`context()` lore), so one jam's viewers learned
the others'.

**Fix.** Only comment, edit and owner keys see jam codes. Viewers (keyed or public) get the jam
history without codes, and lore without its `jam`. Jams never get other jams' codes.

### 5. Medium: jam codes were guessable

New jam codes were 5 characters from a 31-letter alphabet (28.6 million), and a code is all a
viewer needs. Trying codes is one WebSocket each.

**Fix.** New codes are 8 characters (8.5 × 10^11); existing 4–8 character codes still work.
Opening connections is rate limited per address (finding 7).

### 6. Medium: viewers could fill a jam

`MAX_PLAYERS` (24) counted everyone, including keyless viewers, and nobody was ever removed, so
anyone with the code could fill a jam with 24 viewers (or one connection sending 24 `hello`s with
different pids) and lock out the people with edit and comment links. Connections were unlimited.

**Fix.** People with keys and viewers have separate room (24 and 40). When one kind is full, the
longest-gone person of that kind who isn't the owner and has no copy in the round makes way. One
person per connection. At most 80 connections.

### 7. Medium: no rate limits

Nothing limited how fast a connection could send. Every `presence`, `name` or comment is a
broadcast to everyone (and most are a storage write), so one viewer could flood a jam; one
commenter could take all 400 comment slots. Nothing limited how many jams or spaces a script
could open.

**Fix.**
- Per connection, a token bucket (40, refilled 10 a second; comments, lore and space links cost
  4). Past it, messages are dropped and the sender is told once.
- At most 100 comments per person in a jam.
- Per address, Cloudflare's rate limiter: 60 jam connections a minute, 400 space requests a
  minute (an import makes one per item). It counts in memory where the request lands, for a
  minute; nothing about an address is stored with a jam or space, so "no IPs stored" holds.

The Origin check stays: it keeps other sites' pages out, but any script can send any Origin, so
it is not a lock. Keys are the lock; the limits are what stop scripts.

### 8. Medium: stored values could outgrow a Durable Object value

The jam stores its room (piece, every copy, the start, comments) as one value and its rounds as
another. Copies are up to 240 KB each, 24 writers, so the room could pass 5 MB and the rounds
far more; once a write fails, every message that saves throws. In a space, lore (500 entries ×
8 KB phrases) and jam history (100 jams × 50 rounds) were single values that could pass the
limit too.

**Fix.** The jam refuses a piece, start or copy that would take the room past 1.5 MB, and tells
the sender; stored rounds drop the oldest past 1.5 MB. A space keeps lore phrases to 2 KB and the
whole lore list under 1 MB, rounds per jam to 20, and the jam history under 512 KB, dropping the
oldest.

### 9. Low: retention accepted inherited names

`m.value in RETAIN` is true for `"toString"`, `"constructor"` and the rest of `Object.prototype`.
A host (or a space's owner, or anyone creating a space) could set retention to `"toString"`;
the alarm time became `NaN`, the save threw, and the jam or space was left in a state that broke
every later save.

**Fix.** `Object.hasOwn` everywhere a client value picks a key (`own()` in both files).

### 10. Low: `__proto__` keys

A patch could set `b.__proto__` (the sub-key was unchecked), changing the prototype of the stored
piece's beats object; claps and notes could target `"__proto__"` because `r.entries[m.to]` finds
`Object.prototype`. No global pollution, but nonsense state.

**Fix.** Patch sub-keys must be 1–64 characters and not `__proto__`, `constructor` or
`prototype`; claps and notes need an own key.

### 11. Low: retention and delete paths

- A jam that someone opened but never joined stored its keys forever (the alarm was only set by
  later saves). Now it's dropped after 2 days unless someone joins.
- Delete-now and the retention alarm wiped storage but left the alarm set (harmless but
  untidy), and the alarm didn't close open connections, which kept working on an empty room.
  Both now go through one `wipe()`: alarm off, storage gone, everyone told and disconnected.
  The space's `wipe()` turns its alarm off too.
- After a delete, the next person to open the code gets a fresh jam with new keys; old links stop
  working. That's intended and now tested.

### 12. Low: keys in URLs

Space reads sent the key (`?k=`) and the comment id (`?pid=`) in the URL, which ends up in any
request log. Pages now read with POST ops (`get`, and a new `gv` for a grammar version), keys in
the body. GET still works for public spaces and for pages loaded before this change.

### 13. Info: defense in depth

`src/collab/jam.js:372` printed the jam's mode unescaped (the server only allows two values). Escaped.

## Checked and fine

- Role checks on every jam message and space op: viewers can't edit, comment, clap or keep lore;
  commenters can't edit or run rounds; only the host runs a round, changes settings or deletes;
  only a space's owner changes its settings or deletes it.
- Keys go only to people who can use them: jam keys to editors; space owner keys to the owner,
  the rest to editors. The jam never stores or relays a space's keys.
- Malformed JSON, non-objects, non-string types and oversized messages are dropped by both
  servers (now tested); every client parses what it receives with the same checks as links.
- Names, comments, lore, item and space names are rendered through `esc` (and `cleanWord`) in
  `src/collab/jam.js`, `src/collab/spaces.js`, `src/ui/app.js` and `src/collab/library.js`; toasts use `textContent`.
- Space comment authors aren't exposed (`pid` is stripped from views).
- Invite keys are 64 random bits; space ids 8 characters.

## Not changed (decisions for later)

- A jam's view is by code alone: there is no view key. With 8-character codes and rate limits
  that's reasonable for watching; if jams start holding things people want private, add a view
  key to the link.
- A space can't revoke a jam it was linked to except by deleting the jam: the jam keeps relaying
  the space's grammars, lore and cast to whoever is in it. Unlinking from the space side would be
  a small op on `jams`.
- `ALLOWED_ORIGINS` also allows any `localhost` origin in production, for development.
- The space server stores grammars without running `checkGrammar` on them; every client checks
  them before use. A server-side check would need the grammar code shared with the Worker.
