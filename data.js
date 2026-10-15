// Built-in grammars. A grammar is one document: cards, their word slots and pools, a headline
// line, forms (templates of beats), and rules (what the dial clashes, whether forms must land,
// word constraints). See docs/design.md. The engine in app.js knows nothing about any one grammar.
//
// This file holds "Story Bits", the humor grammar, and the poetry grammar(s) below it.
//
// Story Bits: every card is a phrase built from words, each tunable on its own. Each word carries
// a tier (0 = plausible, 1 = odd, 2 = absurd); a phrase's register is its strangest word. Event and
// feeling cores also carry a mood (+1 good, 0 mixed, -1 bad). The dial makes pairs of cards fit or
// clash on these, and every form lands.
//
// Phrases nest: a word whose text names a card ({thing}) holds a whole phrase of that card,
// tunable the same way, up to the grammar's maxDepth.
// Pronoun tokens in word text: {p} {o} {pos} {is} {has} {was} {s}.

const HE = { p: "he", o: "him", pos: "his", is: "is", has: "has", was: "was", s: "s" };
const SHE = { p: "she", o: "her", pos: "her", is: "is", has: "has", was: "was", s: "s" };
const THEY = { p: "they", o: "them", pos: "their", is: "are", has: "have", was: "were", s: "" };

// Parts are listed in reading order. opt: may be absent. needs: only present with that part
// ("adj": only if the head word takes one). grow: the order "+" adds optional parts.
// Every schema's head word is part "n". More slot flags are set in STORY_SLOTS below.
const STORY_SCHEMAS = {
  who: {
    parts: [
      { k: "d", name: "descriptor", opt: true, pool: [
        { t: "recently retired", tier: 0 }, { t: "newly single", tier: 0 }, { t: "very tall", tier: 0 },
        { t: "soft-spoken", tier: 0 }, { t: "perpetually tired", tier: 0 }, { t: "extremely punctual", tier: 0 },
        { t: "semi-retired", tier: 0 },
        { t: "suspiciously tan", tier: 1 }, { t: "formerly famous", tier: 1 }, { t: "aggressively cheerful", tier: 1 },
        { t: "conspiracy-minded", tier: 1 }, { t: "very online", tier: 1 },
        { t: "allegedly immortal", tier: 2 }, { t: "twice-knighted", tier: 2 }, { t: "recently resurrected", tier: 2 },
      ] },
      { k: "n", name: "person", pool: [
        { det: "your", t: "uncle", ...HE },
        { det: "your", t: "neighbor", ...SHE },
        { det: "your", t: "roommate", ...THEY },
        { det: "your", t: "grandmother", ...SHE },
        { det: "your", t: "dentist", ...HE },
        { det: "your", t: "old boss", ...SHE },
        { det: "your", t: "cousin Dale", ...HE },
        { det: "the", t: "guy from the coffee shop", ...HE },
        { det: "your", t: "landlord", ...THEY },
        { det: "your", t: "sister's ex", ...THEY },
        { det: "your", t: "mail carrier", ...SHE },
        { det: "your", t: "high school chemistry teacher", ...HE },
        { det: "your", t: "best friend's mom", ...SHE },
        { det: "the", t: "kid down the street", ...THEY },
        { det: "your", t: "aunt Lorraine", ...SHE },
        { det: "your", t: "barber", ...HE },
        { det: "your", t: "coworker in accounting", ...THEY },
        { det: "your", t: "yoga instructor", ...SHE },
        { det: "your", t: "dad", ...HE },
        { det: "your", t: "college roommate", ...THEY },
      ].map((x) => ({ ...x, tier: 0 })) },
    ],
    grow: ["d"],
  },

  // "<who> [adverb] core [tail]"
  what: {
    parts: [
      { k: "a", name: "adverb", opt: true, pool: [
        { t: "just", tier: 0 }, { t: "finally", tier: 0 }, { t: "recently", tier: 0 }, { t: "accidentally", tier: 0 },
        { t: "somehow", tier: 1 }, { t: "secretly", tier: 1 }, { t: "allegedly", tier: 1 }, { t: "once again", tier: 1 },
        { t: "ceremonially", tier: 2 }, { t: "posthumously", tier: 2 }, { t: "spiritually", tier: 2 },
      ] },
      { k: "n", name: "event", pool: [
        { t: "got {pos} boating license", v: 1, tier: 0 },
        { t: "lost {pos} dog", v: -1, tier: 0 },
        { t: "finished a 1,000-piece puzzle", v: 1, tier: 0 },
        { t: "got a parking ticket outside {pos} own house", v: -1, tier: 0 },
        { t: "won the office chili cook-off", v: 1, tier: 0 },
        { t: "got called for jury duty", v: 0, tier: 0 },
        { t: "started learning the accordion", v: 1, tier: 0 },
        { t: "replied-all to the entire company", v: -1, tier: 0 },
        { t: "beat {pos} personal record at the community pool", v: 1, tier: 0 },
        { t: "got asked to be a godparent", v: 1, tier: 0 },
        { t: "got {pos} wisdom teeth out", v: -1, tier: 0 },
        { t: "missed {pos} flight by eleven seconds", v: -1, tier: 0 },
        { t: "got a tattoo of a lighthouse", v: 0, tier: 1 },
        { t: "got mistaken for a minor local celebrity", v: 1, tier: 1 },
        { t: "got banned from a Costco", v: -1, tier: 1 },
        { t: "inherited a single, very old goose", v: 0, tier: 1 },
        { t: "got stuck in an elevator with a mime", v: -1, tier: 1 },
        { t: "lost a bet", v: -1, tier: 0 },
        { t: "won a perfect score on a radio trivia call-in", v: 1, tier: 1 },
        { t: "gave a toast at a stranger's wedding", v: 0, tier: 1 },
        { t: "grew a tomato shaped exactly like Ohio", v: 1, tier: 1 },
        { t: "found out {p} {was} adopted (by a different set of the same parents)", v: 0, tier: 2 },
        { t: "had {pos} sourdough starter declared a legal dependent", v: 1, tier: 2 },
        { t: "got elected treasurer of a club {p} never joined", v: 0, tier: 2 },
        { t: "discovered {pos} house is technically in another state", v: 0, tier: 2 },
        { t: "got hired to name a new shade of beige", v: 1, tier: 2 },
        { t: "received a strongly worded letter from a lighthouse", v: -1, tier: 2 },
        { t: "found a second, smaller fridge inside {pos} fridge", v: 0, tier: 2 },
        { t: "got demoted to assistant regional manager of nothing", v: -1, tier: 2 },
        { t: "got chosen by a swan", v: 0, tier: 2 },
      ] },
      { k: "t", name: "detail", opt: true, pool: [
        { t: "for the second time this year", tier: 0 }, { t: "in front of everyone", tier: 0 },
        { t: "on {pos} birthday", tier: 0 }, { t: "at age seventy", tier: 0 },
        { t: "thanks to {thing}", tier: 0 }, { t: "because of {thing}", tier: 0 },
        { t: "during a eulogy", tier: 1 }, { t: "on live local television", tier: 1 },
        { t: "with help from {thing}", tier: 1 },
        { t: "in a dream, but legally", tier: 2 }, { t: "while being followed by {thing}", tier: 2 },
      ] },
    ],
    grow: ["a", "t"],
  },

  // "and <p> <is> [intensity] core [tail]"
  feel: {
    parts: [
      { k: "i", name: "intensity", opt: true, needs: "adj", pool: [
        { t: "really", tier: 0 }, { t: "quietly", tier: 0 }, { t: "deeply", tier: 0 }, { t: "kind of", tier: 0 },
        { t: "unreasonably", tier: 1 }, { t: "suspiciously", tier: 1 }, { t: "weirdly", tier: 1 }, { t: "aggressively", tier: 1 },
        { t: "spiritually", tier: 2 }, { t: "legally", tier: 2 }, { t: "professionally", tier: 2 },
      ] },
      { k: "n", name: "feeling", pool: [
        { t: "excited about it", v: 1, tier: 0, adj: true },
        { t: "thrilled", v: 1, tier: 0, adj: true },
        { t: "proud", v: 1, tier: 0, adj: true },
        { t: "worried sick", v: -1, tier: 0, adj: true },
        { t: "embarrassed", v: -1, tier: 0, adj: true },
        { t: "furious", v: -1, tier: 0, adj: true },
        { t: "devastated", v: -1, tier: 0, adj: true },
        { t: "confused", v: 0, tier: 0, adj: true },
        { t: "calm about it", v: 0, tier: 0, adj: true },
        { t: "at peace", v: 0, tier: 0, adj: true },
        { t: "not sure how to feel", v: 0, tier: 0 },
        { t: "calling it the best day of {pos} life", v: 1, tier: 0 },
        { t: "pretending it doesn't bother {o}", v: -1, tier: 0 },
        { t: "hoping nobody brings it up at Thanksgiving", v: -1, tier: 0 },
        { t: "telling everyone it was {pos} plan all along", v: 1, tier: 1 },
        { t: "already planning the sequel", v: 1, tier: 1 },
        { t: "throwing a party about it", v: 1, tier: 1 },
        { t: "treating it like a personal betrayal", v: -1, tier: 1 },
        { t: "considering a lawsuit", v: -1, tier: 1 },
        { t: "refusing to discuss it before noon", v: -1, tier: 1 },
        { t: "certain it's a sign from the universe", v: 0, tier: 1 },
        { t: "humming about it constantly", v: 1, tier: 2 },
        { t: "in mourning, with a black armband and everything", v: -1, tier: 2 },
        { t: "keeping a candle lit until further notice", v: -1, tier: 2 },
        { t: "drafting a memoir", v: 0, tier: 2 },
      ] },
      { k: "t", name: "aftertaste", opt: true, pool: [
        { t: "but won't admit it", tier: 0 }, { t: "for reasons nobody understands", tier: 0 },
        { t: "in a way that worries the family", tier: 0 }, { t: "and {has} said so on Facebook", tier: 0 },
        { t: "and blame{s} {thing}", tier: 0 },
        { t: "and {has} started a podcast about it", tier: 1 },
        { t: "and {has} commissioned a portrait of {thing}", tier: 1 },
        { t: "and {has} been seen whispering to {thing}", tier: 2 },
      ] },
    ],
    grow: ["i", "t"],
  },

  // "[det] [intensity] [quality] place [clause]"
  where: {
    parts: [
      { k: "i", name: "intensity", opt: true, needs: "q", pool: [
        { t: "very", tier: 0 }, { t: "mostly", tier: 0 }, { t: "slightly", tier: 0 },
        { t: "weirdly", tier: 1 }, { t: "suspiciously", tier: 1 },
        { t: "legally", tier: 2 }, { t: "spiritually", tier: 2 },
      ] },
      { k: "q", name: "quality", opt: true, pool: [
        { t: "crowded", tier: 0 }, { t: "empty", tier: 0 }, { t: "fluorescent-lit", tier: 0 },
        { t: "freezing", tier: 0 }, { t: "sticky", tier: 0 }, { t: "suburban", tier: 0 },
        { t: "abandoned", tier: 1 }, { t: "haunted", tier: 1 }, { t: "candlelit", tier: 1 }, { t: "flooded", tier: 1 },
        { t: "underwater", tier: 2 }, { t: "self-aware", tier: 2 }, { t: "tax-exempt", tier: 2 },
      ] },
      { k: "n", name: "place", pool: [
        { det: "the", t: "DMV", tier: 0 },
        { det: "a", t: "Cracker Barrel off I-95", tier: 0 },
        { det: "the", t: "community pool", tier: 0 },
        { det: "a cousin's", t: "backyard barbecue", tier: 0 },
        { det: "the", t: "self-checkout at Home Depot", tier: 0 },
        { det: "a", t: "church rummage sale", tier: 0 },
        { det: "a", t: "laundromat", tier: 0 },
        { det: "an", t: "Olive Garden", tier: 0 },
        { det: "a", t: "wedding reception", tier: 0 },
        { det: "a", t: "corn maze", tier: 0 },
        { det: "a", t: "library", tier: 0 },
        { det: "a", t: "ferry to nowhere in particular", tier: 1 },
        { det: "the", t: "lost and found at the bowling alley", tier: 1 },
        { det: "a", t: "timeshare presentation", tier: 1 },
        { det: "a", t: "mattress store", tier: 0 },
        { det: "a", t: "lighthouse", tier: 1 },
        { det: "an", t: "escape room", tier: 1 },
        { det: "a", t: "Renaissance faire", tier: 1 },
        { det: "the", t: "back room of a Medieval Times", tier: 2 },
        { det: "a", t: "submarine", tier: 2 },
      ] },
      { k: "c", name: "clause", opt: true, pool: [
        { t: "during a power outage", tier: 0 }, { t: "two towns over", tier: 0 },
        { t: "next to {thing}", tier: 0 },
        { t: "that was also a vape shop", tier: 1 }, { t: "that is mostly a gift shop", tier: 1 },
        { t: "run by {thing}", tier: 1 }, { t: "guarded by {thing}", tier: 1 },
        { t: "with no exit", tier: 2 }, { t: "that only lends out ladders", tier: 2 },
      ] },
    ],
    grow: ["q", "i", "c"],
  },

  // "a [intensity] [quality] noun [clause]"
  thing: {
    parts: [
      { k: "i", name: "intensity", opt: true, needs: "q", pool: [
        { t: "slightly", tier: 0 }, { t: "extremely", tier: 0 }, { t: "mostly", tier: 0 },
        { t: "surprisingly", tier: 0 }, { t: "very", tier: 0 },
        { t: "suspiciously", tier: 1 }, { t: "aggressively", tier: 1 }, { t: "technically", tier: 1 },
        { t: "legally", tier: 2 }, { t: "spiritually", tier: 2 }, { t: "emotionally", tier: 2 },
      ] },
      { k: "q", name: "quality", opt: true, pool: [
        { t: "loud", tier: 0 }, { t: "quiet", tier: 0 }, { t: "wet", tier: 0 }, { t: "damp", tier: 0 },
        { t: "tiny", tier: 0 }, { t: "enormous", tier: 0 }, { t: "sticky", tier: 0 },
        { t: "laminated", tier: 0 }, { t: "borrowed", tier: 0 }, { t: "monogrammed", tier: 0 },
        { t: "glow-in-the-dark", tier: 1 }, { t: "haunted", tier: 1 }, { t: "inherited", tier: 1 },
        { t: "judgmental", tier: 1 }, { t: "singing", tier: 1 }, { t: "commemorative", tier: 1 },
        { t: "sentient", tier: 2 }, { t: "bilingual", tier: 2 }, { t: "recently divorced", tier: 2 },
        { t: "tax-exempt", tier: 2 }, { t: "ordained", tier: 2 },
      ] },
      { k: "n", name: "noun", pool: [
        { t: "folding chair", tier: 0 }, { t: "casserole dish", tier: 0 }, { t: "wind chime", tier: 0 },
        { t: "bucket hat", tier: 0 }, { t: "kayak", tier: 0 }, { t: "dog", tier: 0 },
        { t: "lawn flamingo", tier: 0 }, { t: "fondue set", tier: 0 }, { t: "road map", tier: 0 },
        { t: "accordion", tier: 0 },
        { t: "novelty fish", tier: 1 }, { t: "spoon", tier: 1 }, { t: "jar of pickled eggs", tier: 1 },
        { t: "rotary phone", tier: 1 }, { t: "Burger King crown", tier: 1 }, { t: "mime costume", tier: 1 },
        { t: "ventriloquist dummy named Gerald", tier: 2 }, { t: "goose (a different goose)", tier: 2 },
        { t: "oil painting of a horse in a suit", tier: 2 }, { t: "garden gnome", tier: 2 },
        { t: "trophy for a sport that doesn't exist", tier: 2 },
      ] },
      { k: "c", name: "clause", opt: true, pool: [
        { t: "that was never returned", tier: 0 }, { t: "from the garage", tier: 0 },
        { t: "nobody will admit to owning", tier: 0 }, { t: "that belongs to {thing}", tier: 0 },
        { t: "that still rings at night", tier: 1 }, { t: "from 1994", tier: 1 }, { t: "with a secret", tier: 1 },
        { t: "that once swallowed {thing}", tier: 1 }, { t: "shaped like {thing}", tier: 1 },
        { t: "that keeps showing up in photos", tier: 2 }, { t: "that has a lawyer", tier: 2 },
        { t: "that remembers everything", tier: 2 }, { t: "that is in love with {thing}", tier: 2 },
      ] },
    ],
    grow: ["q", "i", "c"],
  },
};

// Story forms. A form is the shape of the telling: which cards each length brings in, and
// which beats fill each paragraph. Every beat line has a tier, so beats sit on the same
// plain → strange ladder as words and can be tuned the same way.
//
// Beat tokens: {P}/{p} pronoun, {o}, {pos}, {is}, {has}, {was}, {s} (verb ending: "keep{s}"),
// {where}, {thing}, {Thing} (thing at the start of a sentence).
// A beat line that names {where} or {thing} is only used once that card is in play.
// Group options: byMood: one pool per feeling mood (equal lengths, so a tuned beat survives
// a mood change). byClash: the default line's tier follows how many pairs clash.
// role "landing": the beat that resolves the story. Every form ends on one.
const B = (tier, t) => ({ tier, t });

const STORY_FORMS = {
  bit: {
    name: "The bit",
    stanzas: [
      { name: "Just the bit", slots: ["who", "what", "feel"], paras: [] },
      { name: "Bit + landing", slots: ["who", "what", "feel", "where"], paras: [["setup"], ["resolve"]] },
      { name: "Short story", slots: ["who", "what", "feel", "where", "thing"], paras: [["setup"], ["thing", "after"], ["resolve"]] },
      { name: "With a turn", slots: ["who", "what", "feel", "where", "thing"], paras: [["setup"], ["thing", "after", "turn"], ["resolve"]] },
      { name: "The full telling", slots: ["who", "what", "feel", "where", "thing"], paras: [["setup", "dwell"], ["thing", "after", "turn"], ["resolve", "tag"]] },
    ],
    beats: {
      setup: { name: "how it started", lines: [
        B(0, "It all started at {where}."),
        B(0, "This happened at {where}, of all places."),
        B(0, "The trouble started, as it so often does, at {where}."),
        B(0, "Picture {where}, mid-afternoon."),
        B(1, "{P} would tell you it began at {where}, though that part is disputed."),
        B(1, "Nobody remembers how everyone ended up at {where}."),
        B(2, "Historians agree it began at {where}. Historians are not sure why."),
      ] },
      dwell: { name: "how they're taking it", byMood: true, lines: {
        "1": [
          B(0, "{P} {has} brought it up at every meal since."),
          B(0, "{P} made a group chat just to announce it."),
          B(1, "{P} {has} told the mailman, the pharmacist, and two strangers at the bus stop."),
          B(1, "There is now a slideshow. It has transitions."),
          B(2, "{P} {has} commissioned a mural about it."),
        ],
        "-1": [
          B(0, "{P} {has} been pacing the kitchen since Tuesday."),
          B(0, "{P} keep{s} saying \"it's fine\" in the voice that means it isn't."),
          B(1, "{P} {has} reorganized the spice rack three times."),
          B(1, "{P} {has} been staring out the window like a lighthouse keeper."),
          B(2, "{P} {has} written a strongly worded letter to the moon."),
        ],
        "0": [
          B(0, "{P} {is} handling it in {pos} own particular way."),
          B(0, "Nobody can tell what {p} {is} thinking, including {o}."),
          B(1, "{P} {has} started taking long, thoughtful walks."),
          B(1, "{P} {has} written about it in a notebook nobody is allowed to read."),
          B(2, "{P} {has} started discussing it only in the third person."),
        ],
      } },
      thing: { name: "the thing shows up", lines: [
        B(0, "Then {thing} got involved."),
        B(0, "Nobody saw {thing} coming."),
        B(0, "Somewhere in all of this there was {thing}."),
        B(0, "And of course there was {thing}."),
        B(1, "The problem, as always, was {thing}."),
        B(2, "{Thing} was, legally speaking, the main character."),
      ] },
      after: { name: "the aftermath", lines: [
        B(0, "{P} still won't explain how."),
        B(0, "Everyone agrees that was the turning point."),
        B(0, "It's a whole thing. Ask {o}."),
        B(1, "Witnesses describe it differently."),
        B(1, "This is the part {p} skip{s} when telling it to grandparents."),
        B(2, "It has since been elected to the school board."),
      ] },
      turn: { name: "the turn", byClash: true, lines: [
        B(0, "For a while it looked like it might all go sideways."),
        B(0, "Then the weather turned, the way it does."),
        B(0, "A cousin got involved, which never helps."),
        B(1, "Then a local news van showed up, unrelated, but still."),
        B(1, "Then someone started a petition."),
        B(1, "Then {p} met a man who claimed to have done the exact same thing in 1987."),
        B(2, "Then a marching band arrived, uninvited and fully committed."),
        B(2, "Then the swans unionized."),
        B(2, "Then, without warning, it began to rain small, polite frogs."),
      ] },
      // The landing: the incongruity resolves somewhere safe enough to laugh.
      resolve: { name: "the landing", role: "landing", lines: [
        B(0, "Now {p} tell{s} the story at parties, and it gets longer every time."),
        B(0, "And honestly? {P} {is} going to be okay."),
        B(0, "It all worked out. It usually does. {P} still bring{s} it up."),
        B(1, "In the end everyone was fine, and {thing} now hangs in {pos} hallway."),
        B(1, "Nobody got hurt, except maybe {pos} pride, and that grew back."),
        B(1, "The family has agreed to never speak of it, and speaks of it constantly."),
        B(1, "{P} {has} since made peace with it, mostly, on weekdays."),
        B(2, "Everyone is fine. The swans have issued an apology."),
      ] },
      tag: { name: "the tag", lines: [
        B(0, "Ask {o} about it sometime."),
        B(0, "You'll hear about it at Thanksgiving."),
        B(0, "{P} will tell you it was worth it."),
        B(1, "Don't bring up {thing} around {o}."),
        B(2, "There is a documentary in development."),
      ] },
    },
  },

  news: {
    name: "Local news",
    stanzas: [
      { name: "The headline", slots: ["who", "what", "feel"], paras: [] },
      { name: "Live report", slots: ["who", "what", "feel", "where"], paras: [["open"], ["signoff"]] },
      { name: "With witnesses", slots: ["who", "what", "feel", "where", "thing"], paras: [["open"], ["witness", "thing"], ["signoff"]] },
      { name: "Developing story", slots: ["who", "what", "feel", "where", "thing"], paras: [["open"], ["witness", "thing", "update"], ["signoff"]] },
    ],
    beats: {
      open: { name: "the anchor", lines: [
        B(0, "Good evening. Our top story tonight comes to us from {where}."),
        B(0, "Breaking news out of {where}, where the situation is described as ongoing."),
        B(1, "We go live now to {where}, where our reporter has been for nine hours."),
        B(2, "Tonight, an exclusive from {where}, a place this station is legally required to cover."),
      ] },
      witness: { name: "a witness", byMood: true, lines: {
        "1": [
          B(0, "Neighbors say {p} {has} been \"insufferable, in a good way.\""),
          B(1, "One witness described the mood as \"a parade, but for one person.\""),
          B(2, "Several birds have also issued statements of support."),
        ],
        "-1": [
          B(0, "Neighbors say {p} {has} not left the porch since."),
          B(1, "One witness described the mood as \"a soap opera with no commercials.\""),
          B(2, "A vigil is planned for Thursday. It will be catered."),
        ],
        "0": [
          B(0, "Neighbors say {p} {is} \"processing it.\""),
          B(1, "One witness declined to comment, then commented for forty minutes."),
          B(2, "The town council has scheduled a vote on how to feel about it."),
        ],
      } },
      thing: { name: "the evidence", lines: [
        B(0, "Police have recovered {thing} from the scene."),
        B(0, "At the center of it all: {thing}."),
        B(1, "Authorities are asking anyone with information about {thing} to come forward."),
        B(2, "{Thing} could not be reached for comment."),
      ] },
      update: { name: "this just in", byClash: true, lines: [
        B(0, "This just in: sources confirm it really happened."),
        B(1, "This just in: a second, smaller news van has arrived."),
        B(2, "This just in: the swans are involved."),
      ] },
      signoff: { name: "the sign-off", role: "landing", lines: [
        B(0, "{P} {is} expected to make a full recovery. Back to you."),
        B(0, "We'll keep you posted. Now, here's Doug with the weather."),
        B(1, "Officials say there is no cause for alarm, and frankly, it's kind of sweet. Back to you."),
        B(1, "The station would like to apologize. It was a slow news day."),
        B(2, "{Thing} has since been named Citizen of the Year. Back to you."),
      ] },
    },
  },

  toast: {
    name: "Wedding toast",
    stanzas: [
      { name: "The premise", slots: ["who", "what", "feel"], paras: [] },
      { name: "Short and sweet", slots: ["who", "what", "feel", "where"], paras: [["raise"], ["cheers"]] },
      { name: "The story", slots: ["who", "what", "feel", "where", "thing"], paras: [["raise"], ["story", "thing"], ["cheers"]] },
      { name: "Too long", slots: ["who", "what", "feel", "where", "thing"], paras: [["raise"], ["story", "thing", "lesson"], ["cheers"]] },
    ],
    beats: {
      raise: { name: "the opener", lines: [
        B(0, "For those who don't know me, I met the happy couple at {where}."),
        B(0, "I'll keep this short, which is what I said at {where}, too."),
        B(1, "I was asked to keep this story out of the toast. It happened at {where}."),
        B(2, "I am contractually obligated to mention {where} at every wedding I attend."),
      ] },
      story: { name: "the story", byMood: true, lines: {
        "1": [
          B(0, "And {p} {was} glowing. You could see it from the parking lot."),
          B(1, "{P} cried. I cried. The DJ cried."),
          B(2, "{P} hired a string quartet for the occasion, which was a Tuesday."),
        ],
        "-1": [
          B(0, "And {p} {was} a wreck, which, if you know {o}, is saying something."),
          B(1, "{P} called me at 3 a.m. to talk about it. Then again at 3:15."),
          B(2, "{P} wore black for a month. To the beach."),
        ],
        "0": [
          B(0, "And {p} handled it the way {p} handle{s} everything: with a spreadsheet."),
          B(1, "{P} said nothing for a full minute, which has never happened before or since."),
          B(2, "{P} wrote a haiku about it. It was eleven pages."),
        ],
      } },
      thing: { name: "the thing", lines: [
        B(0, "Somehow {thing} was there for all of it."),
        B(1, "Which is how {thing} ended up in the wedding party."),
        B(2, "{Thing} is here tonight, at table six."),
      ] },
      lesson: { name: "the lesson", byClash: true, lines: [
        B(0, "And I think that says a lot about love."),
        B(1, "And I think that says a lot about love, and also about the fire code."),
        B(2, "And if that isn't love, I don't know what the swans were trying to tell us."),
      ] },
      cheers: { name: "the cheers", role: "landing", lines: [
        B(0, "So please, raise your glasses. To love!"),
        B(0, "Anyway, it all worked out, and here we are. Cheers!"),
        B(1, "Everyone is fine now, mostly. To the happy couple!"),
        B(2, "{Thing} has agreed not to object. Cheers!"),
      ] },
    },
  },

  complaint: {
    name: "Complaint to the manager",
    stanzas: [
      { name: "The incident", slots: ["who", "what", "feel"], paras: [] },
      { name: "A brief note", slots: ["who", "what", "feel", "where"], paras: [["opening"], ["demand"]] },
      { name: "A formal letter", slots: ["who", "what", "feel", "where", "thing"], paras: [["opening"], ["grievance", "thing"], ["demand"]] },
      { name: "Escalated", slots: ["who", "what", "feel", "where", "thing"], paras: [["opening"], ["grievance", "thing", "escalate"], ["demand"]] },
    ],
    beats: {
      opening: { name: "the salutation", lines: [
        B(0, "To whom it may concern: I am writing about an incident at {where}."),
        B(0, "Dear Manager, I'll be brief. I was at {where}."),
        B(1, "I have written to {where} before. You know who this is."),
        B(2, "This letter is being delivered to {where} by carrier pigeon, as requested."),
      ] },
      grievance: { name: "the grievance", byMood: true, lines: {
        "1": [
          B(0, "Normally I'm delighted. And I was. That's not the point."),
          B(1, "I was having a lovely time, which your staff took personally."),
          B(2, "I was so happy that I was asked to leave by a hostess named Fate."),
        ],
        "-1": [
          B(0, "I have never been so upset in my life, and I once owned a timeshare."),
          B(1, "I have attached a diagram of my feelings."),
          B(2, "I have alerted the moon."),
        ],
        "0": [
          B(0, "I'm not angry. I'm just noting it, for the record."),
          B(1, "I have mixed feelings, all of which I would like refunded."),
          B(2, "I felt nothing, which I believe violates your mission statement."),
        ],
      } },
      thing: { name: "the exhibit", lines: [
        B(0, "I would also like to discuss {thing}."),
        B(1, "Nobody explained {thing} to me."),
        B(2, "{Thing} is cc'd on this letter."),
      ] },
      escalate: { name: "the escalation", byClash: true, lines: [
        B(0, "I asked to speak to someone in charge. They sent the same person back."),
        B(1, "I was offered a coupon. I have framed it."),
        B(2, "I was offered a coupon. The coupon apologized."),
      ] },
      demand: { name: "the demand", role: "landing", lines: [
        B(0, "I expect a full refund, and honestly? I'll be fine."),
        B(0, "Please don't let it happen again. Otherwise, five stars."),
        B(1, "In conclusion: I'll be back next week. Same table."),
        B(2, "I accept your apology in advance. {Thing} does not."),
      ] },
    },
  },
};

// What each slot is, for the word bank's preview frame and hint, plus the flags the engine reads
// instead of card names: mood (entries carry v), det (head words carry a determiner), pronouns
// (head words supply he/she/they), trailing (a clause that follows the head).
const STORY_SLOTS = {
  "who.d": { frame: "your ___ uncle", hint: "Describes a person. An adjective or short phrase." },
  "who.n": { frame: "{det} ___", hint: "A person, the way you'd refer to them: “cousin Dale”, “mail carrier”.", pronouns: true, det: ["your", "the"] },
  "what.a": { frame: "your uncle ___ lost his dog", hint: "An adverb that sits before the event." },
  "what.n": { frame: "your uncle ___", hint: "What happened, starting with a past-tense verb: “got…”, “lost…”.", mood: true },
  "what.t": { frame: "your uncle lost his dog ___", hint: "When, where or how. A phrase that trails the event.", trailing: true },
  "feel.i": { frame: "and he is ___ furious", hint: "How much. An adverb." },
  "feel.n": { frame: "and he is ___", hint: "How they feel, read after “is”: “thrilled”, “pretending it's fine”.", mood: true },
  "feel.t": { frame: "and he is furious ___", hint: "A trailing twist: “but won't admit it”.", trailing: true },
  "where.i": { frame: "a ___ haunted laundromat", hint: "An adverb for the place's quality." },
  "where.q": { frame: "a ___ laundromat", hint: "Describes a place. An adjective." },
  "where.n": { frame: "{det} ___", hint: "A place.", det: ["the", "a", "an", "a cousin's"] },
  "where.c": { frame: "a laundromat ___", hint: "Trails the place: “two towns over”, “that was also a bank”.", trailing: true },
  "thing.i": { frame: "a ___ wet dog", hint: "An adverb for the thing's quality." },
  "thing.q": { frame: "a ___ dog", hint: "Describes a thing. An adjective." },
  "thing.n": { frame: "a ___", hint: "A thing. A singular noun." },
  "thing.c": { frame: "a dog ___", hint: "Trails the thing: “from 1994”, “that has a lawyer”.", trailing: true },
};
for (const [key, info] of Object.entries(STORY_SLOTS)) {
  const [s, k] = key.split(".");
  Object.assign(STORY_SCHEMAS[s].parts.find((p) => p.k === k), info);
}
// noun: a clause on this card's words can hold a nested phrase, and that phrase may not take a
// clause of its own (so every trailing clause has one owner). article: starts with a/an.
Object.assign(STORY_SCHEMAS.where, { noun: true });
Object.assign(STORY_SCHEMAS.thing, { noun: true, article: true });

const STORY_GRAMMAR = {
  id: "story-bits",
  name: "Story Bits",
  description: "Something happened to someone, and they feel some way about it. The dial makes pairs of cards clash, and every telling lands somewhere safe enough to laugh.",
  maxDepth: 2,
  cards: [
    { key: "who", label: "Who", hint: "the character" },
    { key: "what", label: "What happened", hint: "the event" },
    { key: "feel", label: "How they feel", hint: "the feeling" },
    { key: "where", label: "Where", hint: "the place" },
    { key: "thing", label: "Thing", hint: "the object" },
  ],
  // Whose pronouns the beats use ({p}, {is}...), and whose mood picks by-mood beat lines.
  headline: "The bit",
  pronouns: "who",
  moodCard: "feel",
  line: "{who} {what}, and {p} {is} {feel}.",
  schemas: STORY_SCHEMAS,
  forms: STORY_FORMS,
  rules: {
    landing: true,
    dialName: "Incongruity",
    dialLabels: ["Plausible", "Odd", "Absurd"],
    dialNotes: [
      "No pair clashes. A thing your mom would tell you on the phone.",
      "One pair clashes: the feeling doesn't fit what happened.",
      "Every pair in play clashes. The world gets strange, then lands safely.",
    ],
    // Incongruity is counted in pairs, each fitting or clashing on mood (good/mixed/bad) or
    // register (plausible/odd/absurd). Dial: none clash, the first clashes, all clash.
    pairs: [
      { a: "what", b: "feel", on: "mood", label: "event ↔ feeling" },
      { a: "where", b: "what", on: "register", label: "place ↔ event" },
      { a: "thing", b: "where", on: "register", label: "thing ↔ place" },
    ],
    // The event itself stays grounded at low settings: its register never exceeds the dial.
    grounded: "what",
  },
};

const GRAMMARS = { [STORY_GRAMMAR.id]: STORY_GRAMMAR };

// ---------- Small Poems ----------
// An image grammar. No humor model: nothing has to land. The dial pulls the parts out of agreement:
// image and place stop sharing a sound, motion and time stop sharing a register
// (literal → figurative → surreal). Words can nest other cards ("from {where}", "in the voice of
// {image}"). Prepositions ride on the place's determiner ("in the", "under a").
const POEM_SCHEMAS = {
  image: {
    noun: true, article: true,
    parts: [
      { k: "q", name: "quality", opt: true, frame: "a ___ pear", hint: "Describes the image. An adjective.", pool: [
        { t: "bruised", tier: 0 }, { t: "cold", tier: 0 }, { t: "small", tier: 0 }, { t: "wet", tier: 0 }, { t: "last", tier: 0 },
        { t: "open", tier: 0 }, { t: "green", tier: 0 }, { t: "folded", tier: 0 }, { t: "paper", tier: 0 }, { t: "salt-white", tier: 0 },
        { t: "patient", tier: 1 }, { t: "forgetful", tier: 1 }, { t: "unlit", tier: 1 }, { t: "borrowed", tier: 1 }, { t: "half-remembered", tier: 1 },
        { t: "weightless", tier: 2 }, { t: "invented", tier: 2 }, { t: "inside-out", tier: 2 }, { t: "sleeping", tier: 2 }, { t: "glass", tier: 2 },
      ] },
      { k: "n", name: "image", frame: "a ___", hint: "The thing the poem looks at. A singular noun.", pool: [
        { t: "pear", tier: 0 }, { t: "kettle", tier: 0 }, { t: "window", tier: 0 }, { t: "heron", tier: 0 }, { t: "coat", tier: 0 },
        { t: "letter", tier: 0 }, { t: "bicycle", tier: 0 }, { t: "field", tier: 0 }, { t: "stone", tier: 0 }, { t: "lamp", tier: 0 }, { t: "river", tier: 0 },
        { t: "question", tier: 1 }, { t: "silence", tier: 1 }, { t: "apology", tier: 1 }, { t: "hallway", tier: 1 }, { t: "weather", tier: 1 },
        { t: "century", tier: 2 }, { t: "alphabet", tier: 2 }, { t: "telephone of moths", tier: 2 }, { t: "small god", tier: 2 }, { t: "unfinished bridge", tier: 2 },
      ] },
      { k: "c", name: "clause", opt: true, trailing: true, frame: "a pear ___", hint: "Trails the image: “on the sill”, “nobody asked for”.", pool: [
        { t: "on the sill", tier: 0 }, { t: "with one sleeve", tier: 0 }, { t: "in the grass", tier: 0 }, { t: "of the morning", tier: 0 },
        { t: "nobody asked for", tier: 1 }, { t: "that kept its promise", tier: 1 }, { t: "brought back from {where}", tier: 1 },
        { t: "that remembers being rain", tier: 2 }, { t: "shaped like {image}", tier: 2 },
      ] },
    ],
    grow: ["q", "c"],
  },
  motion: {
    parts: [
      { k: "a", name: "adverb", opt: true, frame: "the pear ___ leans", hint: "How. An adverb before the motion.", pool: [
        { t: "slowly", tier: 0 }, { t: "still", tier: 0 }, { t: "quietly", tier: 0 }, { t: "almost", tier: 0 },
        { t: "patiently", tier: 1 }, { t: "gladly", tier: 1 }, { t: "without asking", tier: 1 },
        { t: "backwards", tier: 2 }, { t: "in reverse", tier: 2 }, { t: "all at once", tier: 2 },
      ] },
      { k: "n", name: "motion", frame: "the pear ___", hint: "What the image does, in the present tense: “leans”, “waits”.", pool: [
        { t: "leans", tier: 0 }, { t: "waits", tier: 0 }, { t: "cools", tier: 0 }, { t: "rests", tier: 0 }, { t: "turns", tier: 0 }, { t: "shines", tier: 0 },
        { t: "keeps its own counsel", tier: 1 }, { t: "forgets its name", tier: 1 }, { t: "listens", tier: 1 }, { t: "holds its breath", tier: 1 },
        { t: "unlearns the light", tier: 2 }, { t: "speaks in a dead language", tier: 2 }, { t: "becomes a door", tier: 2 },
      ] },
      { k: "t", name: "detail", opt: true, trailing: true, frame: "the pear leans ___", hint: "Trails the motion: “for a while”, “like a held note”.", pool: [
        { t: "for a while", tier: 0 }, { t: "again", tier: 0 }, { t: "the way it did", tier: 0 },
        { t: "as if waiting for you", tier: 1 }, { t: "like a held note", tier: 1 },
        { t: "until the walls agree", tier: 2 }, { t: "in the voice of {image}", tier: 2 },
      ] },
    ],
    grow: ["a", "t"],
  },
  where: {
    noun: true,
    parts: [
      { k: "q", name: "quality", opt: true, frame: "in the ___ kitchen", hint: "Describes the place. An adjective.", pool: [
        { t: "empty", tier: 0 }, { t: "narrow", tier: 0 }, { t: "upstairs", tier: 0 }, { t: "flooded", tier: 0 }, { t: "far", tier: 0 },
        { t: "cold", tier: 0 }, { t: "small", tier: 0 }, { t: "wet", tier: 0 }, { t: "old", tier: 0 }, { t: "green", tier: 0 }, { t: "bright", tier: 0 },
        { t: "lonely", tier: 1 }, { t: "patient", tier: 1 }, { t: "half-built", tier: 1 }, { t: "humming", tier: 1 },
        { t: "folded", tier: 2 }, { t: "invisible", tier: 2 }, { t: "quiet-as-a-held-breath", tier: 2 },
        { t: "unswept", tier: 1 }, { t: "almost-blue", tier: 1 }, { t: "rented", tier: 1 },
        { t: "drowned", tier: 2 }, { t: "unmapped", tier: 2 }, { t: "breathing", tier: 2 },
      ] },
      { k: "n", name: "place", det: ["in the", "on the", "at the", "under the", "near the", "in a", "under a", "beside a"], frame: "{det} ___", hint: "A place, with how the image is placed in it (in, on, under…).", pool: [
        { det: "in the", t: "kitchen", tier: 0 }, { det: "at the", t: "station", tier: 0 }, { det: "on the", t: "shore", tier: 0 },
        { det: "in a", t: "parking lot", tier: 0 }, { det: "near the", t: "window", tier: 0 }, { det: "under the", t: "stairs", tier: 0 },
        { det: "in the", t: "garden", tier: 0 }, { det: "in the", t: "orchard", tier: 0 }, { det: "on the", t: "porch", tier: 0 }, { det: "at the", t: "bakery", tier: 0 },
        { det: "in the", t: "laundromat", tier: 0 }, { det: "on the", t: "pier", tier: 0 }, { det: "in the", t: "hallway", tier: 0 }, { det: "in a", t: "field", tier: 0 },
        { det: "at the", t: "lake", tier: 0 }, { det: "in the", t: "car", tier: 0 }, { det: "in the", t: "chapel", tier: 1 }, { det: "in the", t: "observatory", tier: 1 },
        { det: "at the", t: "edge of the map", tier: 1 }, { det: "in the", t: "weather of a photograph", tier: 2 }, { det: "on the", t: "underside of the moon", tier: 2 },
        { det: "in a", t: "hospital corridor", tier: 1 }, { det: "at the", t: "bottom of a well", tier: 1 }, { det: "beside a", t: "closed theater", tier: 1 },
        { det: "in the", t: "inside of a bell", tier: 2 }, { det: "in a", t: "city of paper", tier: 2 }, { det: "under a", t: "second sky", tier: 2 },
      ] },
      { k: "c", name: "clause", opt: true, trailing: true, frame: "in the kitchen ___", hint: "Trails the place: “after the rain”.", pool: [
        { t: "after the rain", tier: 0 }, { t: "before anyone wakes", tier: 0 },
        { t: "nobody visits", tier: 1 }, { t: "that smells of oranges", tier: 1 },
        { t: "where clocks are buried", tier: 2 }, { t: "that is also {image}", tier: 2 },
      ] },
    ],
    grow: ["q", "c"],
  },
  time: {
    parts: [
      { k: "n", name: "time", frame: "___", hint: "When: “at dusk”, “in March”.", pool: [
        { t: "at dusk", tier: 0 }, { t: "this morning", tier: 0 }, { t: "in March", tier: 0 }, { t: "after supper", tier: 0 }, { t: "all afternoon", tier: 0 },
        { t: "in the year of the long rain", tier: 1 }, { t: "an hour before anyone", tier: 1 }, { t: "the day you left", tier: 1 },
        { t: "on the eighth day of the week", tier: 2 }, { t: "at the end of a sentence", tier: 2 }, { t: "before time was invented", tier: 2 },
      ] },
    ],
    grow: [],
  },
};

// Poem forms set `lines: true`: each beat is its own line, each paragraph a stanza.
const POEM_FORMS = {
  couplets: {
    name: "Couplets",
    lines: true,
    stanzas: [
      { name: "One line", slots: ["image", "motion", "where", "time"], paras: [] },
      { name: "A couplet", slots: ["image", "motion", "where", "time"], paras: [["echo"]] },
      { name: "Two couplets", slots: ["image", "motion", "where", "time"], paras: [["echo"], ["second", "close"]] },
      { name: "With a coda", slots: ["image", "motion", "where", "time"], paras: [["echo"], ["second", "close"], ["coda"]] },
    ],
    beats: {
      echo: { name: "the echo", lines: [
        B(0, "Nothing else moves."),
        B(0, "{Image}, and then not."),
        B(1, "Even {where}, something is listening."),
        B(1, "{Image} is never only itself."),
        B(2, "The light takes notes."),
      ] },
      second: { name: "the second look", lines: [
        B(0, "I stand there longer than I meant to."),
        B(0, "Someone is cooking somewhere."),
        B(1, "The hour forgets which way it was going."),
        B(2, "A door opens onto another door."),
      ] },
      close: { name: "the close", lines: [
        B(0, "{Time}, and then not."),
        B(1, "That is all the morning would admit."),
        B(2, "And the poem, embarrassed, leaves."),
      ] },
      coda: { name: "the coda", lines: [
        B(0, "Remember {image}."),
        B(1, "{Where}: keep it."),
        B(2, "Wake {image}, gently, in reverse."),
      ] },
    },
  },
  refrain: {
    name: "Refrain",
    lines: true,
    stanzas: [
      { name: "The refrain", slots: ["image", "motion", "where", "time"], paras: [] },
      { name: "A verse", slots: ["image", "motion", "where", "time"], paras: [["verse", "refrain"]] },
      { name: "Two verses", slots: ["image", "motion", "where", "time"], paras: [["verse", "refrain"], ["verse2", "refrain"]] },
    ],
    beats: {
      verse: { name: "the verse", lines: [
        B(0, "{Where}, everything keeps its distance."),
        B(0, "Outside, a car. Then quiet."),
        B(1, "The walls hold what they were told."),
        B(2, "The furniture is dreaming of trees."),
      ] },
      verse2: { name: "the second verse", lines: [
        B(0, "I come back, {time}."),
        B(1, "Nobody has moved the chairs."),
        B(2, "The house has learned my name and spends it."),
      ] },
      refrain: { name: "the refrain", lines: [
        B(0, "{Image} {motion}."),
        B(1, "And still, {image} {motion}."),
        B(2, "{Image} {motion}, as it always will."),
      ] },
    },
  },
};

const POEM_GRAMMAR = {
  id: "small-poems",
  name: "Small Poems",
  description: "An image, what it does, where, and when. No joke to land: the dial lets the parts stop agreeing, in sound and in register.",
  maxDepth: 1,
  cards: [
    { key: "image", label: "Image", hint: "the image" },
    { key: "motion", label: "Motion", hint: "what it does" },
    { key: "where", label: "Place", hint: "the place" },
    { key: "time", label: "Time", hint: "the time" },
  ],
  headline: "The line",
  pronouns: null,
  moodCard: null,
  line: "{image} {motion} {where}, {time}.",
  schemas: POEM_SCHEMAS,
  forms: POEM_FORMS,
  rules: {
    landing: false,
    dialName: "Strangeness",
    dialLabels: ["Literal", "Figurative", "Surreal"],
    dialNotes: [
      "Everything agrees: image and place share a sound, motion and time a register.",
      "The image and the place stop sharing a sound.",
      "Nothing agrees. Let it be strange.",
    ],
    pairs: [
      { a: "image", b: "where", on: "sound", label: "image ↔ place (sound)" },
      { a: "motion", b: "time", on: "register", label: "motion ↔ time (register)" },
    ],
    grounded: "motion",
  },
};
GRAMMARS[POEM_GRAMMAR.id] = POEM_GRAMMAR;
