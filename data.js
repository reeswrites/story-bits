// Every card is a phrase built from words, and every word is tunable on its own.
// Each word carries a tier (0 = plausible, 1 = odd, 2 = absurd); a phrase's register is
// its strangest word. Event and feeling cores also carry a valence (+1 good, 0 mixed,
// -1 bad). The incongruity dial works by making pairs of cards fit or clash on these.
//
// Phrases nest: a word whose text contains {thing} holds a whole thing phrase of its own,
// which is itself tunable word by word, and may nest again (up to MAX_DEPTH).
// Pronoun tokens in word text: {p} {o} {pos} {is} {has} {was} {s}.

const MAX_DEPTH = 2;

const HE = { p: "he", o: "him", pos: "his", is: "is", has: "has", was: "was", s: "s" };
const SHE = { p: "she", o: "her", pos: "her", is: "is", has: "has", was: "was", s: "s" };
const THEY = { p: "they", o: "them", pos: "their", is: "are", has: "have", was: "were", s: "" };

// Parts are listed in reading order. opt: may be absent. needs: only present with that part.
// grow: the order "+" adds optional parts (and "−" drops them in reverse).
const SCHEMAS = {
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

// Story beats. Tokens: {Who}/{who} name, {P}/{p} pronoun, {o}, {pos}, {is}, {has}, {was},
// {s} (verb ending: "keep{s}"), {where}, {thing}. Keyed by feeling valence where that matters.
const BEATS = {
  setup: [
    "It all started at {where}.",
    "This happened at {where}, of all places.",
    "{P} would tell you it began at {where}, though that part is disputed.",
    "The trouble started, as it so often does, at {where}.",
    "Picture {where}, mid-afternoon.",
  ],
  dwell: {
    "1": [
      "{P} {has} told the mailman, the pharmacist, and two strangers at the bus stop.",
      "{P} {has} brought it up at every meal since.",
      "{P} made a group chat just to announce it.",
      "There is now a slideshow. It has transitions.",
    ],
    "-1": [
      "{P} {has} been pacing the kitchen since Tuesday.",
      "{P} {has} been staring out the window like a lighthouse keeper.",
      "{P} keep{s} saying \"it's fine\" in the voice that means it isn't.",
      "{P} {has} reorganized the spice rack three times.",
    ],
    "0": [
      "{P} {is} handling it in {pos} own particular way.",
      "Nobody can tell what {p} {is} thinking, including {o}.",
      "{P} {has} started taking long, thoughtful walks.",
      "{P} {has} written about it in a notebook nobody is allowed to read.",
    ],
  },
  thing: [
    "Then {thing} got involved.",
    "Nobody saw {thing} coming.",
    "The problem, as always, was {thing}.",
    "Somewhere in all of this there was {thing}.",
    "And of course there was {thing}.",
  ],
  thingAfter: [
    "{P} still won't explain how.",
    "Everyone agrees that was the turning point.",
    "Witnesses describe it differently.",
    "It's a whole thing. Ask {o}.",
    "This is the part {p} skip{s} when telling it to grandparents.",
  ],
  turn: [
    // indexed by tier: plausible, odd, absurd
    [
      "For a while it looked like it might all go sideways.",
      "Then the weather turned, the way it does.",
      "A cousin got involved, which never helps.",
    ],
    [
      "Then a local news van showed up, unrelated, but still.",
      "Then someone started a petition.",
      "Then {p} met a man who claimed to have done the exact same thing in 1987.",
    ],
    [
      "Then a marching band arrived, uninvited and fully committed.",
      "Then the swans unionized.",
      "Then, without warning, it began to rain small, polite frogs.",
    ],
  ],
  // The landing: the incongruity resolves somewhere safe enough to laugh.
  resolve: [
    "In the end everyone was fine, and {thing} now hangs in {pos} hallway.",
    "Now {p} tell{s} the story at parties, and it gets longer every time.",
    "And honestly? {P} {is} going to be okay.",
    "It all worked out. It usually does. {P} still bring{s} it up.",
    "Nobody got hurt, except maybe {pos} pride, and that grew back.",
    "The family has agreed to never speak of it, and speaks of it constantly.",
    "{P} {has} since made peace with it, mostly, on weekdays.",
  ],
  tag: [
    "Ask {o} about it sometime.",
    "Don't bring up {thing} around {o}.",
    "You'll hear about it at Thanksgiving.",
    "{P} will tell you it was worth it.",
  ],
};
