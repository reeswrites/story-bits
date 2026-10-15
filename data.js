// Pools for the five bits. Each entry carries a tier (0 = plausible, 1 = odd, 2 = absurd)
// and, where it matters, a valence (+1 good, 0 mixed, -1 bad). The incongruity dial
// works by mismatching these: a happy event paired with a happy feeling is a story;
// a happy event paired with dread is a bit.

// who: name as it reads mid-sentence, plus pronouns.
const HE = { p: "he", o: "him", pos: "his", is: "is", has: "has", was: "was", s: "s" };
const SHE = { p: "she", o: "her", pos: "her", is: "is", has: "has", was: "was", s: "s" };
const THEY = { p: "they", o: "them", pos: "their", is: "are", has: "have", was: "were", s: "" };

const WHO = [
  { n: "your uncle", ...HE },
  { n: "your neighbor", ...SHE },
  { n: "your roommate", ...THEY },
  { n: "your grandmother", ...SHE },
  { n: "your dentist", ...HE },
  { n: "your old boss", ...SHE },
  { n: "your cousin Dale", ...HE },
  { n: "the guy from the coffee shop", ...HE },
  { n: "your landlord", ...THEY },
  { n: "your sister's ex", ...THEY },
  { n: "your mail carrier", ...SHE },
  { n: "your high school chemistry teacher", ...HE },
  { n: "your best friend's mom", ...SHE },
  { n: "the kid down the street", ...THEY },
  { n: "your aunt Lorraine", ...SHE },
  { n: "your barber", ...HE },
  { n: "your coworker in accounting", ...THEY },
  { n: "your yoga instructor", ...SHE },
  { n: "your dad", ...HE },
  { n: "your college roommate", ...THEY },
];

// what happened: completes "<who> ___". Use {pos}/{o}/{p} for pronouns.
const WHAT = [
  { t: "just got {pos} boating license", v: 1, tier: 0 },
  { t: "lost {pos} dog", v: -1, tier: 0 },
  { t: "finally finished a 1,000-piece puzzle", v: 1, tier: 0 },
  { t: "got a parking ticket outside {pos} own house", v: -1, tier: 0 },
  { t: "won the office chili cook-off", v: 1, tier: 0 },
  { t: "got called for jury duty", v: 0, tier: 0 },
  { t: "found out {p} {was} adopted (by a different set of the same parents)", v: 0, tier: 2 },
  { t: "started learning the accordion", v: 1, tier: 0 },
  { t: "accidentally replied-all to the entire company", v: -1, tier: 0 },
  { t: "got a tattoo of a lighthouse", v: 0, tier: 1 },
  { t: "was mistaken for a minor local celebrity", v: 1, tier: 1 },
  { t: "had {pos} sourdough starter declared a legal dependent", v: 1, tier: 2 },
  { t: "got banned from a Costco", v: -1, tier: 1 },
  { t: "inherited a single, very old goose", v: 0, tier: 1 },
  { t: "was elected treasurer of a club {p} never joined", v: 0, tier: 2 },
  { t: "beat {pos} personal record at the community pool", v: 1, tier: 0 },
  { t: "got stuck in an elevator with a mime", v: -1, tier: 1 },
  { t: "lost a bet and now has to speak only in questions", v: -1, tier: 1 },
  { t: "discovered {pos} house is technically in another state", v: 0, tier: 2 },
  { t: "was asked to be a godparent", v: 1, tier: 0 },
  { t: "got {pos} wisdom teeth out", v: -1, tier: 0 },
  { t: "was hired to name a new shade of beige", v: 1, tier: 2 },
  { t: "received a strongly worded letter from a lighthouse", v: -1, tier: 2 },
  { t: "got a perfect score on a radio trivia call-in", v: 1, tier: 1 },
  { t: "found a second, smaller fridge inside {pos} fridge", v: 0, tier: 2 },
  { t: "had to give a toast at a stranger's wedding", v: 0, tier: 1 },
  { t: "got demoted to assistant regional manager of nothing", v: -1, tier: 2 },
  { t: "grew a tomato shaped exactly like Ohio", v: 1, tier: 1 },
  { t: "missed {pos} flight by eleven seconds", v: -1, tier: 0 },
  { t: "was chosen by a swan", v: 0, tier: 2 },
];

// how they feel: completes "and <p> <is> ___".
const FEEL = [
  { t: "really excited about it", v: 1, tier: 0 },
  { t: "worried sick", v: -1, tier: 0 },
  { t: "quietly, unbearably proud", v: 1, tier: 0 },
  { t: "pretending it doesn't bother {o}", v: -1, tier: 0 },
  { t: "not sure how to feel", v: 0, tier: 0 },
  { t: "telling everyone it was {pos} plan all along", v: 1, tier: 1 },
  { t: "treating it like a personal betrayal", v: -1, tier: 1 },
  { t: "weirdly at peace", v: 0, tier: 1 },
  { t: "already planning the sequel", v: 1, tier: 1 },
  { t: "in mourning, with a black armband and everything", v: -1, tier: 2 },
  { t: "certain it's a sign from the universe", v: 0, tier: 1 },
  { t: "throwing a party about it", v: 1, tier: 1 },
  { t: "drafting a memoir", v: 0, tier: 2 },
  { t: "considering a lawsuit", v: -1, tier: 1 },
  { t: "calling it the best day of {pos} life", v: 1, tier: 0 },
  { t: "refusing to discuss it before noon", v: -1, tier: 1 },
  { t: "humming about it constantly", v: 1, tier: 2 },
  { t: "keeping a candle lit until further notice", v: -1, tier: 2 },
  { t: "suspiciously calm", v: 0, tier: 1 },
  { t: "hoping nobody brings it up at Thanksgiving", v: -1, tier: 0 },
];

const WHERE = [
  { t: "the DMV", tier: 0 },
  { t: "a Cracker Barrel off I-95", tier: 0 },
  { t: "the community pool", tier: 0 },
  { t: "a cousin's backyard barbecue", tier: 0 },
  { t: "the self-checkout at Home Depot", tier: 0 },
  { t: "a church rummage sale", tier: 0 },
  { t: "a ferry to nowhere in particular", tier: 1 },
  { t: "the bowling alley's lost and found", tier: 1 },
  { t: "a timeshare presentation", tier: 1 },
  { t: "a mattress store that was also a vape shop", tier: 1 },
  { t: "the waiting room of a very small airport", tier: 1 },
  { t: "a corn maze with no exit", tier: 2 },
  { t: "a lighthouse that is mostly a gift shop", tier: 2 },
  { t: "the back room of a Medieval Times", tier: 2 },
  { t: "a library that only lends out ladders", tier: 2 },
];

const THING = [
  { t: "a folding chair", tier: 0 },
  { t: "a casserole dish that wasn't returned", tier: 0 },
  { t: "a laminated map", tier: 0 },
  { t: "a novelty fish that sings", tier: 1 },
  { t: "a bucket hat", tier: 0 },
  { t: "an extremely loud wind chime", tier: 0 },
  { t: "a commemorative spoon", tier: 1 },
  { t: "a jar of pickled eggs", tier: 1 },
  { t: "a ventriloquist dummy named Gerald", tier: 2 },
  { t: "a rotary phone that still rings", tier: 1 },
  { t: "an unopened letter from 1994", tier: 1 },
  { t: "a trophy for a sport that doesn't exist", tier: 2 },
  { t: "a goose (a different goose)", tier: 2 },
  { t: "a used kayak", tier: 0 },
  { t: "a hundred feet of bubble wrap", tier: 1 },
  { t: "a crown from Burger King", tier: 1 },
  { t: "an oil painting of a horse in a suit", tier: 2 },
  { t: "a garden gnome with a secret", tier: 2 },
];

// Story beats. Tokens: {Who}/{who} name, {P}/{p} pronoun, {o}, {pos}, {is}, {has}, {was},
// {s} (verb ending: "keep{s}"), {where}, {thing}. Keyed by feeling valence where that matters.
const BEATS = {
  setup: [
    "It all started at {where}.",
    "This happened at {where}, of all places.",
    "{P} would tell you it began at {where}, though that part is disputed.",
    "The trouble started, as it so often does, at {where}.",
    "Picture {where} on a Tuesday afternoon.",
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
