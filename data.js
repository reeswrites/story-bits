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
const IT = { p: "it", o: "it", pos: "its", is: "is", has: "has", was: "was", s: "s" };

// Parts are listed in reading order. opt: may be absent. needs: only present with that part
// ("adj": only if the head word takes one). grow: the order "+" adds optional parts.
// Every schema's head word is part "n". More slot flags are set in STORY_SLOTS below.
const STORY_SCHEMAS = {
  // "[relation | whose] [descriptor] person": "your soft-spoken uncle", "his uncle's dentist",
  // "your sister's ex's landlord". A relation holds another who ({who}'s), which brings its own
  // whose; the pronouns are always the outer person's (the dentist's).
  who: {
    parts: [
      { k: "r", name: "relation", opt: true, odds: 0.15, relation: true, pool: [
        { t: "{who}'s", tier: 0 },
      ] },
      { k: "w", name: "whose", determiner: true, pool: [
        { t: "your", tier: 0, tags: ["yours"] }, { t: "my", tier: 0, tags: ["yours"] },
        { t: "his", tier: 0, tags: ["theirs"] }, { t: "her", tier: 0, tags: ["theirs"] }, { t: "their", tier: 0, tags: ["theirs"] },
        { t: "the", tier: 0, tags: ["anyone"] }, { t: "a", tier: 0, tags: ["anyone"] },
        { t: "someone's", tier: 1, tags: ["anyone"] },
        { t: "our", tier: 0, tags: ["yours"] },
      ] },
      { k: "d", name: "descriptor", opt: true, pool: [
        { t: "recently retired", tier: 0, tags: ["life"] }, { t: "newly single", tier: 0, tags: ["life"] }, { t: "very tall", tier: 0, tags: ["looks"] },
        { t: "soft-spoken", tier: 0, tags: ["manner"] }, { t: "perpetually tired", tier: 0, tags: ["manner"] }, { t: "extremely punctual", tier: 0, tags: ["manner"] },
        { t: "semi-retired", tier: 0, tags: ["life"] },
        { t: "suspiciously tan", tier: 1, tags: ["looks"] }, { t: "formerly famous", tier: 1, tags: ["life"] }, { t: "aggressively cheerful", tier: 1, tags: ["manner"] },
        { t: "conspiracy-minded", tier: 1, tags: ["mind"] }, { t: "very online", tier: 1, tags: ["mind"] },
        { t: "allegedly immortal", tier: 2, tags: ["legend"] }, { t: "twice-knighted", tier: 2, tags: ["legend"] }, { t: "recently resurrected", tier: 2, tags: ["legend"] },
        { t: "ugly", tier: 0, tags: ["looks"] }, { t: "freshly divorced", tier: 0, tags: ["life"] }, { t: "chronically early", tier: 0, tags: ["manner"] },
        { t: "unusually calm", tier: 0, tags: ["manner"] }, { t: "extremely blond", tier: 0, tags: ["looks"] },
        { t: "deeply superstitious", tier: 1, tags: ["mind"] }, { t: "self-published", tier: 1, tags: ["mind", "life"] },
        { t: "heavily mustached", tier: 1, tags: ["looks"] }, { t: "notoriously lucky", tier: 1, tags: ["legend"] },
        { t: "possibly a ghost", tier: 2, tags: ["legend"] }, { t: "internet-ordained", tier: 2, tags: ["mind", "legend"] },
        { t: "seven-foot", tier: 2, tags: ["looks"] }, { t: "fully telepathic", tier: 2, tags: ["mind"] },
      ] },
      // Before "whose", each person carried its own determiner (det); old links still use it.
      { k: "n", name: "person", pool: [
        { det: "your", t: "uncle", ...HE, tags: ["family"] },
        { det: "your", t: "neighbor", ...SHE, tags: ["neighbors"] },
        { det: "your", t: "roommate", ...THEY, tags: ["neighbors", "friends"] },
        { det: "your", t: "grandmother", ...SHE, tags: ["family"] },
        { det: "your", t: "dentist", ...HE, tags: ["services"] },
        { det: "your", t: "old boss", ...SHE, tags: ["work"] },
        { det: "your", t: "cousin Dale", ...HE, tags: ["family"] },
        { det: "the", t: "guy from the coffee shop", ...HE, tags: ["town"] },
        { det: "your", t: "landlord", ...THEY, tags: ["neighbors", "services"] },
        { det: "your", t: "sister's ex", ...THEY, tags: ["exes", "family"] },
        { det: "your", t: "mail carrier", ...SHE, tags: ["town", "services"] },
        { det: "your", t: "high school chemistry teacher", ...HE, tags: ["school"] },
        { det: "your", t: "best friend's mom", ...SHE, tags: ["friends", "family"] },
        { det: "the", t: "kid down the street", ...THEY, tags: ["neighbors"] },
        { det: "your", t: "aunt Lorraine", ...SHE, tags: ["family"] },
        { det: "your", t: "barber", ...HE, tags: ["services", "town"] },
        { det: "your", t: "coworker in accounting", ...THEY, tags: ["work"] },
        { det: "your", t: "yoga instructor", ...SHE, tags: ["services"] },
        { det: "your", t: "dad", ...HE, tags: ["family"] },
        { det: "your", t: "college roommate", ...THEY, tags: ["friends", "school"] },
        { t: "ex", ...THEY, tags: ["exes"] },
        { t: "ex-husband", ...HE, tags: ["exes"] },
        { t: "ex-girlfriend", ...SHE, tags: ["exes"] },
        { t: "first crush", ...HE, tags: ["exes", "school"] },
        { t: "sister", ...SHE, tags: ["family"] },
        { t: "brother", ...HE, tags: ["family"] },
        { t: "mom", ...SHE, tags: ["family"] },
        { t: "stepdad", ...HE, tags: ["family"] },
        { t: "intern", ...THEY, tags: ["work"] },
        { t: "manager", ...SHE, tags: ["work"] },
        { t: "work wife", ...SHE, tags: ["work", "friends"] },
        { t: "plumber", ...HE, tags: ["services"] },
        { t: "therapist", ...SHE, tags: ["services"] },
        { t: "upstairs neighbor", ...HE, tags: ["neighbors"] },
        { t: "HOA president", ...SHE, tags: ["neighbors", "town"] },
        { t: "town librarian", ...SHE, tags: ["town"] },
        { t: "mayor", ...HE, tags: ["town"] },
        { t: "bartender", ...THEY, tags: ["town", "services"] },
        { t: "best friend", ...SHE, tags: ["friends"] },
        { t: "groomsman", ...HE, tags: ["friends"] },
        { t: "lab partner", ...THEY, tags: ["school"] },
        { t: "gym teacher", ...HE, tags: ["school"] },
      ].map((x) => ({ ...x, tier: 0 })) },
    ],
    grow: ["d", "r"],
  },

  // "<who> [adverb] core [tail]"
  what: {
    parts: [
      { k: "a", name: "adverb", opt: true, pool: [
        { t: "just", tier: 0, tags: ["time"] }, { t: "finally", tier: 0, tags: ["time"] }, { t: "recently", tier: 0, tags: ["time"] }, { t: "accidentally", tier: 0, tags: ["chance"] },
        { t: "somehow", tier: 1, tags: ["chance"] }, { t: "secretly", tier: 1, tags: ["secrecy"] }, { t: "allegedly", tier: 1, tags: ["secrecy"] }, { t: "once again", tier: 1, tags: ["time"] },
        { t: "ceremonially", tier: 2, tags: ["official"] }, { t: "posthumously", tier: 2, tags: ["beyond", "time"] }, { t: "spiritually", tier: 2, tags: ["beyond"] },
        { t: "luckily", tier: 0, tags: ["chance"] }, { t: "inexplicably", tier: 1, tags: ["chance"] }, { t: "yet again", tier: 1, tags: ["time"] },
        { t: "legally", tier: 2, tags: ["official"] },
      ] },
      { k: "n", name: "event", pool: [
        { t: "got {pos} boating license", v: 1, tier: 0, tags: ["civic", "hobby"] },
        { t: "lost {pos} dog", v: -1, tier: 0, tags: ["animals"] },
        { t: "finished a 1,000-piece puzzle", v: 1, tier: 0, tags: ["hobby"] },
        { t: "got a parking ticket outside {pos} own house", v: -1, tier: 0, tags: ["civic", "money"] },
        { t: "won the office chili cook-off", v: 1, tier: 0, tags: ["work"] },
        { t: "got called for jury duty", v: 0, tier: 0, tags: ["civic"] },
        { t: "started learning the accordion", v: 1, tier: 0, tags: ["hobby"] },
        { t: "replied-all to the entire company", v: -1, tier: 0, tags: ["work"] },
        { t: "beat {pos} personal record at the community pool", v: 1, tier: 0, tags: ["hobby", "body"] },
        { t: "got asked to be a godparent", v: 1, tier: 0, tags: ["family"] },
        { t: "got {pos} wisdom teeth out", v: -1, tier: 0, tags: ["body"] },
        { t: "missed {pos} flight by eleven seconds", v: -1, tier: 0, tags: ["travel"] },
        { t: "got a tattoo of a lighthouse", v: 0, tier: 1, tags: ["body"] },
        { t: "got mistaken for a minor local celebrity", v: 1, tier: 1, tags: ["social"] },
        { t: "got banned from a Costco", v: -1, tier: 1, tags: ["money", "social"] },
        { t: "inherited a single, very old goose", v: 0, tier: 1, tags: ["animals", "family"] },
        { t: "got stuck in an elevator with a mime", v: -1, tier: 1, tags: ["travel", "social"] },
        { t: "lost a bet", v: -1, tier: 0, tags: ["money"] },
        { t: "won a perfect score on a radio trivia call-in", v: 1, tier: 1, tags: ["hobby", "social"] },
        { t: "gave a toast at a stranger's wedding", v: 0, tier: 1, tags: ["social"] },
        { t: "grew a tomato shaped exactly like Ohio", v: 1, tier: 1, tags: ["hobby", "home"] },
        { t: "found out {p} {was} adopted (by a different set of the same parents)", v: 0, tier: 2, tags: ["family"] },
        { t: "had {pos} sourdough starter declared a legal dependent", v: 1, tier: 2, tags: ["home", "civic"] },
        { t: "got elected treasurer of a club {p} never joined", v: 0, tier: 2, tags: ["civic", "social"] },
        { t: "discovered {pos} house is technically in another state", v: 0, tier: 2, tags: ["home", "civic"] },
        { t: "got hired to name a new shade of beige", v: 1, tier: 2, tags: ["work"] },
        { t: "received a strongly worded letter from a lighthouse", v: -1, tier: 2, tags: ["home"] },
        { t: "found a second, smaller fridge inside {pos} fridge", v: 0, tier: 2, tags: ["home"] },
        { t: "got demoted to assistant regional manager of nothing", v: -1, tier: 2, tags: ["work"] },
        { t: "got chosen by a swan", v: 0, tier: 2, tags: ["animals"] },
        { t: "became a grandparent", v: 1, tier: 0, tags: ["family"] },
        { t: "got bitten by the neighbor's cat", v: -1, tier: 0, tags: ["animals"] },
        { t: "got bumped up to first class", v: 1, tier: 0, tags: ["travel"] },
        { t: "won a goat in a church raffle", v: 1, tier: 1, tags: ["animals", "money"] },
        { t: "got {pos} luggage sent to Belgium without {o}", v: -1, tier: 1, tags: ["travel"] },
        { t: "got custody of the family ghost", v: 0, tier: 2, tags: ["family", "home"] },
      ] },
      { k: "t", name: "detail", opt: true, pool: [
        { t: "for the second time this year", tier: 0, tags: ["time"] }, { t: "in front of everyone", tier: 0, tags: ["public"] },
        { t: "on {pos} birthday", tier: 0, tags: ["time"] }, { t: "at age seventy", tier: 0, tags: ["time"] },
        { t: "thanks to {thing}", tier: 0, tags: ["cause"] }, { t: "because of {thing}", tier: 0, tags: ["cause"] },
        { t: "during a eulogy", tier: 1, tags: ["public"] }, { t: "on live local television", tier: 1, tags: ["public"] },
        { t: "with help from {thing}", tier: 1, tags: ["cause"] },
        { t: "in a dream, but legally", tier: 2, tags: ["time"] }, { t: "while being followed by {thing}", tier: 2, tags: ["cause"] },
        { t: "at the company picnic", tier: 0, tags: ["public"] }, { t: "on a dare from {thing}", tier: 1, tags: ["cause"] },
        { t: "in a past life", tier: 2, tags: ["time"] }, { t: "in front of a jury of geese", tier: 2, tags: ["public"] },
        { t: "at {pos} own funeral", tier: 2, tags: ["public", "time"] }, { t: "on orders from {thing}", tier: 2, tags: ["cause"] },
      ] },
    ],
    grow: ["a", "t"],
  },

  // "and <p> <is> [intensity] core [tail]"
  feel: {
    parts: [
      { k: "i", name: "intensity", opt: true, needs: "adj", pool: [
        { t: "really", tier: 0, tags: ["degree"] }, { t: "quietly", tier: 0, tags: ["manner"] }, { t: "deeply", tier: 0, tags: ["degree"] }, { t: "kind of", tier: 0, tags: ["degree"] },
        { t: "unreasonably", tier: 1, tags: ["degree"] }, { t: "suspiciously", tier: 1, tags: ["manner"] }, { t: "weirdly", tier: 1, tags: ["manner"] }, { t: "aggressively", tier: 1, tags: ["manner"] },
        { t: "spiritually", tier: 2, tags: ["beyond"] }, { t: "legally", tier: 2, tags: ["official"] }, { t: "professionally", tier: 2, tags: ["official"] },
        { t: "secretly", tier: 0, tags: ["manner"] }, { t: "dangerously", tier: 1, tags: ["degree"] }, { t: "cosmically", tier: 2, tags: ["beyond"] },
      ] },
      { k: "n", name: "feeling", pool: [
        { t: "excited about it", v: 1, tier: 0, adj: true, tags: ["joy"] },
        { t: "thrilled", v: 1, tier: 0, adj: true, tags: ["joy"] },
        { t: "proud", v: 1, tier: 0, adj: true, tags: ["pride"] },
        { t: "worried sick", v: -1, tier: 0, adj: true, tags: ["worry"] },
        { t: "embarrassed", v: -1, tier: 0, adj: true, tags: ["shame"] },
        { t: "furious", v: -1, tier: 0, adj: true, tags: ["anger"] },
        { t: "devastated", v: -1, tier: 0, adj: true, tags: ["sorrow"] },
        { t: "confused", v: 0, tier: 0, adj: true, tags: ["unsure"] },
        { t: "calm about it", v: 0, tier: 0, adj: true, tags: ["calm"] },
        { t: "at peace", v: 0, tier: 0, adj: true, tags: ["calm"] },
        { t: "not sure how to feel", v: 0, tier: 0, tags: ["unsure"] },
        { t: "calling it the best day of {pos} life", v: 1, tier: 0, tags: ["joy", "pride"] },
        { t: "pretending it doesn't bother {o}", v: -1, tier: 0, tags: ["denial"] },
        { t: "hoping nobody brings it up at Thanksgiving", v: -1, tier: 0, tags: ["shame", "worry"] },
        { t: "telling everyone it was {pos} plan all along", v: 1, tier: 1, tags: ["pride", "denial"] },
        { t: "already planning the sequel", v: 1, tier: 1, tags: ["scheme", "joy"] },
        { t: "throwing a party about it", v: 1, tier: 1, tags: ["joy", "ritual"] },
        { t: "treating it like a personal betrayal", v: -1, tier: 1, tags: ["anger"] },
        { t: "considering a lawsuit", v: -1, tier: 1, tags: ["anger", "scheme"] },
        { t: "refusing to discuss it before noon", v: -1, tier: 1, tags: ["denial", "anger"] },
        { t: "certain it's a sign from the universe", v: 0, tier: 1, tags: ["ritual", "unsure"] },
        { t: "humming about it constantly", v: 1, tier: 2, tags: ["ritual", "joy"] },
        { t: "in mourning, with a black armband and everything", v: -1, tier: 2, tags: ["sorrow", "ritual"] },
        { t: "keeping a candle lit until further notice", v: -1, tier: 2, tags: ["sorrow", "ritual"] },
        { t: "drafting a memoir", v: 0, tier: 2, tags: ["scheme", "pride"] },
        { t: "heartbroken", v: -1, tier: 0, adj: true, tags: ["sorrow"] },
        { t: "livid", v: -1, tier: 0, adj: true, tags: ["anger"] },
        { t: "acting like nothing happened", v: -1, tier: 0, tags: ["denial"] },
        { t: "lighting incense about it", v: 0, tier: 1, tags: ["ritual", "calm"] },
        { t: "ghostwriting {pos} own biography", v: 1, tier: 2, tags: ["scheme", "pride"] },
        { t: "telling the bees", v: 0, tier: 2, tags: ["ritual"] },
      ] },
      { k: "t", name: "aftertaste", opt: true, pool: [
        { t: "but won't admit it", tier: 0, tags: ["hidden"] }, { t: "for reasons nobody understands", tier: 0, tags: ["hidden"] },
        { t: "in a way that worries the family", tier: 0, tags: ["public"] }, { t: "and {has} said so on Facebook", tier: 0, tags: ["public"] },
        { t: "and blame{s} {thing}", tier: 0, tags: ["thing"] },
        { t: "and {has} started a podcast about it", tier: 1, tags: ["public"] },
        { t: "and {has} commissioned a portrait of {thing}", tier: 1, tags: ["public", "thing"] },
        { t: "and {has} been seen whispering to {thing}", tier: 2, tags: ["thing", "hidden"] },
        { t: "and won't go near {thing}", tier: 0, tags: ["thing"] }, { t: "and {has} written a song about {thing}", tier: 1, tags: ["public", "thing"] },
        { t: "and {has} filed for custody of {thing}", tier: 2, tags: ["thing", "public"] }, { t: "and {has} taken a vow of silence", tier: 2, tags: ["hidden"] },
      ] },
    ],
    grow: ["i", "t"],
  },

  // "[det] [intensity] [quality] place [clause]"
  where: {
    parts: [
      { k: "i", name: "intensity", opt: true, needs: "q", pool: [
        { t: "very", tier: 0, tags: ["degree"] }, { t: "mostly", tier: 0, tags: ["degree"] }, { t: "slightly", tier: 0, tags: ["degree"] },
        { t: "weirdly", tier: 1, tags: ["vibe"] }, { t: "suspiciously", tier: 1, tags: ["vibe"] },
        { t: "legally", tier: 2, tags: ["official"] }, { t: "spiritually", tier: 2, tags: ["beyond"] },
        { t: "officially", tier: 2, tags: ["official"] }, { t: "cosmically", tier: 2, tags: ["beyond"] },
      ] },
      { k: "q", name: "quality", opt: true, pool: [
        { t: "crowded", tier: 0, tags: ["people"] }, { t: "empty", tier: 0, tags: ["people"] }, { t: "fluorescent-lit", tier: 0, tags: ["light"] },
        { t: "freezing", tier: 0, tags: ["climate"] }, { t: "sticky", tier: 0, tags: ["climate"] }, { t: "suburban", tier: 0, tags: ["people"] },
        { t: "abandoned", tier: 1, tags: ["people", "eerie"] }, { t: "haunted", tier: 1, tags: ["eerie"] }, { t: "candlelit", tier: 1, tags: ["light"] }, { t: "flooded", tier: 1, tags: ["climate"] },
        { t: "underwater", tier: 2, tags: ["climate"] }, { t: "self-aware", tier: 2, tags: ["eerie"] }, { t: "tax-exempt", tier: 2, tags: ["official"] },
        { t: "dimly lit", tier: 0, tags: ["light"] }, { t: "strobe-lit", tier: 1, tags: ["light"] }, { t: "fog-filled", tier: 1, tags: ["climate"] },
        { t: "sovereign", tier: 2, tags: ["official"] }, { t: "zero-gravity", tier: 2, tags: ["climate"] }, { t: "time-looped", tier: 2, tags: ["eerie"] },
      ] },
      { k: "n", name: "place", pool: [
        { det: "the", t: "DMV", tier: 0, tags: ["civic"] },
        { det: "a", t: "Cracker Barrel off I-95", tier: 0, tags: ["food", "transit"] },
        { det: "the", t: "community pool", tier: 0, tags: ["leisure", "civic"] },
        { det: "a cousin's", t: "backyard barbecue", tier: 0, tags: ["food", "party"] },
        { det: "the", t: "self-checkout at Home Depot", tier: 0, tags: ["shops"] },
        { det: "a", t: "church rummage sale", tier: 0, tags: ["civic", "shops"] },
        { det: "a", t: "laundromat", tier: 0, tags: ["shops"] },
        { det: "an", t: "Olive Garden", tier: 0, tags: ["food"] },
        { det: "a", t: "wedding reception", tier: 0, tags: ["party"] },
        { det: "a", t: "corn maze", tier: 0, tags: ["nature", "leisure"] },
        { det: "a", t: "library", tier: 0, tags: ["civic"] },
        { det: "a", t: "ferry to nowhere in particular", tier: 1, tags: ["transit"] },
        { det: "the", t: "lost and found at the bowling alley", tier: 1, tags: ["leisure"] },
        { det: "a", t: "timeshare presentation", tier: 1, tags: ["shops"] },
        { det: "a", t: "mattress store", tier: 0, tags: ["shops"] },
        { det: "a", t: "lighthouse", tier: 1, tags: ["nature"] },
        { det: "an", t: "escape room", tier: 1, tags: ["leisure"] },
        { det: "a", t: "Renaissance faire", tier: 1, tags: ["leisure", "party"] },
        { det: "the", t: "back room of a Medieval Times", tier: 2, tags: ["food", "leisure"] },
        { det: "a", t: "submarine", tier: 2, tags: ["transit"] },
        { det: "a", t: "highway rest stop", tier: 0, tags: ["transit"] },
        { det: "a", t: "state park", tier: 0, tags: ["nature"] },
        { det: "a", t: "Greyhound bus at 3 a.m.", tier: 1, tags: ["transit"] },
        { det: "a", t: "petting zoo", tier: 1, tags: ["nature", "party"] },
        { det: "the", t: "moon's only Applebee's", tier: 2, tags: ["food", "transit"] },
        { det: "a", t: "going-out-of-business sale", tier: 1, tags: ["shops"] },
      ] },
      { k: "c", name: "clause", opt: true, pool: [
        { t: "during a power outage", tier: 0, tags: ["locale"] }, { t: "two towns over", tier: 0, tags: ["locale"] },
        { t: "next to {thing}", tier: 0, tags: ["thing"] },
        { t: "that was also a vape shop", tier: 1, tags: ["shop"] }, { t: "that is mostly a gift shop", tier: 1, tags: ["shop"] },
        { t: "run by {thing}", tier: 1, tags: ["thing"] }, { t: "guarded by {thing}", tier: 1, tags: ["thing"] },
        { t: "with no exit", tier: 2, tags: ["locale"] }, { t: "that only lends out ladders", tier: 2, tags: ["shop"] },
        { t: "across from {thing}", tier: 0, tags: ["thing"] }, { t: "that only takes payment in {thing}", tier: 2, tags: ["shop", "thing"] },
        { t: "that only exists on Tuesdays", tier: 2, tags: ["locale"] },
      ] },
    ],
    grow: ["q", "i", "c"],
  },

  // "a [intensity] [quality] noun [clause]"
  thing: {
    parts: [
      { k: "i", name: "intensity", opt: true, needs: "q", pool: [
        { t: "slightly", tier: 0, tags: ["degree"] }, { t: "extremely", tier: 0, tags: ["degree"] }, { t: "mostly", tier: 0, tags: ["degree"] },
        { t: "surprisingly", tier: 0, tags: ["degree"] }, { t: "very", tier: 0, tags: ["degree"] },
        { t: "suspiciously", tier: 1, tags: ["manner"] }, { t: "aggressively", tier: 1, tags: ["manner"] }, { t: "technically", tier: 1, tags: ["official"] },
        { t: "legally", tier: 2, tags: ["official"] }, { t: "spiritually", tier: 2, tags: ["beyond"] }, { t: "emotionally", tier: 2, tags: ["beyond"] },
        { t: "allegedly", tier: 1, tags: ["official"] }, { t: "officially", tier: 2, tags: ["official"] },
      ] },
      { k: "q", name: "quality", opt: true, pool: [
        { t: "loud", tier: 0, tags: ["sound"] }, { t: "quiet", tier: 0, tags: ["sound"] }, { t: "wet", tier: 0, tags: ["texture"] }, { t: "damp", tier: 0, tags: ["texture"] },
        { t: "tiny", tier: 0, tags: ["size"] }, { t: "enormous", tier: 0, tags: ["size"] }, { t: "sticky", tier: 0, tags: ["texture"] },
        { t: "laminated", tier: 0, tags: ["crafted"] }, { t: "borrowed", tier: 0, tags: ["history"] }, { t: "monogrammed", tier: 0, tags: ["crafted"] },
        { t: "glow-in-the-dark", tier: 1, tags: ["crafted"] }, { t: "haunted", tier: 1, tags: ["history"] }, { t: "inherited", tier: 1, tags: ["history"] },
        { t: "judgmental", tier: 1, tags: ["persona"] }, { t: "singing", tier: 1, tags: ["persona", "sound"] }, { t: "commemorative", tier: 1, tags: ["crafted"] },
        { t: "sentient", tier: 2, tags: ["persona"] }, { t: "bilingual", tier: 2, tags: ["persona"] }, { t: "recently divorced", tier: 2, tags: ["persona", "history"] },
        { t: "tax-exempt", tier: 2, tags: ["official"] }, { t: "ordained", tier: 2, tags: ["official", "persona"] },
        { t: "secondhand", tier: 0, tags: ["history"] },
      ] },
      { k: "n", name: "noun", pool: [
        { t: "folding chair", tier: 0, tags: ["home"] }, { t: "casserole dish", tier: 0, tags: ["kitchen"] }, { t: "wind chime", tier: 0, tags: ["garden", "music"] },
        { t: "bucket hat", tier: 0, tags: ["clothing"] }, { t: "kayak", tier: 0, tags: ["outdoors"] }, { t: "dog", tier: 0, tags: ["animals"] },
        { t: "lawn flamingo", tier: 0, tags: ["garden"] }, { t: "fondue set", tier: 0, tags: ["kitchen"] }, { t: "road map", tier: 0, tags: ["outdoors"] },
        { t: "accordion", tier: 0, tags: ["music"] },
        { t: "novelty fish", tier: 1, tags: ["animals", "home"] }, { t: "spoon", tier: 1, tags: ["kitchen"] }, { t: "jar of pickled eggs", tier: 1, tags: ["kitchen"] },
        { t: "rotary phone", tier: 1, tags: ["home"] }, { t: "Burger King crown", tier: 1, tags: ["clothing"] }, { t: "mime costume", tier: 1, tags: ["clothing"] },
        { t: "ventriloquist dummy named Gerald", tier: 2, tags: ["home", "music"] }, { t: "goose (a different goose)", tier: 2, tags: ["animals"] },
        { t: "oil painting of a horse in a suit", tier: 2, tags: ["home", "animals"] }, { t: "garden gnome", tier: 2, tags: ["garden"] },
        { t: "trophy for a sport that doesn't exist", tier: 2, tags: ["home"] },
        { t: "recliner", tier: 0, tags: ["home"] }, { t: "cardigan", tier: 0, tags: ["clothing"] }, { t: "cat", tier: 0, tags: ["animals"] },
        { t: "taxidermy owl", tier: 1, tags: ["animals", "home"] }, { t: "scarecrow with a law degree", tier: 2, tags: ["garden", "clothing"] },
      ] },
      { k: "c", name: "clause", opt: true, pool: [
        { t: "that was never returned", tier: 0, tags: ["history"] }, { t: "from the garage", tier: 0, tags: ["home"] },
        { t: "nobody will admit to owning", tier: 0, tags: ["history"] }, { t: "that belongs to {thing}", tier: 0, tags: ["nested"] },
        { t: "that still rings at night", tier: 1, tags: ["eerie"] }, { t: "from 1994", tier: 1, tags: ["history"] }, { t: "with a secret", tier: 1, tags: ["eerie"] },
        { t: "that once swallowed {thing}", tier: 1, tags: ["nested"] }, { t: "shaped like {thing}", tier: 1, tags: ["nested"] },
        { t: "that keeps showing up in photos", tier: 2, tags: ["eerie"] }, { t: "that has a lawyer", tier: 2, tags: ["persona"] },
        { t: "that remembers everything", tier: 2, tags: ["persona", "eerie"] }, { t: "that is in love with {thing}", tier: 2, tags: ["nested", "persona"] },
        { t: "from the attic", tier: 0, tags: ["home"] }, { t: "that was found in {thing}", tier: 0, tags: ["nested"] },
        { t: "from a previous marriage", tier: 1, tags: ["history"] },
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
  "who.r": { frame: "___ dentist", hint: "Whose person this is, as another whole person: “your uncle's” dentist." },
  "who.w": { frame: "___ uncle", hint: "Whose they are: “your”, “his”, “someone's”, “a”." },
  "who.d": { frame: "your ___ uncle", hint: "Describes a person. An adjective or short phrase." },
  "who.n": { frame: "your ___", hint: "A person, the way you'd refer to them: “cousin Dale”, “mail carrier”.", pronouns: true },
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
  // What's worth keeping: the character. Kept characters collect their bits; tell another about them.
  keep: { card: "who", name: "The cast", verb: "Keep this character", note: "People you've kept. Everything that has happened to them so far." },
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
        { t: "bruised", tier: 0, tags: ["touch"] }, { t: "cold", tier: 0, tags: ["touch"] }, { t: "small", tier: 0, tags: ["shape"] }, { t: "wet", tier: 0, tags: ["touch"] }, { t: "last", tier: 0, tags: ["memory"] },
        { t: "open", tier: 0, tags: ["shape"] }, { t: "green", tier: 0, tags: ["color"] }, { t: "folded", tier: 0, tags: ["shape"] }, { t: "paper", tier: 0, tags: ["material"] }, { t: "salt-white", tier: 0, tags: ["color"] },
        { t: "patient", tier: 1, tags: ["alive"] }, { t: "forgetful", tier: 1, tags: ["memory", "alive"] }, { t: "unlit", tier: 1, tags: ["color"] }, { t: "borrowed", tier: 1, tags: ["memory"] }, { t: "half-remembered", tier: 1, tags: ["memory"] },
        { t: "weightless", tier: 2, tags: ["material"] }, { t: "invented", tier: 2, tags: ["memory"] }, { t: "inside-out", tier: 2, tags: ["shape"] }, { t: "sleeping", tier: 2, tags: ["alive"] }, { t: "glass", tier: 2, tags: ["material"] },
        { t: "wooden", tier: 0, tags: ["material"] }, { t: "old", tier: 0, tags: ["memory"] }, { t: "lamp-blue", tier: 1, tags: ["color"] },
        { t: "dreaming", tier: 2, tags: ["alive"] }, { t: "never-was", tier: 2, tags: ["memory"] }, { t: "endless", tier: 2, tags: ["shape"] },
      ] },
      { k: "n", name: "image", frame: "a ___", hint: "The thing the poem looks at. A singular noun.", pool: [
        { t: "pear", tier: 0, tags: ["nature"] }, { t: "kettle", tier: 0, tags: ["house"] }, { t: "window", tier: 0, tags: ["house"] }, { t: "heron", tier: 0, tags: ["nature"] }, { t: "coat", tier: 0, tags: ["house"] },
        { t: "letter", tier: 0, tags: ["house", "word"] }, { t: "bicycle", tier: 0, tags: ["house"] }, { t: "field", tier: 0, tags: ["nature"] }, { t: "stone", tier: 0, tags: ["nature"] }, { t: "lamp", tier: 0, tags: ["house"] }, { t: "river", tier: 0, tags: ["nature"] },
        { t: "question", tier: 1, tags: ["word"] }, { t: "silence", tier: 1, tags: ["word"] }, { t: "apology", tier: 1, tags: ["word"] }, { t: "hallway", tier: 1, tags: ["house"] }, { t: "weather", tier: 1, tags: ["sky"] },
        { t: "century", tier: 2, tags: ["time"] }, { t: "alphabet", tier: 2, tags: ["word"] }, { t: "telephone of moths", tier: 2, tags: ["nature", "word"] }, { t: "small god", tier: 2, tags: ["sky"] }, { t: "unfinished bridge", tier: 2, tags: ["house"] },
        { t: "second sun", tier: 2, tags: ["sky"] },
        { t: "cellar door", tier: 1, tags: ["house"] }, { t: "forecast", tier: 1, tags: ["sky", "word"] },
        { t: "house made of rain", tier: 2, tags: ["house", "sky"] }, { t: "minute that won't end", tier: 2, tags: ["time"] }, { t: "orchard of clocks", tier: 2, tags: ["nature", "time"] },
      ] },
      { k: "c", name: "clause", opt: true, trailing: true, frame: "a pear ___", hint: "Trails the image: “on the sill”, “nobody asked for”.", pool: [
        { t: "on the sill", tier: 0, tags: ["place"] }, { t: "with one sleeve", tier: 0, tags: ["trait"] }, { t: "in the grass", tier: 0, tags: ["place"] }, { t: "of the morning", tier: 0, tags: ["time"] },
        { t: "nobody asked for", tier: 1, tags: ["memory"] }, { t: "that kept its promise", tier: 1, tags: ["memory"] }, { t: "brought back from {where}", tier: 1, tags: ["place"] },
        { t: "that remembers being rain", tier: 2, tags: ["memory"] }, { t: "shaped like {image}", tier: 2, tags: ["likeness"] },
        { t: "of the evening", tier: 0, tags: ["time"] }, { t: "with a chipped rim", tier: 0, tags: ["trait"] },
        { t: "that dreams of being {image}", tier: 2, tags: ["likeness", "memory"] }, { t: "found in a coat pocket", tier: 1, tags: ["place"] },
      ] },
    ],
    grow: ["q", "c"],
  },
  motion: {
    parts: [
      { k: "a", name: "adverb", opt: true, frame: "the pear ___ leans", hint: "How. An adverb before the motion.", pool: [
        { t: "slowly", tier: 0, tags: ["pace"] }, { t: "still", tier: 0, tags: ["hush"] }, { t: "quietly", tier: 0, tags: ["hush"] }, { t: "almost", tier: 0, tags: ["pace"] },
        { t: "patiently", tier: 1, tags: ["pace"] }, { t: "gladly", tier: 1, tags: ["will"] }, { t: "without asking", tier: 1, tags: ["will"] },
        { t: "backwards", tier: 2, tags: ["reverse"] }, { t: "in reverse", tier: 2, tags: ["reverse"] }, { t: "all at once", tier: 2, tags: ["pace"] },
        { t: "unhurriedly", tier: 1, tags: ["pace"] }, { t: "a hundred times over", tier: 2, tags: ["pace"] },
      ] },
      { k: "n", name: "motion", frame: "the pear ___", hint: "What the image does, in the present tense: “leans”, “waits”.", pool: [
        { t: "leans", tier: 0, tags: ["rest"] }, { t: "waits", tier: 0, tags: ["rest"] }, { t: "cools", tier: 0, tags: ["change"] }, { t: "rests", tier: 0, tags: ["rest"] }, { t: "turns", tier: 0, tags: ["change"] }, { t: "shines", tier: 0, tags: ["light"] },
        { t: "keeps its own counsel", tier: 1, tags: ["voice"] }, { t: "forgets its name", tier: 1, tags: ["change"] }, { t: "listens", tier: 1, tags: ["voice"] }, { t: "holds its breath", tier: 1, tags: ["voice", "rest"] },
        { t: "unlearns the light", tier: 2, tags: ["light", "change"] }, { t: "speaks in a dead language", tier: 2, tags: ["voice"] }, { t: "becomes a door", tier: 2, tags: ["change"] },
        { t: "holds still", tier: 1, tags: ["rest"] }, { t: "will not talk", tier: 1, tags: ["voice"] }, { t: "stays silent", tier: 1, tags: ["voice"] },
        { t: "walks into a mirror", tier: 2, tags: ["change"] }, { t: "swallows stars", tier: 2, tags: ["light"] },
        { t: "glows", tier: 0, tags: ["light"] }, { t: "outgrows itself", tier: 1, tags: ["change"] }, { t: "sings without a mouth", tier: 2, tags: ["voice"] },
      ] },
      { k: "t", name: "detail", opt: true, trailing: true, frame: "the pear leans ___", hint: "Trails the motion: “for a while”, “like a held note”.", pool: [
        { t: "for a while", tier: 0, tags: ["time"] }, { t: "again", tier: 0, tags: ["time"] }, { t: "the way it did", tier: 0, tags: ["time"] },
        { t: "as if waiting for you", tier: 1, tags: ["likeness"] }, { t: "like a held note", tier: 1, tags: ["likeness"] },
        { t: "until the walls agree", tier: 2, tags: ["time"] }, { t: "in the voice of {image}", tier: 2, tags: ["likeness"] },
        { t: "until the river forgets", tier: 2, tags: ["time"] }, { t: "as if it were {image}", tier: 2, tags: ["likeness"] },
      ] },
    ],
    grow: ["a", "t"],
  },
  where: {
    noun: true,
    parts: [
      { k: "q", name: "quality", opt: true, frame: "in the ___ kitchen", hint: "Describes the place. An adjective.", pool: [
        { t: "empty", tier: 0, tags: ["space"] }, { t: "narrow", tier: 0, tags: ["space"] }, { t: "upstairs", tier: 0, tags: ["space"] }, { t: "flooded", tier: 0, tags: ["water"] }, { t: "far", tier: 0, tags: ["space"] },
        { t: "cold", tier: 0, tags: ["water"] }, { t: "small", tier: 0, tags: ["space"] }, { t: "wet", tier: 0, tags: ["water"] }, { t: "old", tier: 0, tags: ["age"] }, { t: "green", tier: 0, tags: ["light"] }, { t: "bright", tier: 0, tags: ["light"] },
        { t: "lonely", tier: 1, tags: ["alive"] }, { t: "patient", tier: 1, tags: ["alive"] }, { t: "half-built", tier: 1, tags: ["age"] }, { t: "humming", tier: 1, tags: ["alive"] },
        { t: "folded", tier: 2, tags: ["space"] }, { t: "invisible", tier: 2, tags: ["light"] }, { t: "quiet-as-a-held-breath", tier: 2, tags: ["alive"] },
        { t: "unswept", tier: 1, tags: ["age"] }, { t: "almost-blue", tier: 1, tags: ["light"] }, { t: "rented", tier: 1, tags: ["age"] },
        { t: "drowned", tier: 2, tags: ["water"] }, { t: "unmapped", tier: 2, tags: ["space", "age"] }, { t: "breathing", tier: 2, tags: ["alive"] },
        { t: "worn", tier: 0, tags: ["age"] }, { t: "lamplit", tier: 1, tags: ["light"] },
        { t: "moon-silvered", tier: 2, tags: ["light"] }, { t: "underwater", tier: 2, tags: ["water"] },
      ] },
      { k: "n", name: "place", det: ["in the", "on the", "at the", "under the", "near the", "in a", "under a", "beside a", "on a", "at a"], frame: "{det} ___", hint: "A place, with how the image is placed in it (in, on, under…).", pool: [
        { det: "in the", t: "kitchen", tier: 0, tags: ["house"] }, { det: "at the", t: "station", tier: 0, tags: ["town"] }, { det: "on the", t: "shore", tier: 0, tags: ["water"] },
        { det: "in a", t: "parking lot", tier: 0, tags: ["town"] }, { det: "near the", t: "window", tier: 0, tags: ["house"] }, { det: "under the", t: "stairs", tier: 0, tags: ["house"] },
        { det: "in the", t: "garden", tier: 0, tags: ["land"] }, { det: "in the", t: "orchard", tier: 0, tags: ["land"] }, { det: "on the", t: "porch", tier: 0, tags: ["house"] }, { det: "at the", t: "bakery", tier: 0, tags: ["town"] },
        { det: "in the", t: "laundromat", tier: 0, tags: ["town"] }, { det: "on the", t: "pier", tier: 0, tags: ["water"] }, { det: "in the", t: "hallway", tier: 0, tags: ["house"] }, { det: "in a", t: "field", tier: 0, tags: ["land"] },
        { det: "at the", t: "lake", tier: 0, tags: ["water"] }, { det: "in the", t: "car", tier: 0, tags: ["town", "road"] }, { det: "in the", t: "chapel", tier: 1, tags: ["hall"] }, { det: "in the", t: "observatory", tier: 1, tags: ["hall", "sky"] },
        { det: "at the", t: "edge of the map", tier: 1, tags: ["road"] }, { det: "in the", t: "weather of a photograph", tier: 2, tags: ["sky", "dream"] }, { det: "on the", t: "underside of the moon", tier: 2, tags: ["sky"] },
        { det: "in a", t: "hospital corridor", tier: 1, tags: ["hall"] }, { det: "at the", t: "bottom of a well", tier: 1, tags: ["water"] }, { det: "beside a", t: "closed theater", tier: 1, tags: ["hall", "town"] },
        { det: "in the", t: "inside of a bell", tier: 2, tags: ["dream", "hall"] }, { det: "in a", t: "city of paper", tier: 2, tags: ["dream", "town"] }, { det: "under a", t: "second sky", tier: 2, tags: ["sky"] },
        { det: "on a", t: "hill", tier: 0, tags: ["land"] }, { det: "at a", t: "bus stop", tier: 0, tags: ["town", "road"] }, { det: "in a", t: "small town", tier: 0, tags: ["town"] },
        { det: "at a", t: "crossroads at night", tier: 1, tags: ["road"] }, { det: "on a", t: "road with no sign", tier: 1, tags: ["road"] },
        { det: "on a", t: "stone step", tier: 1, tags: ["road", "house"] }, { det: "in a", t: "side street", tier: 1, tags: ["road", "town"] },
        { det: "in a", t: "room of mirrors", tier: 2, tags: ["dream", "house"] }, { det: "at a", t: "bus stop for ghosts", tier: 2, tags: ["dream", "road"] }, { det: "under a", t: "sunken sky", tier: 2, tags: ["sky", "water"] },
        { det: "in a", t: "flooded cellar", tier: 1, tags: ["water", "house"] },
      ] },
      { k: "c", name: "clause", opt: true, trailing: true, frame: "in the kitchen ___", hint: "Trails the place: “after the rain”.", pool: [
        { t: "after the rain", tier: 0, tags: ["time"] }, { t: "before anyone wakes", tier: 0, tags: ["time"] },
        { t: "nobody visits", tier: 1, tags: ["absence"] }, { t: "that smells of oranges", tier: 1, tags: ["sense"] },
        { t: "where clocks are buried", tier: 2, tags: ["dream", "time"] }, { t: "that is also {image}", tier: 2, tags: ["dream"] },
        { t: "that hums at night", tier: 1, tags: ["sense"] }, { t: "nobody remembers", tier: 1, tags: ["absence"] },
      ] },
    ],
    grow: ["q", "c"],
  },
  time: {
    parts: [
      { k: "n", name: "time", frame: "___", hint: "When: “at dusk”, “in March”.", pool: [
        { t: "at dusk", tier: 0, tags: ["day"] }, { t: "this morning", tier: 0, tags: ["day"] }, { t: "in March", tier: 0, tags: ["calendar"] }, { t: "after supper", tier: 0, tags: ["day"] }, { t: "all afternoon", tier: 0, tags: ["day"] },
        { t: "in the year of the long rain", tier: 1, tags: ["calendar"] }, { t: "an hour before anyone", tier: 1, tags: ["hour"] }, { t: "the day you left", tier: 1, tags: ["memory"] },
        { t: "on the eighth day of the week", tier: 2, tags: ["calendar"] }, { t: "at the end of a sentence", tier: 2, tags: ["vague", "hour"] }, { t: "before time was invented", tier: 2, tags: ["calendar", "vague"] },
        { t: "an hour ago", tier: 0, tags: ["hour"] }, { t: "an hour past all hours", tier: 1, tags: ["hour"] }, { t: "on a Monday that is also a moon", tier: 2, tags: ["calendar"] },
        { t: "sometimes", tier: 0, tags: ["vague"] }, { t: "someday soon", tier: 1, tags: ["vague"] }, { t: "sixty seconds, sideways", tier: 2, tags: ["hour"] },
        { t: "in winter", tier: 0, tags: ["calendar"] }, { t: "at noon", tier: 0, tags: ["hour", "day"] }, { t: "now and then", tier: 0, tags: ["vague"] },
        { t: "the summer you were nine", tier: 1, tags: ["memory", "calendar"] }, { t: "the last time we spoke", tier: 1, tags: ["memory"] }, { t: "once or twice", tier: 1, tags: ["vague"] },
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
        B(0, "Nothing stirs."),
        B(0, "{Image}, again."),
        B(1, "Nothing is only what it is."),
        B(1, "{Image}: a kind of window."),
        B(2, "Light, a ghost, a lung of dust."),
        B(2, "A moth is mixing salt and dusk."),
      ] },
      second: { name: "the second look", lines: [
        B(0, "I stand there longer than I meant to."),
        B(0, "Someone is cooking somewhere."),
        B(1, "The hour forgets which way it was going."),
        B(2, "A door opens onto another door."),
        B(0, "I stand a bit too long."),
        B(0, "A pot is boiling, far off."),
        B(1, "An hour forgot which way it was going."),
        B(2, "A door lays down and turns to a road."),
      ] },
      close: { name: "the close", lines: [
        B(0, "{Time}, and then not."),
        B(1, "That is all the morning would admit."),
        B(2, "And the poem, embarrassed, leaves."),
        B(0, "{Time}, and that is all."),
        B(1, "That is all that dusk will admit."),
        B(2, "And this song, shy, walks out."),
      ] },
      coda: { name: "the coda", lines: [
        B(0, "Remember {image}."),
        B(1, "{Where}: keep it."),
        B(2, "Wake {image}, gently, in reverse."),
        B(0, "Hold on to {image}."),
        B(1, "{Where}: that is all I know."),
        B(2, "Call {image} back, softly, to a dawn of salt."),
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
        B(0, "{Where}, all of it stays far off."),
        B(0, "Out on a road, a car. And a hush."),
        B(1, "A wall holds what it was told."),
        B(2, "A stool is lost in a wood of birds."),
      ] },
      verse2: { name: "the second verse", lines: [
        B(0, "I come back, {time}."),
        B(1, "Nobody has moved the chairs."),
        B(2, "The house has learned my name and spends it."),
        B(0, "I go back, {time}."),
        B(1, "No chair is out of its spot."),
        B(2, "A loft has my sound, and sings it back."),
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
  keep: { card: "image", name: "Images", verb: "Keep this image", note: "Images you've kept, and the lines they've been in. Bring one back and let everything else move." },
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

// ---------- Sayings ----------
// Folk wisdom: advice, who it's about, and (in longer forms) the reason. "Never trust a heron
// that knows your name, for it has already told the others." The advice carries a mood (a
// warning, a blessing, or neither), and so does the reason, so the dial can make the reason
// undo the warning. Pronoun tokens in the reason agree with the subject ("for it has", "for
// they have").
const SAY_SCHEMAS = {
  rule: {
    parts: [
      { k: "w", name: "when", opt: true, odds: 0.25, frame: "___ never trust a heron", hint: "When the advice holds, with its comma: “After dark,”.", pool: [
        { t: "after dark,", tier: 0, tags: ["time"] }, { t: "in March,", tier: 0, tags: ["time"] }, { t: "above all,", tier: 0, tags: ["rule"] }, { t: "as a rule,", tier: 0, tags: ["rule"] },
        { t: "on a Sunday,", tier: 0, tags: ["time"] }, { t: "at a wedding,", tier: 0, tags: ["gathering"] }, { t: "in a small town,", tier: 0, tags: ["place"] },
        { t: "in a leap year,", tier: 1, tags: ["time"] }, { t: "on the ferry,", tier: 1, tags: ["place"] }, { t: "during a full moon,", tier: 1, tags: ["time"] },
        { t: "south of the river,", tier: 1, tags: ["place"] }, { t: "at a potluck,", tier: 1, tags: ["gathering"] },
        { t: "in the next life,", tier: 2, tags: ["time"] }, { t: "underwater,", tier: 2, tags: ["place"] }, { t: "once the bees have voted,", tier: 2, tags: ["rule"] },
        { t: "since spring,", tier: 1, tags: ["time"] }, { t: "so say saints,", tier: 2, tags: ["rule"] },
        { t: "at a funeral,", tier: 0, tags: ["gathering"] }, { t: "at sea,", tier: 0, tags: ["place"] }, { t: "at a bake sale,", tier: 1, tags: ["gathering"] },
        { t: "on the moon,", tier: 2, tags: ["place"] }, { t: "after the end of the world,", tier: 2, tags: ["time"] },
      ] },
      { k: "n", name: "advice", mood: true, frame: "___ a heron", hint: "The advice, as an order that takes someone: “never trust”, “always thank”. Its mood: a warning is bad, a blessing good.", pool: [
        { t: "never trust", v: -1, tier: 0, tags: ["trust"] }, { t: "never lend money to", v: -1, tier: 0, tags: ["money"] }, { t: "never argue with", v: -1, tier: 0, tags: ["talk"] },
        { t: "beware of", v: -1, tier: 0, tags: ["trust"] }, { t: "never turn your back on", v: -1, tier: 0, tags: ["trust"] }, { t: "never play cards with", v: -1, tier: 0, tags: ["money", "company"] },
        { t: "don't marry", v: -1, tier: 0, tags: ["love"] }, { t: "never ask directions from", v: -1, tier: 0, tags: ["talk"] }, { t: "avoid", v: -1, tier: 0, tags: ["shun"] },
        { t: "never make eye contact with", v: -1, tier: 0, tags: ["talk", "shun"] }, { t: "watch out for", v: -1, tier: 0, tags: ["trust"] },
        { t: "never go fishing with", v: -1, tier: 1, tags: ["company"] }, { t: "never share a canoe with", v: -1, tier: 1, tags: ["company"] }, { t: "never lend your good pen to", v: -1, tier: 1, tags: ["money"] },
        { t: "never introduce your mother to", v: -1, tier: 1, tags: ["love"] }, { t: "shun", v: -1, tier: 1, tags: ["shun"] }, { t: "sue", v: -1, tier: 1, tags: ["shun", "money"] },
        { t: "never sing in front of", v: -1, tier: 1, tags: ["talk"] }, { t: "never confess your middle name to", v: -1, tier: 2, tags: ["talk"] },
        { t: "never let your soup be seen by", v: -1, tier: 2, tags: ["company"] }, { t: "never teach a card trick to", v: -1, tier: 2, tags: ["company", "talk"] }, { t: "spurn", v: -1, tier: 1, tags: ["shun"] },
        { t: "always thank", v: 1, tier: 0, tags: ["kindness"] }, { t: "be kind to", v: 1, tier: 0, tags: ["kindness"] }, { t: "always make room for", v: 1, tier: 0, tags: ["kindness"] },
        { t: "trust", v: 1, tier: 0, tags: ["trust"] }, { t: "listen to", v: 1, tier: 0, tags: ["talk"] }, { t: "always wave to", v: 1, tier: 0, tags: ["kindness"] },
        { t: "always tip", v: 1, tier: 0, tags: ["money", "kindness"] }, { t: "save a seat for", v: 1, tier: 0, tags: ["kindness", "company"] }, { t: "forgive", v: 1, tier: 0, tags: ["kindness"] }, { t: "always laugh at", v: 1, tier: 0, tags: ["kindness", "talk"] },
        { t: "always set a place for", v: 1, tier: 1, tags: ["kindness", "company"] }, { t: "leave the porch light on for", v: 1, tier: 1, tags: ["kindness"] }, { t: "spoil", v: 1, tier: 1, tags: ["love"] },
        { t: "salute", v: 1, tier: 1, tags: ["honor"] }, { t: "write letters to", v: 1, tier: 1, tags: ["talk", "love"] }, { t: "marry", v: 1, tier: 1, tags: ["love"] },
        { t: "serenade", v: 1, tier: 2, tags: ["love", "talk"] }, { t: "knight", v: 1, tier: 2, tags: ["honor"] }, { t: "name your firstborn after", v: 1, tier: 2, tags: ["honor", "love"] },
        { t: "pity", v: 0, tier: 0, tags: ["kindness"] }, { t: "keep an eye on", v: 0, tier: 0, tags: ["trust"] }, { t: "make peace with", v: 0, tier: 0, tags: ["kindness"] },
        { t: "learn from", v: 0, tier: 0, tags: ["honor"] }, { t: "never underestimate", v: 0, tier: 0, tags: ["trust", "honor"] }, { t: "respect", v: 0, tier: 0, tags: ["honor"] },
        { t: "humor", v: 0, tier: 1, tags: ["kindness"] }, { t: "study", v: 0, tier: 1, tags: ["honor"] }, { t: "soothe", v: 0, tier: 1, tags: ["kindness"] },
        { t: "count the spoons after a visit from", v: 0, tier: 1, tags: ["money", "trust"] }, { t: "never wake", v: 0, tier: 0, tags: ["trust"] },
        { t: "always know where you stand with", v: 0, tier: 1, tags: ["trust"] }, { t: "speak softly to", v: 0, tier: 1, tags: ["talk"] },
        { t: "never ask the age of", v: 0, tier: 2, tags: ["talk"] }, { t: "leave a small offering for", v: 0, tier: 2, tags: ["honor"] }, { t: "never correct the spelling of", v: 0, tier: 2, tags: ["talk"] },
        { t: "never date", v: -1, tier: 0, tags: ["love"] },
      ] },
    ],
    grow: ["w"],
  },
  who: {
    noun: true,
    parts: [
      { k: "q", name: "quality", opt: true, odds: 0.3, frame: "a ___ heron", hint: "Describes them. An adjective.", pool: [
        { t: "wet", tier: 0, tags: ["looks"] }, { t: "tall", tier: 0, tags: ["looks"] }, { t: "quiet", tier: 0, tags: ["manner"] }, { t: "retired", tier: 0, tags: ["life"] }, { t: "smiling", tier: 0, tags: ["manner"] },
        { t: "barefoot", tier: 0, tags: ["looks"] }, { t: "well-dressed", tier: 0, tags: ["looks"] }, { t: "hungry", tier: 0, tags: ["state"] }, { t: "lonely", tier: 0, tags: ["state"] },
        { t: "over-friendly", tier: 1, tags: ["manner"] }, { t: "freshly divorced", tier: 1, tags: ["life"] }, { t: "bilingual", tier: 1, tags: ["status"] }, { t: "recently knighted", tier: 1, tags: ["status"] },
        { t: "suspiciously helpful", tier: 1, tags: ["manner"] }, { t: "unlicensed", tier: 1, tags: ["status"] }, { t: "sunburnt", tier: 0, tags: ["looks"] }, { t: "sober", tier: 0, tags: ["state"] },
        { t: "invisible", tier: 2, tags: ["uncanny"] }, { t: "ordained", tier: 2, tags: ["status"] }, { t: "laminated", tier: 2, tags: ["uncanny"] }, { t: "time-traveling", tier: 2, tags: ["uncanny"] }, { t: "haunted", tier: 2, tags: ["uncanny"] },
        { t: "sleepy", tier: 0, tags: ["state"] }, { t: "smug", tier: 1, tags: ["manner"] },
        { t: "widowed", tier: 0, tags: ["life"] }, { t: "twice-married", tier: 1, tags: ["life"] }, { t: "Vatican-approved", tier: 2, tags: ["status"] },
      ] },
      { k: "n", name: "subject", pronouns: true, det: ["a", "the", "any", "your"], frame: "{det} ___", hint: "Who the advice is about, with pronouns (a heron is “it”).", pool: [
        { det: "a", t: "heron", ...IT, tier: 0, tags: ["birds"] }, { det: "a", t: "man", ...HE, tier: 0, tags: ["folk"] }, { det: "a", t: "woman", ...SHE, tier: 0, tags: ["folk"] },
        { det: "a", t: "dentist", ...THEY, tier: 0, tags: ["trades"] }, { det: "a", t: "goose", ...IT, tier: 0, tags: ["birds"] }, { det: "a", t: "dog", ...IT, tier: 0, tags: ["beasts"] },
        { det: "a", t: "cat", ...IT, tier: 0, tags: ["beasts"] }, { det: "your", t: "neighbor", ...THEY, tier: 0, tags: ["folk"] }, { det: "a", t: "priest", ...HE, tier: 0, tags: ["holy", "trades"] },
        { det: "a", t: "barber", ...HE, tier: 0, tags: ["trades"] }, { det: "a", t: "landlord", ...THEY, tier: 0, tags: ["trades"] }, { det: "a", t: "fisherman", ...HE, tier: 0, tags: ["sea", "trades"] },
        { det: "a", t: "widow", ...SHE, tier: 0, tags: ["folk", "kin"] }, { det: "a", t: "lawyer", ...THEY, tier: 0, tags: ["trades"] }, { det: "a", t: "baker", ...SHE, tier: 0, tags: ["trades"] },
        { det: "a", t: "horse", ...IT, tier: 0, tags: ["beasts"] }, { det: "a", t: "crow", ...IT, tier: 0, tags: ["birds"] }, { det: "a", t: "sailor", ...HE, tier: 0, tags: ["sea"] },
        { det: "a", t: "tailor", ...HE, tier: 0, tags: ["trades"] }, { det: "your", t: "sister", ...SHE, tier: 0, tags: ["kin"] }, { det: "a", t: "stranger", ...THEY, tier: 0, tags: ["folk"] },
        { det: "a", t: "squirrel", ...IT, tier: 0, tags: ["beasts"] }, { det: "a", t: "cousin", ...THEY, tier: 0, tags: ["kin"] },
        { det: "a", t: "accordion player", ...HE, tier: 1, tags: ["show"] }, { det: "a", t: "lighthouse keeper", ...SHE, tier: 1, tags: ["sea", "trades"] }, { det: "a", t: "magician", ...HE, tier: 1, tags: ["show"] },
        { det: "a", t: "swan", ...IT, tier: 1, tags: ["birds"] }, { det: "a", t: "weatherman", ...HE, tier: 1, tags: ["trades", "show"] }, { det: "a", t: "goat", ...IT, tier: 1, tags: ["beasts"] },
        { det: "a", t: "mime", ...THEY, tier: 1, tags: ["show"] }, { det: "a", t: "notary public", ...SHE, tier: 1, tags: ["trades"] }, { det: "a", t: "substitute teacher", ...HE, tier: 1, tags: ["trades"] },
        { det: "the", t: "tax man", ...HE, tier: 1, tags: ["trades"] }, { det: "a", t: "snail", ...IT, tier: 1, tags: ["beasts"] }, { det: "a", t: "saint", ...SHE, tier: 1, tags: ["holy"] },
        { det: "a", t: "parrot", ...IT, tier: 1, tags: ["birds"] },
        { det: "a", t: "ghost", ...IT, tier: 2, tags: ["uncanny"] }, { det: "the", t: "moon", ...IT, tier: 2, tags: ["sky"] }, { det: "a", t: "small god", ...IT, tier: 2, tags: ["holy", "uncanny"] },
        { det: "a", t: "lighthouse", ...IT, tier: 2, tags: ["sea", "objects"] }, { det: "a", t: "weathervane", ...IT, tier: 2, tags: ["sky", "objects"] }, { det: "a", t: "ventriloquist's dummy", ...IT, tier: 2, tags: ["objects", "show"] },
        { det: "a", t: "soup", ...IT, tier: 2, tags: ["kitchen"] }, { det: "any", t: "casserole", ...IT, tier: 2, tags: ["kitchen"] },
        { det: "a", t: "nun", ...SHE, tier: 0, tags: ["holy"] }, { det: "a", t: "harbor master", ...HE, tier: 1, tags: ["sea", "trades"] },
        { det: "a", t: "church organist", ...SHE, tier: 1, tags: ["holy", "show"] },
      ] },
      { k: "c", name: "clause", opt: true, trailing: true, frame: "a heron ___", hint: "Trails the subject: “that knows your name”, “with two canoes”.", pool: [
        { t: "that knows your name", tier: 0, tags: ["knows"] }, { t: "with two canoes", tier: 0, tags: ["owns"] }, { t: "that won't sit down", tier: 0, tags: ["habit"] },
        { t: "that calls you “champ”", tier: 0, tags: ["knows"] }, { t: "with clean shoes", tier: 0, tags: ["owns"] }, { t: "in a hurry", tier: 0, tags: ["habit"] }, { t: "with a boat", tier: 0, tags: ["owns"] },
        { t: "that whistles", tier: 0, tags: ["habit"] }, { t: "that owns a van", tier: 0, tags: ["owns"] },
        { t: "with opinions about soup", tier: 1, tags: ["odd"] }, { t: "that follows you home", tier: 1, tags: ["habit"] }, { t: "with a second, smaller wallet", tier: 1, tags: ["owns"] },
        { t: "that is between boats", tier: 1, tags: ["owns", "odd"] }, { t: "that laughs at funerals", tier: 1, tags: ["habit"] }, { t: "that hums in church", tier: 1, tags: ["habit"] },
        { t: "that claims to be your cousin", tier: 1, tags: ["knows"] }, { t: "that was raised by {who}", tier: 1, tags: ["knows"] }, { t: "that has never seen Ohio", tier: 1, tags: ["odd"] },
        { t: "that has met {who}", tier: 2, tags: ["knows"] }, { t: "that is secretly {who}", tier: 2, tags: ["knows"] }, { t: "with a lawyer", tier: 2, tags: ["owns"] },
        { t: "that remembers being rain", tier: 2, tags: ["odd"] }, { t: "that sells umbrellas indoors", tier: 2, tags: ["odd", "habit"] },
        { t: "with a pet cloud", tier: 2, tags: ["owns", "odd"] },
      ] },
    ],
    grow: ["c", "q"],
  },
  why: {
    parts: [
      { k: "n", name: "reason", mood: true, frame: "never trust a heron, ___", hint: "Why, starting with its joining word (“for”, “because”, “unless”). Pronouns agree with the subject: “for {p} {has}…”.", pool: [
        { t: "for {p} {has} already told the others", v: -1, tier: 0, tags: ["company"] }, { t: "for {p} will want something back", v: -1, tier: 0, tags: ["debt"] },
        { t: "for {p} {has} nothing to lose", v: -1, tier: 0, tags: ["debt"] }, { t: "because {p} remember{s} everything", v: -1, tier: 0, tags: ["debt"] },
        { t: "for {p} {is} never alone", v: -1, tier: 0, tags: ["company"] }, { t: "because {p} always bring{s} a friend", v: -1, tier: 0, tags: ["company"] },
        { t: "for {p} will want a favor", v: -1, tier: 0, tags: ["debt"] }, { t: "for {p} {has} a key to your house", v: -1, tier: 1, tags: ["mystery"] },
        { t: "since {p} sulk{s}", v: -1, tier: 1, tags: ["habit"] }, { t: "since {p} spit{s}", v: -1, tier: 1, tags: ["habit"] },
        { t: "for {p} {is} owed three geese", v: -1, tier: 2, tags: ["debt"] }, { t: "for {p} {is} the moon in a trench coat", v: -1, tier: 2, tags: ["mystery"] },
        { t: "for {p} will remember you kindly", v: 1, tier: 0, tags: ["kindness"] }, { t: "because {p} {was} once like you", v: 1, tier: 0, tags: ["kindness"] },
        { t: "for {p} always repay{s} a kindness", v: 1, tier: 0, tags: ["kindness", "debt"] }, { t: "and {p} will bring soup", v: 1, tier: 0, tags: ["kindness"] },
        { t: "and your gutters will never clog", v: 1, tier: 1, tags: ["omen"] }, { t: "for {p} will carry your name into the next town", v: 1, tier: 1, tags: ["kindness"] },
        { t: "since {p} sing{s} so sweetly", v: 1, tier: 1, tags: ["habit"] }, { t: "and {p} will bring a pie at a bad moment", v: 1, tier: 1, tags: ["kindness", "habit"] },
        { t: "for {p} {has} a cousin in the weather", v: 1, tier: 2, tags: ["omen"] }, { t: "and the bees will tell the others", v: 1, tier: 2, tags: ["omen", "company"] },
        { t: "for {p} {is} neither friend nor foe", v: 0, tier: 0, tags: ["mystery"] }, { t: "unless it is Tuesday", v: 0, tier: 0, tags: ["terms"] },
        { t: "for {p} {is} only passing through", v: 0, tier: 0, tags: ["mystery"] }, { t: "and never on a Sunday", v: 0, tier: 0, tags: ["terms"] },
        { t: "and do not ask why", v: 0, tier: 1, tags: ["terms", "mystery"] }, { t: "for reasons {p} will not explain", v: 0, tier: 1, tags: ["mystery"] },
        { t: "until the river thaws", v: 0, tier: 1, tags: ["terms", "omen"] }, { t: "since {p} snore{s}", v: 0, tier: 1, tags: ["habit"] }, { t: "or at least wave", v: 0, tier: 1, tags: ["terms"] },
        { t: "for {p} {is} legally your landlord", v: 0, tier: 2, tags: ["mystery"] }, { t: "for {p} {was} here before the river", v: 0, tier: 2, tags: ["mystery"] },
        { t: "for {p} will outlive your furniture", v: 0, tier: 2, tags: ["mystery"] },
        { t: "for {p} still owe{s} the river money", v: -1, tier: 2, tags: ["debt"] },
      ] },
    ],
    grow: [],
  },
};

// Saying forms. The headline is the bare saying; beats add its reason, who said it, the sampler
// it was stitched on, or the cookie it came in.
const SAY_FORMS = {
  saying: {
    name: "The saying",
    stanzas: [
      { name: "The saying", slots: ["rule", "who"], paras: [] },
      { name: "With its reason", slots: ["rule", "who", "why"], paras: [["reason"]] },
      { name: "With a moral", slots: ["rule", "who", "why"], paras: [["reason", "moral"]] },
    ],
    beats: {
      reason: { name: "the reason", lines: [
        B(0, "{Why}."),
        B(0, "{Why}. Everyone knows that."),
        B(0, "{Why}. That's all."),
        B(1, "{Why}. This is not a metaphor."),
        B(1, "{Why}. The fishermen know."),
        B(2, "{Why}. The old people say this and then look at the river for a long time."),
        B(2, "{Why}. Ask anyone who was at the potluck."),
      ] },
      moral: { name: "the moral", byMood: true, lines: {
        "-1": [
          B(0, "Words to live by."),
          B(1, "This has been true since before the bridge."),
          B(1, "It's carved over the door of a bait shop in Maine."),
          B(2, "The fishermen have a longer version, but it's mostly swearing."),
        ],
        "1": [
          B(0, "Words to live by."),
          B(1, "It's on a tea towel at your aunt's house, slightly misspelled."),
          B(1, "The church bulletin ran it twice by accident."),
          B(2, "It rhymes in the original, which was a song sung by geese."),
        ],
        "0": [
          B(0, "Think about it."),
          B(1, "Nobody knows who said it first. Several people claim to."),
          B(1, "It loses something in translation, mostly the goat."),
          B(2, "It was the only thing written in the margin of a very old cookbook."),
        ],
      } },
    },
  },

  grandmother: {
    name: "As grandmother said",
    stanzas: [
      { name: "The saying", slots: ["rule", "who"], paras: [] },
      { name: "She said it", slots: ["rule", "who"], paras: [["said"], ["proof"]] },
      { name: "And she'd add", slots: ["rule", "who", "why"], paras: [["said", "add"], ["proof"]] },
      { name: "The whole story", slots: ["rule", "who", "why"], paras: [["said", "add"], ["proof"], ["since"]] },
    ],
    beats: {
      said: { name: "when she said it", byMood: true, lines: {
        "-1": [
          B(0, "As my grandmother used to say, usually to the mailman."),
          B(0, "My grandmother said that the day Uncle Ray bought the boat."),
          B(1, "My grandmother said that at my christening. I was four days old."),
          B(1, "My grandmother said that, then looked at the window for a long time."),
          B(2, "My grandmother said that in her sleep, in perfect French."),
        ],
        "1": [
          B(0, "As my grandmother used to say, every time someone left the house."),
          B(0, "My grandmother said that while handing out butterscotch."),
          B(1, "My grandmother said that at every wedding, louder each time."),
          B(1, "My grandmother would say that and press a five-dollar bill into your hand."),
          B(2, "My grandmother said that to the moon once, and the moon seemed to agree."),
        ],
        "0": [
          B(0, "As my grandmother used to say, usually during Jeopardy."),
          B(0, "My grandmother said that the way other people say “bless you.”"),
          B(1, "My grandmother never explained it. She'd just say it and peel another potato."),
          B(1, "My grandmother said that, then said “anyway,” and changed the subject."),
          B(2, "My grandmother said that to a census taker, who wrote it down."),
        ],
      } },
      add: { name: "what she'd add", lines: [
        B(0, "“{Why},” she'd add."),
        B(0, "“{Why},” she'd say, and that was that."),
        B(1, "“{Why},” she'd add, to nobody."),
        B(1, "“{Why},” she'd add, pointing with a wooden spoon."),
        B(2, "“{Why},” she'd add, and the kettle would agree."),
      ] },
      proof: { name: "was she right", lines: [
        B(0, "I didn't listen. I should have listened."),
        B(0, "She was right. She was usually right."),
        B(0, "Grandma was right, as always."),
        B(1, "I learned the hard way, at a wedding in Delaware."),
        B(1, "I thought she was being dramatic. Then I met {who}."),
        B(2, "She'd know. She was {who}, briefly, in the seventies."),
      ] },
      since: { name: "since then", lines: [
        B(0, "I say it to my kids now. They roll their eyes. They'll see."),
        B(0, "She's ninety-six now, and still says it."),
        B(1, "We had it carved on her headstone, spelling mistake and all."),
        B(1, "She's ninety-six now. She has outlived {who}."),
        B(2, "She's ninety-six now, and she is suing {who}."),
      ] },
    },
  },

  sampler: {
    name: "Pillow sampler",
    lines: true,
    stanzas: [
      { name: "The saying", slots: ["rule", "who"], paras: [] },
      { name: "Stitched", slots: ["rule", "who"], paras: [["border"], ["stitched"]] },
      { name: "With a verse", slots: ["rule", "who"], paras: [["border"], ["verse"], ["stitched"]] },
      { name: "The heirloom", slots: ["rule", "who", "why"], paras: [["border"], ["verse", "small"], ["stitched"]] },
    ],
    beats: {
      border: { name: "the border", lines: [
        B(0, "✿ ~ ✿ ~ ✿ ~ ✿ ~ ✿"),
        B(0, "❦  ❦  ❦  ❦  ❦"),
        B(0, "· · · · · · · · · · ·"),
        B(1, "(a crooked cottage, and beside it, {who})"),
        B(1, "(two hearts, one of them unfinished)"),
        B(2, "(a border of tiny stitched teeth)"),
        B(2, "(a cottage, a tree, and, for reasons, a lobster)"),
      ] },
      verse: { name: "the verse", byMood: true, lines: {
        "-1": [
          B(0, "Lock the door at night"),
          B(1, "Bless this home, and bolt it"),
          B(1, "Keep the good spoons upstairs"),
          B(2, "Home is where {who} isn't"),
        ],
        "1": [
          B(0, "Bless this home"),
          B(1, "Live, laugh, and set a place for {who}"),
          B(1, "There's always room for one more chair"),
          B(2, "Home is wherever {who} is"),
        ],
        "0": [
          B(0, "There's no place like home"),
          B(1, "Wipe your feet and your expectations"),
          B(1, "What's done is done, and also in the freezer"),
          B(2, "This house runs on soup and spite"),
        ],
      } },
      small: { name: "the small print", lines: [
        B(0, "({why})"),
        B(1, "(in smaller letters: {why})"),
        B(2, "(on the back, in pencil: {why})"),
      ] },
      stitched: { name: "the stitching", lines: [
        B(0, "Stitched by Agnes, age 11, 1891"),
        B(0, "M. H. 1974"),
        B(0, "Stitched by Dorothy, winter of '58"),
        B(1, "Stitched by Dorothy, who was not asked to"),
        B(1, "Stitched by Aunt Pat, in apology"),
        B(1, "Stitched during a very long winter by an unknown hand"),
        B(2, "Stitched by the ghost in the guest room"),
        B(2, "Stitched by {who}"),
      ] },
    },
  },

  fortune: {
    name: "Fortune cookie",
    lines: true,
    stanzas: [
      { name: "The fortune", slots: ["rule", "who"], paras: [] },
      { name: "Lucky numbers", slots: ["rule", "who"], paras: [["lucky"]] },
      { name: "The back of the slip", slots: ["rule", "who"], paras: [["extra"], ["lucky"]] },
      { name: "Two slips", slots: ["rule", "who", "why"], paras: [["extra"], ["second"], ["lucky"]] },
    ],
    beats: {
      extra: { name: "the extra line", lines: [
        B(0, "You will soon go on a journey."),
        B(0, "Good news is on its way."),
        B(0, "A small kindness will return to you."),
        B(1, "This fortune is not valid in Ohio."),
        B(1, "Help, I am being held in a fortune cookie factory."),
        B(1, "Your next fortune is in another cookie."),
        B(2, "You will soon receive a second, smaller cookie."),
        B(2, "{Who} has read this fortune too."),
      ] },
      second: { name: "the second slip", lines: [
        B(0, "There was a second slip: “{why}.”"),
        B(1, "A second slip, stuck to the first: “{why}.”"),
        B(2, "A second slip, handwritten: “{why}. Sorry.”"),
      ] },
      lucky: { name: "the lucky numbers", lines: [
        B(0, "Lucky numbers: 7, 12, 19, 23, 31, 44"),
        B(0, "Lucky numbers: 4, 8, 15, 22, 36, 41"),
        B(0, "Lucky digits: 2, 9, 11, 30, 33, 47"),
        B(1, "Lucky numbers: 3, 3, 3, 3, 3, 3"),
        B(1, "Lucky numbers: 6, 11, and the one after 11"),
        B(1, "Lucky numbers: 5, 14, 27, and your landlord's birthday"),
        B(2, "Lucky numbers: none this week"),
        B(2, "Lucky numbers: 9, 14, and whatever {who} says"),
      ] },
    },
  },
};

const SAY_GRAMMAR = {
  id: "sayings",
  name: "Sayings",
  description: "Folk wisdom: advice, who it's about, and why. The dial lets the subject wander out of the proverb and the reason undo the warning. Comes as a saying, as grandmother said it, on a pillow, or in a cookie.",
  maxDepth: 1,
  cards: [
    { key: "rule", label: "Advice", hint: "the advice" },
    { key: "who", label: "Who", hint: "who it's about" },
    { key: "why", label: "Why", hint: "the reason" },
  ],
  headline: "The saying",
  pronouns: "who",
  moodCard: "rule",
  line: "{rule} {who}.",
  keep: { card: "who", name: "The usual suspects", verb: "Keep this suspect", note: "The herons, landlords and soups you've been warned about. Tell another to hear what else people say about them." },
  schemas: SAY_SCHEMAS,
  forms: SAY_FORMS,
  rules: {
    landing: false,
    dialName: "Wisdom",
    dialLabels: ["Sound", "Dubious", "Unhinged"],
    dialNotes: [
      "Everything agrees. Your grandmother could have said it.",
      "The advice and who it's about come from different worlds.",
      "Nothing agrees: odd company, and a reason that undoes the advice.",
    ],
    pairs: [
      { a: "who", b: "rule", on: "register", label: "advice ↔ subject" },
      { a: "why", b: "rule", on: "mood", label: "advice ↔ reason" },
      { a: "why", b: "who", on: "register", label: "subject ↔ reason" },
    ],
    grounded: "rule",
  },
};
GRAMMARS[SAY_GRAMMAR.id] = SAY_GRAMMAR;

// ---------- Just-so stories ----------
// Origin myths: why a creature does what it does. The old world, the thing it did, and how it
// has been ever since. The deed and the "ever since" carry moods, so the dial can turn a
// punishment into a reward. Every telling lands on "and that is why…".
const JUST_SCHEMAS = {
  who: {
    noun: true,
    parts: [
      { k: "q", name: "quality", opt: true, odds: 0.3, frame: "the ___ heron", hint: "Describes the creature. An adjective.", pool: [
        { t: "long-legged", tier: 0, tags: ["looks"] }, { t: "spotted", tier: 0, tags: ["looks"] }, { t: "old", tier: 0, tags: ["rank"] }, { t: "patient", tier: 0, tags: ["temper"] }, { t: "gray", tier: 0, tags: ["looks"] },
        { t: "common", tier: 0, tags: ["rank"] }, { t: "humble", tier: 0, tags: ["temper"] }, { t: "little", tier: 0, tags: ["looks"] }, { t: "shy", tier: 0, tags: ["temper"] },
        { t: "melancholy", tier: 1, tags: ["temper"] }, { t: "self-employed", tier: 1, tags: ["career"] }, { t: "overdressed", tier: 1, tags: ["looks"] }, { t: "lesser", tier: 1, tags: ["rank"] }, { t: "smug", tier: 1, tags: ["temper"] },
        { t: "tax-exempt", tier: 2, tags: ["career"] }, { t: "unpublished", tier: 2, tags: ["career"] }, { t: "twice-divorced", tier: 2, tags: ["career"] }, { t: "sleepy", tier: 0, tags: ["temper"] },
        { t: "freelance", tier: 1, tags: ["career"] }, { t: "slightly bald", tier: 1, tags: ["looks"] }, { t: "minor", tier: 1, tags: ["rank"] },
      ] },
      { k: "n", name: "creature", pronouns: true, det: ["the", "your", "a"], frame: "{det} ___", hint: "Who the myth explains, with pronouns (the heron is “it”, the geese are “they”).", pool: [
        { det: "the", t: "heron", ...IT, tier: 0, tags: ["birds", "water"] }, { det: "the", t: "cat", ...IT, tier: 0, tags: ["beasts"] }, { det: "the", t: "goose", ...IT, tier: 0, tags: ["birds"] },
        { det: "the", t: "crow", ...IT, tier: 0, tags: ["birds"] }, { det: "the", t: "owl", ...IT, tier: 0, tags: ["birds"] }, { det: "the", t: "tortoise", ...IT, tier: 0, tags: ["critters"] },
        { det: "the", t: "frog", ...IT, tier: 0, tags: ["critters", "water"] }, { det: "the", t: "dog", ...IT, tier: 0, tags: ["beasts"] }, { det: "the", t: "snail", ...IT, tier: 0, tags: ["critters"] },
        { det: "the", t: "giraffe", ...IT, tier: 0, tags: ["beasts"] }, { det: "the", t: "beaver", ...IT, tier: 0, tags: ["beasts", "water"] }, { det: "the", t: "mosquito", ...IT, tier: 0, tags: ["critters"] },
        { det: "the", t: "porcupine", ...IT, tier: 0, tags: ["beasts"] }, { det: "the", t: "octopus", ...IT, tier: 0, tags: ["water"] }, { det: "the", t: "swan", ...IT, tier: 0, tags: ["birds", "water"] },
        { det: "the", t: "pigeon", ...IT, tier: 0, tags: ["birds"] }, { det: "the", t: "squirrel", ...IT, tier: 0, tags: ["beasts"] }, { det: "the", t: "sloth", ...IT, tier: 0, tags: ["beasts"] },
        { det: "the", t: "cow", ...IT, tier: 0, tags: ["beasts"] }, { det: "the", t: "geese", ...THEY, tier: 0, tags: ["birds"] }, { det: "the", t: "moth", ...IT, tier: 0, tags: ["critters"] },
        { det: "the", t: "seal", ...IT, tier: 0, tags: ["water"] }, { det: "the", t: "skunk", ...IT, tier: 0, tags: ["beasts"] },
        { det: "a", t: "frog", ...IT, tier: 0, tags: ["critters", "water"] }, { det: "a", t: "cat", ...IT, tier: 0, tags: ["beasts"] }, { det: "a", t: "crow", ...IT, tier: 0, tags: ["birds"] }, { det: "your", t: "dog", ...IT, tier: 0, tags: ["beasts"] },
        { det: "the", t: "mailman", ...HE, tier: 1, tags: ["people"] }, { det: "your", t: "uncle", ...HE, tier: 1, tags: ["people"] }, { det: "the", t: "toaster", ...IT, tier: 1, tags: ["things"] },
        { det: "the", t: "dentist", ...SHE, tier: 1, tags: ["people"] }, { det: "the", t: "radiator", ...IT, tier: 1, tags: ["things"] }, { det: "the", t: "weatherman", ...HE, tier: 1, tags: ["people"] },
        { det: "your", t: "landlord", ...HE, tier: 1, tags: ["people"] }, { det: "the", t: "lighthouse", ...IT, tier: 1, tags: ["things"] }, { det: "the", t: "bagpipe", ...IT, tier: 1, tags: ["things"] },
        { det: "the", t: "left sock", ...IT, tier: 2, tags: ["things"] }, { det: "the", t: "DMV", ...IT, tier: 2, tags: ["office"] }, { det: "the", t: "smoke detector", ...IT, tier: 2, tags: ["things"] },
        { det: "the", t: "moon's ex-husband", ...HE, tier: 2, tags: ["people"] }, { det: "the", t: "concept of brunch", ...IT, tier: 2, tags: ["abstract"] }, { det: "the", t: "fax machine", ...IT, tier: 2, tags: ["office", "things"] },
        { det: "the", t: "concept of small talk", ...IT, tier: 2, tags: ["abstract"] }, { det: "the", t: "sun's landlord", ...HE, tier: 2, tags: ["people"] },
      ] },
    ],
    grow: ["q"],
  },
  quirk: {
    parts: [
      { k: "n", name: "quirk", frame: "why the heron ___", hint: "What it does now, in the present tense, with {s} on the verb: “stand{s} on one leg”.", pool: [
        { t: "stand{s} on one leg", tier: 0, tags: ["rest", "gait"] }, { t: "sleep{s} all day", tier: 0, tags: ["rest"] }, { t: "never blink{s}", tier: 0, tags: ["eyes"] }, { t: "eat{s} alone", tier: 0, tags: ["shy"] },
        { t: "look{s} both ways", tier: 0, tags: ["eyes", "nerves"] }, { t: "won't make eye contact", tier: 0, tags: ["shy", "eyes"] }, { t: "sing{s} at dawn", tier: 0, tags: ["sound"] }, { t: "walk{s} sideways", tier: 0, tags: ["gait"] },
        { t: "hide{s} {pos} face", tier: 0, tags: ["shy"] }, { t: "come{s} out at night", tier: 0, tags: ["shy"] }, { t: "shed{s} in March", tier: 0, tags: ["weather"] }, { t: "can't swim", tier: 0, tags: ["gait"] },
        { t: "avoid{s} the river", tier: 0, tags: ["nerves"] }, { t: "always know{s} when it's going to rain", tier: 0, tags: ["weather"] }, { t: "sulk{s}", tier: 0, tags: ["shy"] }, { t: "snore{s}", tier: 0, tags: ["sound", "rest"] }, { t: "sit{s} still", tier: 0, tags: ["rest"] }, { t: "sleep{s} sideways", tier: 1, tags: ["rest"] }, { t: "sniff{s} socks", tier: 1, tags: ["habit"] },
        { t: "stare{s} at walls", tier: 1, tags: ["eyes", "habit"] }, { t: "hum{s} when nervous", tier: 1, tags: ["sound", "nerves"] }, { t: "follow{s} you home", tier: 1, tags: ["social"] }, { t: "show{s} up uninvited", tier: 1, tags: ["social"] },
        { t: "refuse{s} to use stairs", tier: 1, tags: ["gait", "nerves"] }, { t: "sit{s} in the back at weddings", tier: 1, tags: ["social", "shy"] }, { t: "count{s} things under {pos} breath", tier: 1, tags: ["habit"] },
        { t: "{has} to be home by nine", tier: 1, tags: ["social"] }, { t: "{is} afraid of buttons", tier: 1, tags: ["nerves"] }, { t: "{is} always slightly damp", tier: 1, tags: ["weather"] }, { t: "sigh{s} at boats", tier: 1, tags: ["sound"] },
        { t: "blink{s} in Morse code", tier: 2, tags: ["eyes"] }, { t: "file{s} {pos} taxes early", tier: 2, tags: ["business"] }, { t: "owe{s} the moon money", tier: 2, tags: ["business"] },
        { t: "attend{s} every funeral in the county", tier: 2, tags: ["social"] }, { t: "{has} no word for Tuesday", tier: 2, tags: ["habit"] }, { t: "speak{s} only in the third person on Thursdays", tier: 2, tags: ["social", "habit"] },
        { t: "{is} legally a lighthouse", tier: 2, tags: ["business"] }, { t: "sell{s} insurance to frogs", tier: 2, tags: ["business"] },
        { t: "nap{s} standing up", tier: 1, tags: ["rest"] }, { t: "walk{s} backwards into rooms", tier: 1, tags: ["gait"] },
        { t: "sneeze{s} before it snows", tier: 1, tags: ["weather"] }, { t: "wink{s} at the sun", tier: 2, tags: ["eyes"] },
      ] },
    ],
    grow: [],
  },
  deed: {
    parts: [
      { k: "a", name: "manner", opt: true, odds: 0.35, frame: "one day it ___ lied to the river", hint: "How it did it. An adverb.", pool: [
        { t: "foolishly", tier: 0, tags: ["careless"] }, { t: "bravely", tier: 0, tags: ["bold"] }, { t: "accidentally", tier: 0, tags: ["careless"] }, { t: "quietly", tier: 0, tags: ["sly"] }, { t: "proudly", tier: 0, tags: ["bold"] },
        { t: "secretly", tier: 1, tags: ["sly"] }, { t: "very loudly", tier: 1, tags: ["bold"] }, { t: "politely", tier: 1, tags: ["proper"] }, { t: "sort of", tier: 1, tags: ["careless"] },
        { t: "ceremonially", tier: 2, tags: ["proper"] }, { t: "on a technicality", tier: 2, tags: ["proper"] }, { t: "slyly", tier: 1, tags: ["sly"] },
        { t: "sneakily", tier: 0, tags: ["sly"] }, { t: "half-heartedly", tier: 1, tags: ["careless"] },
        { t: "grandly", tier: 1, tags: ["bold"] }, { t: "formally", tier: 1, tags: ["proper"] },
      ] },
      { k: "n", name: "deed", mood: true, frame: "one day it ___", hint: "What it did, in the past tense. Its mood: a good deed, a bad one, or neither.", pool: [
        { t: "lied to the river", v: -1, tier: 0, tags: ["lies"] }, { t: "stole a fish from the king", v: -1, tier: 0, tags: ["theft"] }, { t: "laughed at the moon", v: -1, tier: 0, tags: ["rudeness", "sky"] },
        { t: "broke a promise", v: -1, tier: 0, tags: ["lies"] }, { t: "ate the last plum", v: -1, tier: 0, tags: ["theft"] }, { t: "cheated at cards", v: -1, tier: 0, tags: ["lies"] },
        { t: "skipped the harvest", v: -1, tier: 0, tags: ["sloth"] }, { t: "ran from a fight", v: -1, tier: 0, tags: ["rudeness"] }, { t: "said a bad word", v: -1, tier: 0, tags: ["rudeness"] }, { t: "bit a king", v: -1, tier: 1, tags: ["rudeness"] }, { t: "stole six sardines", v: -1, tier: 1, tags: ["theft"] }, { t: "sold sunshine", v: -1, tier: 2, tags: ["theft", "sky"] }, { t: "spilt the sun", v: -1, tier: 1, tags: ["sky"] }, { t: "slept through {pos} own wedding", v: -1, tier: 1, tags: ["sloth"] },
        { t: "kept the moon waiting", v: -1, tier: 1, tags: ["rudeness", "sky"] }, { t: "lost the river in a bet", v: -1, tier: 1, tags: ["sky"] }, { t: "told the bees a secret", v: -1, tier: 1, tags: ["lies"] },
        { t: "sold the wind a used cart", v: -1, tier: 2, tags: ["theft", "lies"] }, { t: "borrowed the sun and returned it dented", v: -1, tier: 2, tags: ["theft", "sky"] }, { t: "replied-all to the whole forest", v: -1, tier: 2, tags: ["rudeness"] },
        { t: "shared {pos} supper with a stranger", v: 1, tier: 0, tags: ["kindness"] }, { t: "carried an old frog across the river", v: 1, tier: 0, tags: ["kindness"] }, { t: "kept the fire going all winter", v: 1, tier: 0, tags: ["kindness"] },
        { t: "saved the last seed", v: 1, tier: 0, tags: ["kindness"] }, { t: "gave away {pos} only coat", v: 1, tier: 0, tags: ["kindness"] }, { t: "found the lost lamb", v: 1, tier: 0, tags: ["kindness"] }, { t: "built a dam for a friend", v: 1, tier: 0, tags: ["kindness"] }, { t: "sang sweetly", v: 1, tier: 0, tags: ["song"] }, { t: "sang to a sad frog", v: 1, tier: 1, tags: ["song", "kindness"] }, { t: "saved six swans", v: 1, tier: 1, tags: ["kindness"] },
        { t: "sang the sun up", v: 1, tier: 1, tags: ["song", "sky"] }, { t: "taught the wind to whistle", v: 1, tier: 1, tags: ["song", "sky"] }, { t: "learned every name in the forest", v: 1, tier: 1, tags: ["curious"] },
        { t: "saved a swan", v: 1, tier: 1, tags: ["kindness"] }, { t: "won a staring contest with the sky", v: 1, tier: 2, tags: ["sky"] }, { t: "returned the moon's wallet", v: 1, tier: 2, tags: ["sky", "kindness"] },
        { t: "asked one question too many", v: 0, tier: 0, tags: ["curious"] }, { t: "agreed to something without reading it", v: 0, tier: 0, tags: ["curious"] }, { t: "looked back", v: 0, tier: 0, tags: ["curious"] },
        { t: "said yes to the wrong question", v: 0, tier: 0, tags: ["curious"] }, { t: "slept in", v: 0, tier: 0, tags: ["sloth"] }, { t: "took a long nap", v: 0, tier: 0, tags: ["sloth"] }, { t: "sat still", v: 0, tier: 0, tags: ["sloth"] }, { t: "slept soundly", v: 0, tier: 0, tags: ["sloth"] }, { t: "skipped Sunday", v: 0, tier: 1, tags: ["sloth"] }, { t: "said this was a fair trick", v: 0, tier: 1, tags: ["lies"] },
        { t: "counted the stars and got a different number", v: 0, tier: 1, tags: ["curious", "sky"] }, { t: "fell asleep at the edge of the world", v: 0, tier: 1, tags: ["sloth"] },
        { t: "tried to be in two places at once", v: 0, tier: 1, tags: ["curious"] }, { t: "sat on a stump for a year", v: 0, tier: 1, tags: ["sloth"] },
        { t: "married the wind", v: 0, tier: 2, tags: ["sky"] }, { t: "invented Wednesday", v: 0, tier: 2, tags: ["curious"] }, { t: "swallowed a small storm", v: 0, tier: 2, tags: ["sky"] },
        { t: "sang the chicks to sleep", v: 1, tier: 0, tags: ["song", "kindness"] }, { t: "pinched the king's spoon", v: -1, tier: 1, tags: ["theft"] },
        { t: "insulted the mountain's mother", v: -1, tier: 2, tags: ["rudeness"] }, { t: "asked the sea what it was for", v: 0, tier: 2, tags: ["curious"] },
      ] },
      { k: "t", name: "detail", opt: true, odds: 0.35, trailing: true, frame: "one day it lied to the river ___", hint: "When or how it happened: “on the first day of winter”.", pool: [
        { t: "on the first day of winter", tier: 0, tags: ["time"] }, { t: "in front of everyone", tier: 0, tags: ["place"] }, { t: "at the edge of the pond", tier: 0, tags: ["place"] },
        { t: "for a dare", tier: 1, tags: ["manner"] }, { t: "while the moon wasn't looking", tier: 1, tags: ["time"] }, { t: "with help from {rival}", tier: 1, tags: ["manner"] }, { t: "at a wedding", tier: 1, tags: ["place"] },
        { t: "using only {pos} left foot", tier: 2, tags: ["manner"] }, { t: "in a borrowed hat", tier: 2, tags: ["manner"] }, { t: "on a Tuesday that was later cancelled", tier: 2, tags: ["time"] },
        { t: "at sunrise", tier: 0, tags: ["time"] }, { t: "during the great flood", tier: 1, tags: ["time"] }, { t: "at the king's feast", tier: 1, tags: ["place"] },
        { t: "in the year before years", tier: 2, tags: ["time"] },
      ] },
    ],
    grow: ["a", "t"],
  },
  since: {
    parts: [
      { k: "n", name: "ever since", mood: true, frame: "and that is why the heron stands on one leg, ___", hint: "How it carries on: “out of shame”, “as a reward”, “smugly”. Its mood: a punishment is bad, a reward good.", pool: [
        { t: "out of shame", v: -1, tier: 0, tags: ["shame"] }, { t: "as a punishment", v: -1, tier: 0, tags: ["punish"] }, { t: "in sorrow", v: -1, tier: 0, tags: ["sorrow"] }, { t: "as payback", v: -1, tier: 0, tags: ["punish"] },
        { t: "to say sorry", v: -1, tier: 0, tags: ["shame"] }, { t: "sadly", v: -1, tier: 0, tags: ["sorrow"] }, { t: "as penance", v: -1, tier: 1, tags: ["shame", "punish"] }, { t: "sullenly", v: -1, tier: 1, tags: ["sorrow"] },
        { t: "sheepishly", v: -1, tier: 1, tags: ["shame"] }, { t: "under protest", v: -1, tier: 1, tags: ["punish"] }, { t: "as part of a long con", v: -1, tier: 2, tags: ["legal"] }, { t: "on the advice of {pos} lawyer", v: -1, tier: 2, tags: ["legal"] },
        { t: "as a reward", v: 1, tier: 0, tags: ["reward"] }, { t: "proudly", v: 1, tier: 0, tags: ["pride"] }, { t: "for good luck", v: 1, tier: 0, tags: ["reward"] }, { t: "as a gift", v: 1, tier: 0, tags: ["reward"] },
        { t: "sweetly", v: 1, tier: 0, tags: ["pride"] }, { t: "smugly", v: 1, tier: 1, tags: ["pride"] }, { t: "as a gift from the moon", v: 1, tier: 1, tags: ["reward"] }, { t: "with the river's blessing", v: 1, tier: 1, tags: ["reward"] },
        { t: "to show off", v: 1, tier: 1, tags: ["pride"] }, { t: "as a sort of victory lap", v: 1, tier: 2, tags: ["pride"] }, { t: "under a royal charter", v: 1, tier: 2, tags: ["legal", "reward"] },
        { t: "out of habit", v: 0, tier: 0, tags: ["habit"] }, { t: "just in case", v: 0, tier: 0, tags: ["habit"] }, { t: "out of pity", v: 0, tier: 0, tags: ["habit"] }, { t: "silently", v: 0, tier: 0, tags: ["habit"] },
        { t: "for reasons {p} won't discuss", v: 0, tier: 1, tags: ["habit"] }, { t: "solemnly", v: 0, tier: 1, tags: ["habit", "sorrow"] }, { t: "until someone apologizes", v: 0, tier: 1, tags: ["punish"] },
        { t: "by order of the frogs", v: 0, tier: 2, tags: ["legal"] }, { t: "on legal advice", v: 0, tier: 2, tags: ["legal"] }, { t: "as a sort of performance piece", v: 0, tier: 2, tags: ["pride"] },
      ] },
    ],
    grow: [],
  },
  rival: {
    noun: true,
    parts: [
      { k: "n", name: "rival", det: ["the", "a"], frame: "{det} ___", hint: "Who else is in the story: “the river”, “a clever crow”.", pool: [
        { det: "the", t: "river", tier: 0, tags: ["water"] }, { det: "the", t: "moon", tier: 0, tags: ["sky"] }, { det: "the", t: "wind", tier: 0, tags: ["sky"] }, { det: "a", t: "fox", tier: 0, tags: ["beasts"] },
        { det: "the", t: "sea", tier: 0, tags: ["water"] }, { det: "a", t: "old tortoise", tier: 0, tags: ["beasts"] }, { det: "the", t: "sun", tier: 0, tags: ["sky"] }, { det: "a", t: "clever crow", tier: 0, tags: ["beasts"] },
        { det: "the", t: "mountain", tier: 0, tags: ["land"] }, { det: "the", t: "snow", tier: 0, tags: ["sky"] }, { det: "a", t: "snake", tier: 0, tags: ["beasts"] }, { det: "the", t: "stars", tier: 0, tags: ["sky"] }, { det: "a", t: "wolf", tier: 0, tags: ["beasts"] }, { det: "a", t: "hawk", tier: 0, tags: ["beasts"] }, { det: "a", t: "snail", tier: 0, tags: ["beasts"] },
        { det: "the", t: "first winter", tier: 1, tags: ["sky"] }, { det: "the", t: "king of the frogs", tier: 1, tags: ["beasts"] }, { det: "a", t: "duck with a grudge", tier: 1, tags: ["beasts"] },
        { det: "a", t: "man selling umbrellas", tier: 1, tags: ["folk"] }, { det: "the", t: "last dinosaur", tier: 1, tags: ["beasts"] }, { det: "the", t: "village gossip", tier: 1, tags: ["folk"] },
        { det: "the", t: "Postmaster of the Forest", tier: 2, tags: ["office"] }, { det: "the", t: "night's accountant", tier: 2, tags: ["office"] }, { det: "the", t: "Department of Weather", tier: 2, tags: ["office", "sky"] },
        { det: "a", t: "very small god", tier: 2, tags: ["myth"] }, { det: "the", t: "concept of Thursday", tier: 2, tags: ["myth"] },
        { det: "the", t: "forest", tier: 0, tags: ["land"] }, { det: "the", t: "longest night", tier: 1, tags: ["sky"] },
      ] },
      { k: "c", name: "clause", opt: true, odds: 0.3, trailing: true, frame: "the river ___", hint: "Trails the rival: “who never forgets”.", pool: [
        { t: "who never forgets", tier: 0, tags: ["grudge"] }, { t: "who was in a mood", tier: 0, tags: ["grudge", "state"] }, { t: "who had been drinking", tier: 1, tags: ["state"] },
        { t: "who kept a list", tier: 1, tags: ["grudge"] }, { t: "with one eye open", tier: 1, tags: ["state"] }, { t: "who was secretly {who}", tier: 2, tags: ["guise"] }, { t: "in a little hat", tier: 2, tags: ["guise"] },
        { t: "who had just woken up", tier: 0, tags: ["state"] }, { t: "who was owed money", tier: 1, tags: ["grudge"] },
      ] },
    ],
    grow: ["c"],
  },
};

const JUST_FORMS = {
  tale: {
    name: "The tale",
    stanzas: [
      { name: "The title", slots: ["who", "quirk"], paras: [] },
      { name: "A short tale", slots: ["who", "quirk", "deed", "since"], paras: [["before", "deed"], ["landing"]] },
      { name: "With a rival", slots: ["who", "quirk", "deed", "since", "rival"], paras: [["before"], ["meet", "deed"], ["landing"]] },
      { name: "With a turn", slots: ["who", "quirk", "deed", "since", "rival"], paras: [["before"], ["meet", "deed", "dwell", "turn"], ["landing"]] },
      { name: "The full myth", slots: ["who", "quirk", "deed", "since", "rival"], paras: [["before", "old"], ["meet", "deed", "dwell", "turn"], ["landing", "tag"]] },
    ],
    beats: {
      before: { name: "the old world", lines: [
        B(0, "Long ago, {who} {was} just ordinary."),
        B(0, "In the beginning, {who} lived like everyone else, quietly, near the water."),
        B(0, "Once, before there were calendars, {who} had no particular habits."),
        B(1, "In the old days, when the hills were still soft, {who} {was} considered unremarkable."),
        B(1, "Long ago, back when the rivers ran uphill on weekends, nobody gave {who} a second look."),
        B(2, "Before the world was finished, while the paint on the sky was still wet, {who} {was} in charge of nothing at all."),
        B(2, "In the first week of the world, {who} {was} mostly a rumor."),
      ] },
      old: { name: "how things were", lines: [
        B(0, "Those were simpler times. Everyone ate the same berries."),
        B(0, "Back then, nobody had any particular habits."),
        B(1, "There was only one of everything then, including Thursdays."),
        B(1, "The mountains were still being argued about."),
        B(2, "The sea had not yet decided on a color and changed it hourly."),
      ] },
      meet: { name: "the rival arrives", lines: [
        B(0, "One morning, on the road, {p} met {rival}."),
        B(0, "Then {rival} came along."),
        B(0, "That was when {rival} got involved."),
        B(1, "That was the year {rival} moved in next door."),
        B(1, "{Rival} had been watching {o} for some time."),
        B(2, "{Rival} arrived, uninvited, with a clipboard."),
      ] },
      deed: { name: "what it did", lines: [
        B(0, "One day, {p} {deed}."),
        B(0, "And so, {p} {deed}."),
        B(0, "Then, one spring, {p} {deed}."),
        B(1, "And then, for reasons {p} {has} never explained, {p} {deed}."),
        B(1, "Nobody remembers the weather, only that {p} {deed}."),
        B(2, "Then, on a day that has since been removed from the calendar, {p} {deed}."),
      ] },
      dwell: { name: "how the world took it", byMood: true, lines: {
        "-1": [
          B(0, "Everyone saw. Nobody said anything, which was worse."),
          B(1, "The frogs held a meeting about it. The meeting went long."),
          B(2, "The sky wrote it down in a little book it keeps for that purpose."),
        ],
        "1": [
          B(0, "Everyone was grateful, and a little suspicious."),
          B(1, "The frogs held a small parade. It was mostly frogs."),
          B(2, "The sky was so moved it rained upward for a week."),
        ],
        "0": [
          B(0, "Nobody knew what to make of it."),
          B(1, "The owls argued about it until morning and reached no conclusion."),
          B(2, "The mountains were consulted. They said “hm.”"),
        ],
      } },
      turn: { name: "the turn", byClash: true, lines: [
        B(0, "For a while it looked like nobody would notice."),
        B(0, "{Rival} said nothing, and kept saying it."),
        B(1, "Then the wind told everyone, because the wind tells everyone."),
        B(1, "Then {rival} called a meeting."),
        B(2, "Then the moon got a lawyer."),
        B(2, "Then {rival} wrote a ballad about it, and the ballad caught on."),
      ] },
      landing: { name: "ever since", role: "landing", lines: [
        B(0, "And that is why {who} {quirk}, {since}."),
        B(0, "And ever since, {who} {quirk}, {since}."),
        B(0, "So that is why {who} {quirk}, {since}."),
        B(1, "So now {who} {quirk}, {since}, and nobody brings it up."),
        B(1, "From that day on, {who} {quirk}, {since}. Ask anyone."),
        B(2, "And that is why {who} {quirk}, {since}, and why the river still won't return {pos} calls."),
      ] },
      tag: { name: "the tag", lines: [
        B(0, "Go and look, if you don't believe me."),
        B(0, "Next time you see one, don't mention it."),
        B(1, "{P} would rather you didn't bring it up."),
        B(2, "{Rival} still sends a card every year. It is not a nice card."),
      ] },
    },
  },

  bedtime: {
    name: "At bedtime",
    stanzas: [
      { name: "The title", slots: ["who", "quirk"], paras: [] },
      { name: "A short one", slots: ["who", "quirk", "deed", "since"], paras: [["once", "what"], ["night"]] },
      { name: "With questions", slots: ["who", "quirk", "deed", "since"], paras: [["once", "kid"], ["what", "kid2"], ["night"]] },
      { name: "One more question", slots: ["who", "quirk", "deed", "since", "rival"], paras: [["once", "kid"], ["what", "kid2"], ["night", "last"]] },
    ],
    beats: {
      once: { name: "once upon a time", lines: [
        B(0, "Okay. A long time ago, {who} {was} just like you and me."),
        B(0, "Once upon a time, {who} {was} perfectly normal."),
        B(1, "Once upon a time, before your father was born, before even Grandpa, {who} {was} perfectly normal."),
        B(2, "Once upon a time, which is a real time, look it up, {who} {was} a respected member of the community."),
      ] },
      kid: { name: "the first question", lines: [
        B(0, "“Is this true?” Yes. Lie down."),
        B(0, "“Was it a long time ago?” Very long. Lie down."),
        B(1, "“Did you know {o}?” Not personally."),
        B(2, "“Was it you?” Go to sleep."),
      ] },
      what: { name: "what happened", lines: [
        B(0, "And one day, {p} {deed}. I know. I know."),
        B(0, "Then one day {p} {deed}."),
        B(1, "And then one day {p} {deed}, which, as we've discussed, we don't do."),
        B(2, "And then {p} {deed}. Like your cousin. Exactly like your cousin."),
      ] },
      kid2: { name: "the second question", byMood: true, lines: {
        "-1": [
          B(0, "“Was {p} sorry?” Very sorry."),
          B(1, "“Did {p} get in trouble?” What do you think."),
          B(2, "“Would you still love me if I did that?” Yes. Probably. Lie down."),
        ],
        "1": [
          B(0, "“Was that nice?” Very nice."),
          B(1, "“Did {p} get a prize?” Sort of. Keep listening."),
          B(2, "“Can I do that tomorrow?” Ask your mother."),
        ],
        "0": [
          B(0, "“Why?” Nobody knows why."),
          B(1, "“Was that good or bad?” Both. Like soup."),
          B(2, "“Is that allowed?” It is now."),
        ],
      } },
      night: { name: "the end", role: "landing", lines: [
        B(0, "And that is why {who} {quirk}, {since}. The end. Lights out."),
        B(0, "And that's why {who} {quirk}, {since}. Goodnight."),
        B(1, "And that's why {who} {quirk}, {since}. No, you can't have water. You had water."),
        B(2, "And that's why {who} {quirk}, {since}. Now close your eyes, or {rival} will hear about it."),
      ] },
      last: { name: "one last question", lines: [
        B(0, "“One more?” No."),
        B(1, "“Is {rival} real?” Go to sleep."),
        B(2, "“Is {rival} under the bed?” Not anymore."),
      ] },
    },
  },

  guide: {
    name: "Field guide",
    stanzas: [
      { name: "The title", slots: ["who", "quirk"], paras: [] },
      { name: "The entry", slots: ["who", "quirk", "deed", "since"], paras: [["seen"], ["folk"]] },
      { name: "With habitat", slots: ["who", "quirk", "deed", "since", "rival"], paras: [["seen", "habitat"], ["folk"]] },
      { name: "Annotated", slots: ["who", "quirk", "deed", "since", "rival"], paras: [["seen", "habitat"], ["folk", "note"]] },
    ],
    beats: {
      seen: { name: "observed", lines: [
        B(0, "Observed: {who} {quirk}. This is well documented."),
        B(0, "Field notes: {who} {quirk}."),
        B(1, "Observed: {who} {quirk}. Scientists have stopped asking why."),
        B(2, "Observed: {who} {quirk}. Our researcher has asked to be reassigned."),
      ] },
      habitat: { name: "habitat", lines: [
        B(0, "Often seen near {rival}, at a polite distance."),
        B(0, "Avoids {rival}."),
        B(1, "Avoids {rival}. Will not say why."),
        B(2, "Shares a post office box with {rival}."),
      ] },
      folk: { name: "folklore", role: "landing", lines: [
        B(0, "Folklore says {p} once {deed}, and that {p} {has} done it {since} ever since."),
        B(0, "Local legend says {p} {deed}, and {p} {quirk} {since}."),
        B(1, "The old people say {p} {deed}. The old people say a lot of things. Still, {p} {quirk}, {since}."),
        B(2, "Legend holds that {p} {deed}, and {p} {quirk} {since}. The legend is currently being sued by {rival}."),
      ] },
      note: { name: "the margin note", lines: [
        B(0, "(Do not approach.)"),
        B(1, "(Do not mention the river.)"),
        B(2, "(Pencilled in the margin: “it's true, I was there.”)"),
      ] },
    },
  },
};

const JUST_GRAMMAR = {
  id: "just-so",
  name: "Just-so stories",
  description: "Why the heron stands on one leg: origin myths for creatures and the things they do. The old world, what happened, and how it's been ever since. The dial turns punishments into rewards and herons into toasters; every telling ends on “and that is why”.",
  maxDepth: 1,
  cards: [
    { key: "who", label: "Creature", hint: "the creature" },
    { key: "quirk", label: "Quirk", hint: "what it does now" },
    { key: "deed", label: "What it did", hint: "the deed" },
    { key: "since", label: "Ever since", hint: "how it carries on" },
    { key: "rival", label: "Rival", hint: "who else was there" },
  ],
  headline: "The title",
  pronouns: "who",
  moodCard: "deed",
  line: "Why {who} {quirk}.",
  keep: { card: "who", name: "The menagerie", verb: "Keep this creature", note: "Creatures you've kept, and everything that is supposedly why. Tell another myth about one." },
  schemas: JUST_SCHEMAS,
  forms: JUST_FORMS,
  rules: {
    landing: true,
    dialName: "Myth",
    dialLabels: ["Folk tale", "Tall tale", "Fever dream"],
    dialNotes: [
      "Everything fits: a real creature, a habit it could have, a deed that earns it.",
      "The creature and its habit stop matching: the toaster files its taxes early.",
      "Nothing fits. The punishment is a reward and the rival is the Department of Weather. It still ends “and that is why.”",
    ],
    pairs: [
      { a: "quirk", b: "who", on: "register", label: "creature ↔ quirk" },
      { a: "since", b: "deed", on: "mood", label: "deed ↔ ever since" },
      { a: "deed", b: "who", on: "register", label: "creature ↔ deed" },
      { a: "rival", b: "deed", on: "register", label: "deed ↔ rival" },
    ],
    grounded: "who",
  },
};
GRAMMARS[JUST_GRAMMAR.id] = JUST_GRAMMAR;

// ---------- Hinge prompts ----------
// A dating-app prompt and the answer you give it. The prompt is a card: its words are prompt
// stems, each with a mood (a fear asks for something bad, the key to your heart for something
// good). The answer has a mood too, so the dial makes it argue with the prompt. Beat lines add
// more prompts, with your job and who you're looking for.
const HINGE_SCHEMAS = {
  prompt: {
    parts: [
      { k: "n", name: "prompt", mood: true, frame: "___ a heron that knows my name", hint: "A prompt stem, ending where the answer starts: “My most irrational fear:”, “The key to my heart is”. Its mood is what it asks for.", pool: [
        { t: "My most irrational fear:", v: -1, tier: 0, tags: ["fear"] }, { t: "My biggest date fail:", v: -1, tier: 0, tags: ["past"] }, { t: "Pet peeve:", v: -1, tier: 0, tags: ["flaws"] },
        { t: "The worst idea I've ever had:", v: -1, tier: 0, tags: ["past"] }, { t: "What keeps me up at night:", v: -1, tier: 0, tags: ["fear"] }, { t: "I'm still not over", v: -1, tier: 0, tags: ["past"] },
        { t: "Red flags:", v: -1, tier: 0, tags: ["flaws"] }, { t: "My worst habit:", v: -1, tier: 0, tags: ["flaws"] }, { t: "My biggest flaw:", v: -1, tier: 0, tags: ["flaws"] },
        { t: "Never again:", v: -1, tier: 1, tags: ["past"] }, { t: "My nemesis:", v: -1, tier: 1, tags: ["fear"] }, { t: "Recurring nightmare:", v: -1, tier: 1, tags: ["fear"] },
        { t: "My villain origin story:", v: -1, tier: 1, tags: ["past"] }, { t: "Sore subjects:", v: -1, tier: 1, tags: ["flaws"] }, { t: "Secret shames:", v: -1, tier: 1, tags: ["flaws"] }, { t: "Don't ask about", v: -1, tier: 1, tags: ["flaws"] },
        { t: "The judge said I can't go near", v: -1, tier: 2, tags: ["legal"] }, { t: "I'm legally required to tell you about", v: -1, tier: 2, tags: ["legal"] },
        { t: "The key to my heart is", v: 1, tier: 0, tags: ["love"] }, { t: "I go crazy for", v: 1, tier: 0, tags: ["love"] }, { t: "Green flags I look for:", v: 1, tier: 0, tags: ["love"] },
        { t: "My simple pleasures:", v: 1, tier: 0, tags: ["joys"] }, { t: "The way to win me over is", v: 1, tier: 0, tags: ["love"] }, { t: "My love language is", v: 1, tier: 0, tags: ["love"] },
        { t: "I'm weirdly attracted to", v: 1, tier: 0, tags: ["love"] }, { t: "Typical Sunday:", v: 1, tier: 0, tags: ["joys"] }, { t: "My happy place:", v: 1, tier: 0, tags: ["joys"] },
        { t: "My idea of a perfect date:", v: 1, tier: 0, tags: ["love"] },
        { t: "Things I'd save in a fire:", v: 1, tier: 1, tags: ["joys"] }, { t: "Sunday staples:", v: 1, tier: 1, tags: ["joys"] }, { t: "Sweet spots:", v: 1, tier: 1, tags: ["joys", "love"] }, { t: "Specialties:", v: 1, tier: 1, tags: ["joys", "talk"] },
        { t: "My emotional support animal is", v: 1, tier: 2, tags: ["joys"] }, { t: "In my will, I leave everything to", v: 1, tier: 2, tags: ["legal"] },
        { t: "Dating me is like", v: 0, tier: 0, tags: ["talk"] }, { t: "I won't shut up about", v: 0, tier: 0, tags: ["talk"] }, { t: "I geek out on", v: 0, tier: 0, tags: ["talk"] },
        { t: "Change my mind about", v: 0, tier: 0, tags: ["talk"] }, { t: "Ask me about", v: 0, tier: 0, tags: ["talk"] }, { t: "I'm overly competitive about", v: 0, tier: 0, tags: ["talk"] },
        { t: "The hill I will die on:", v: 0, tier: 0, tags: ["beliefs"] }, { t: "Fun fact:", v: 0, tier: 0, tags: ["talk"] }, { t: "A shower thought I recently had:", v: 0, tier: 0, tags: ["talk", "beliefs"] },
        { t: "My therapist says it's about", v: 0, tier: 1, tags: ["beliefs"] }, { t: "My last relationship was basically", v: 0, tier: 1, tags: ["past"] }, { t: "Superstitions:", v: 0, tier: 1, tags: ["beliefs"] },
        { t: "I'm convinced the government is hiding", v: 0, tier: 1, tags: ["beliefs"] },
        { t: "My emergency contact is", v: 0, tier: 2, tags: ["legal"] }, { t: "What I'd bring to a duel:", v: 0, tier: 2, tags: ["legal"] }, { t: "My rising sign is", v: 0, tier: 2, tags: ["beliefs"] },
        { t: "In heaven, I'd like to be greeted by", v: 1, tier: 2, tags: ["joys", "beliefs"] },
        { t: "I'd fall in love on the spot with", v: 1, tier: 1, tags: ["love"] },
      ] },
    ],
    grow: [],
  },
  answer: {
    noun: true,
    parts: [
      { k: "n", name: "answer", mood: true, frame: "my most irrational fear: ___", hint: "Your answer, as a thing (with its own “a” or “my” if it needs one): “geese”, “a damp sock”. Its mood: something bad, good, or neither.", pool: [
        { t: "geese", v: -1, tier: 0, tags: ["animals"] }, { t: "small talk", v: -1, tier: 0, tags: ["social"] }, { t: "people who clap when the plane lands", v: -1, tier: 0, tags: ["social"] },
        { t: "a damp sock", v: -1, tier: 0, tags: ["home"] }, { t: "voicemail", v: -1, tier: 0, tags: ["social"] }, { t: "mayonnaise", v: -1, tier: 0, tags: ["food"] }, { t: "group projects", v: -1, tier: 0, tags: ["social"] },
        { t: "the deep end", v: -1, tier: 0, tags: ["outdoors"] }, { t: "a tax audit", v: -1, tier: 0, tags: ["errands"] }, { t: "seagulls", v: -1, tier: 0, tags: ["animals"] }, { t: "spiders", v: -1, tier: 0, tags: ["animals"] },
        { t: "hold music", v: -1, tier: 0, tags: ["errands", "music"] }, { t: "my ex's band", v: -1, tier: 0, tags: ["people", "music"] }, { t: "a wet handshake", v: -1, tier: 0, tags: ["social"] },
        { t: "a heron", v: -1, tier: 1, tags: ["animals"] }, { t: "the ocean at night", v: -1, tier: 1, tags: ["outdoors"] }, { t: "a mime", v: -1, tier: 1, tags: ["people"] }, { t: "ventriloquist dummies", v: -1, tier: 1, tags: ["uncanny"] },
        { t: "reply-all", v: -1, tier: 1, tags: ["social"] }, { t: "my mother's new boyfriend, Gary", v: -1, tier: 1, tags: ["people"] }, { t: "a goose", v: -1, tier: 1, tags: ["animals"] },
        { t: "the moon", v: -1, tier: 2, tags: ["uncanny", "outdoors"] }, { t: "a sentient casserole", v: -1, tier: 2, tags: ["food", "uncanny"] }, { t: "a second, smaller me", v: -1, tier: 2, tags: ["uncanny"] }, { t: "the concept of Wednesday", v: -1, tier: 2, tags: ["uncanny"] },
        { t: "warm bread", v: 1, tier: 0, tags: ["food"] }, { t: "a good map", v: 1, tier: 0, tags: ["outdoors"] }, { t: "someone who texts back", v: 1, tier: 0, tags: ["social"] }, { t: "a long walk", v: 1, tier: 0, tags: ["outdoors"] },
        { t: "dogs", v: 1, tier: 0, tags: ["animals"] }, { t: "a clean kitchen", v: 1, tier: 0, tags: ["home"] }, { t: "breakfast for dinner", v: 1, tier: 0, tags: ["food"] }, { t: "people who return the cart", v: 1, tier: 0, tags: ["social", "errands"] },
        { t: "a fresh notebook", v: 1, tier: 0, tags: ["home"] }, { t: "snacks", v: 1, tier: 0, tags: ["food"] }, { t: "sunsets", v: 1, tier: 0, tags: ["outdoors"] }, { t: "a nap", v: 1, tier: 0, tags: ["home"] }, { t: "soft pretzels", v: 1, tier: 0, tags: ["food"] },
        { t: "a well-organized spice rack", v: 1, tier: 1, tags: ["home"] }, { t: "a man who owns a canoe", v: 1, tier: 1, tags: ["people", "outdoors"] }, { t: "a perfectly ripe pear", v: 1, tier: 1, tags: ["food"] },
        { t: "an accordion", v: 1, tier: 1, tags: ["music"] }, { t: "the smell of a hardware store", v: 1, tier: 1, tags: ["errands"] }, { t: "a library card", v: 1, tier: 1, tags: ["errands"] }, { t: "someone who knows a guy", v: 1, tier: 1, tags: ["people"] },
        { t: "a small, polite frog", v: 1, tier: 2, tags: ["animals"] }, { t: "a goose who believes in me", v: 1, tier: 2, tags: ["animals"] }, { t: "the ghost in my apartment", v: 1, tier: 2, tags: ["uncanny", "home"] },
        { t: "a wizard with a pension", v: 1, tier: 2, tags: ["uncanny", "people"] }, { t: "an apology from the moon", v: 1, tier: 2, tags: ["uncanny"] },
        { t: "soup", v: 0, tier: 0, tags: ["food"] }, { t: "my cousin Dale", v: 0, tier: 0, tags: ["people"] }, { t: "the DMV", v: 0, tier: 0, tags: ["errands"] }, { t: "jury duty", v: 0, tier: 0, tags: ["errands"] },
        { t: "my landlord", v: 0, tier: 0, tags: ["people", "home"] }, { t: "the weather", v: 0, tier: 0, tags: ["outdoors"] }, { t: "sardines", v: 0, tier: 0, tags: ["food"] }, { t: "the group chat", v: 0, tier: 0, tags: ["social"] }, { t: "Costco", v: 0, tier: 0, tags: ["errands", "food"] },
        { t: "a strong opinion about fonts", v: 0, tier: 1, tags: ["social"] }, { t: "a lighthouse keeper", v: 0, tier: 1, tags: ["people", "outdoors"] }, { t: "soup, but cold", v: 0, tier: 1, tags: ["food"] },
        { t: "a canoe", v: 0, tier: 1, tags: ["outdoors"] }, { t: "the bagpipes", v: 0, tier: 1, tags: ["music"] }, { t: "my ex's mom", v: 0, tier: 1, tags: ["people"] }, { t: "a timeshare", v: 0, tier: 1, tags: ["errands"] },
        { t: "a single, very old goose", v: 0, tier: 2, tags: ["animals"] }, { t: "the concept of Tuesday", v: 0, tier: 2, tags: ["uncanny"] }, { t: "my second family", v: 0, tier: 2, tags: ["people", "uncanny"] }, { t: "a ghost", v: 0, tier: 2, tags: ["uncanny"] },
        { t: "a Ouija board", v: -1, tier: 1, tags: ["uncanny", "home"] }, { t: "a sandwich that knows too much", v: -1, tier: 2, tags: ["food", "uncanny"] },
        { t: "a lake with a grudge", v: -1, tier: 2, tags: ["outdoors", "uncanny"] }, { t: "a haunted ottoman", v: 0, tier: 2, tags: ["home", "uncanny"] },
      ] },
      { k: "c", name: "clause", opt: true, odds: 0.4, trailing: true, frame: "geese ___", hint: "Trails the answer: “that knows my name”, “on a first date”.", pool: [
        { t: "on a Tuesday", tier: 0, tags: ["when"] }, { t: "at a wedding", tier: 0, tags: ["where"] }, { t: "in the rain", tier: 0, tags: ["where"] }, { t: "from the nineties", tier: 0, tags: ["when"] },
        { t: "after midnight", tier: 0, tags: ["when"] }, { t: "on a first date", tier: 0, tags: ["where"] }, { t: "at the airport", tier: 0, tags: ["where"] },
        { t: "that learned my name", tier: 1, tags: ["knows"] }, { t: "with a plan", tier: 1, tags: ["scheme"] }, { t: "that won't stop looking at me", tier: 1, tags: ["knows"] }, { t: "named Gerald", tier: 1, tags: ["guise"] },
        { t: "in a little hat", tier: 1, tags: ["guise"] }, { t: "at my funeral", tier: 1, tags: ["where"] }, { t: "that called me “champ”", tier: 1, tags: ["knows"] },
        { t: "with a law degree", tier: 2, tags: ["scheme"] }, { t: "with my mother's number", tier: 2, tags: ["knows"] }, { t: "with a memory like a ledger", tier: 2, tags: ["knows"] }, { t: "in a trench coat, stacked", tier: 2, tags: ["guise"] },
        { t: "with a business proposal", tier: 1, tags: ["scheme"] }, { t: "at a baby shower", tier: 1, tags: ["where"] },
        { t: "with a hostile takeover in mind", tier: 2, tags: ["scheme"] }, { t: "wearing my clothes", tier: 2, tags: ["guise", "knows"] },
      ] },
    ],
    grow: ["c"],
  },
  me: {
    noun: true, article: true,
    parts: [
      { k: "q", name: "quality", opt: true, odds: 0.5, frame: "a ___ lighthouse keeper", hint: "Describes you. An adjective.", pool: [
        { t: "retired", tier: 0, tags: ["work"] }, { t: "recently divorced", tier: 0, tags: ["love"] }, { t: "semi-retired", tier: 0, tags: ["work"] }, { t: "tall", tier: 0, tags: ["self"] }, { t: "part-time", tier: 0, tags: ["work"] },
        { t: "newly single", tier: 0, tags: ["love"] }, { t: "single", tier: 0, tags: ["love"] }, { t: "sober", tier: 0, tags: ["self"] }, { t: "sincere", tier: 0, tags: ["self"] },
        { t: "very online", tier: 1, tags: ["self"] }, { t: "formerly famous", tier: 1, tags: ["fame"] }, { t: "emotionally available", tier: 1, tags: ["love"] }, { t: "overqualified", tier: 1, tags: ["work"] },
        { t: "allegedly immortal", tier: 2, tags: ["fame"] }, { t: "twice-knighted", tier: 2, tags: ["fame"] }, { t: "unlicensed", tier: 2, tags: ["work"] },
        { t: "self-employed", tier: 1, tags: ["work"] }, { t: "heavily tattooed", tier: 1, tags: ["self"] }, { t: "locally famous", tier: 1, tags: ["fame"] },
        { t: "thrice-engaged", tier: 1, tags: ["love"] }, { t: "self-ordained", tier: 2, tags: ["work"] },
      ] },
      { k: "n", name: "job", frame: "a ___", hint: "What you do, or what you are.", pool: [
        { t: "dental hygienist", tier: 0, tags: ["health"] }, { t: "notary public", tier: 0, tags: ["office"] }, { t: "beekeeper", tier: 0, tags: ["outdoors"] }, { t: "substitute teacher", tier: 0, tags: ["school"] },
        { t: "middle school band director", tier: 0, tags: ["school"] }, { t: "tax attorney", tier: 0, tags: ["office"] }, { t: "park ranger", tier: 0, tags: ["outdoors"] }, { t: "sommelier", tier: 0, tags: ["party"] },
        { t: "wedding DJ", tier: 0, tags: ["party"] }, { t: "local weatherman", tier: 0, tags: ["show"] }, { t: "nurse", tier: 0, tags: ["health"] }, { t: "librarian", tier: 0, tags: ["school"] }, { t: "accountant", tier: 0, tags: ["office"] },
        { t: "surgeon", tier: 0, tags: ["health"] }, { t: "sailor", tier: 0, tags: ["sea", "outdoors"] }, { t: "scientist", tier: 0, tags: ["school"] }, { t: "dog walker", tier: 0, tags: ["outdoors"] },
        { t: "lighthouse keeper", tier: 1, tags: ["sea"] }, { t: "former child actor", tier: 1, tags: ["show"] }, { t: "professional mourner", tier: 1, tags: ["show"] }, { t: "competitive eater", tier: 1, tags: ["show"] },
        { t: "mall Santa", tier: 1, tags: ["show", "party"] }, { t: "hand model", tier: 1, tags: ["show"] }, { t: "ghost hunter", tier: 1, tags: ["uncanny"] }, { t: "Renaissance faire blacksmith", tier: 1, tags: ["show"] }, { t: "mime", tier: 1, tags: ["show"] },
        { t: "minor wizard", tier: 2, tags: ["uncanny"] }, { t: "pirate", tier: 2, tags: ["sea"] }, { t: "time traveler from 1987", tier: 2, tags: ["uncanny"] }, { t: "duke", tier: 2, tags: ["royal"] }, { t: "ghost", tier: 2, tags: ["uncanny"] },
        { t: "radio host", tier: 0, tags: ["show"] }, { t: "ferry captain", tier: 0, tags: ["sea"] }, { t: "deep-sea welder", tier: 1, tags: ["sea"] },
        { t: "tarot reader", tier: 1, tags: ["uncanny"] }, { t: "deposed queen", tier: 2, tags: ["royal"] }, { t: "mermaid", tier: 2, tags: ["sea", "uncanny"] },
      ] },
      { k: "c", name: "clause", opt: true, odds: 0.35, trailing: true, frame: "a lighthouse keeper ___", hint: "Trails what you are: “with a boat”.", pool: [
        { t: "with a boat", tier: 0, tags: ["owns", "boats"] }, { t: "with two cats", tier: 0, tags: ["owns"] }, { t: "with a minivan", tier: 0, tags: ["owns"] },
        { t: "with two cats and a grudge", tier: 1, tags: ["owns", "past"] }, { t: "with a timeshare in Branson", tier: 1, tags: ["owns"] }, { t: "between boats", tier: 1, tags: ["boats", "past"] },
        { t: "with a past", tier: 1, tags: ["past"] }, { t: "who has seen things", tier: 1, tags: ["past"] },
        { t: "with a second, smaller boat inside the first boat", tier: 2, tags: ["boats", "owns"] }, { t: "with no further questions", tier: 2, tags: ["past"] }, { t: "with a restraining order against the sea", tier: 2, tags: ["boats", "past"] },
        { t: "with a canoe", tier: 0, tags: ["owns", "boats"] },
      ] },
    ],
    grow: ["q", "c"],
  },
  seek: {
    noun: true,
    parts: [
      { k: "n", name: "who you want", frame: "seeks ___", hint: "Who you're looking for, with its own “a” or “someone”.", pool: [
        { t: "someone who can parallel park", tier: 0, tags: ["practical"] }, { t: "someone kind", tier: 0, tags: ["kind"] }, { t: "a hiking buddy", tier: 0, tags: ["activity"] },
        { t: "someone to split appetizers with", tier: 0, tags: ["activity"] }, { t: "a person who reads the instructions", tier: 0, tags: ["practical"] }, { t: "someone with a car", tier: 0, tags: ["practical"] },
        { t: "someone sweet", tier: 0, tags: ["kind"] }, { t: "someone sane", tier: 0, tags: ["kind"] }, { t: "someone smart", tier: 0, tags: ["kind"] }, { t: "a guy with a car", tier: 0, tags: ["practical"] }, { t: "a big spoon", tier: 0, tags: ["kind"] },
        { t: "someone to argue with about soup", tier: 1, tags: ["activity"] }, { t: "a plus-one for my cousin's third wedding", tier: 1, tags: ["sidekick"] }, { t: "a tall person, for shelf reasons", tier: 1, tags: ["practical"] },
        { t: "a partner in crime, small crimes only", tier: 1, tags: ["crime", "sidekick"] }, { t: "someone who gets along with geese", tier: 1, tags: ["activity"] }, { t: "a pen pal with a boat", tier: 1, tags: ["activity"] },
        { t: "a second-in-command", tier: 1, tags: ["sidekick"] }, { t: "a dance partner for one very specific dance", tier: 1, tags: ["activity"] }, { t: "a co-pilot", tier: 1, tags: ["sidekick", "practical"] },
        { t: "a co-defendant", tier: 2, tags: ["crime"] }, { t: "someone to inherit my lighthouse", tier: 2, tags: ["legacy"] }, { t: "a witness", tier: 2, tags: ["crime"] }, { t: "an heir", tier: 2, tags: ["legacy"] },
        { t: "someone to haunt this house with", tier: 2, tags: ["legacy"] }, { t: "a getaway driver", tier: 2, tags: ["crime"] },
      ] },
      { k: "c", name: "clause", opt: true, odds: 0.3, trailing: true, frame: "someone kind ___", hint: "Trails who you want: “with references”.", pool: [
        { t: "for long walks and short conversations", tier: 0, tags: ["company"] }, { t: "who likes dogs", tier: 0, tags: ["taste"] },
        { t: "to grow old and suspicious with", tier: 1, tags: ["company"] }, { t: "who isn't a mime", tier: 1, tags: ["taste"] }, { t: "with references", tier: 1, tags: ["terms"] },
        { t: "for tax reasons", tier: 2, tags: ["terms"] }, { t: "who won't ask about the basement", tier: 2, tags: ["terms"] },
        { t: "who can cook", tier: 0, tags: ["taste"] }, { t: "to share a porch with", tier: 0, tags: ["company"] },
        { t: "with a clean record", tier: 1, tags: ["terms"] }, { t: "to share a timeshare with", tier: 1, tags: ["company"] },
        { t: "who is good with geese", tier: 1, tags: ["taste"] },
      ] },
    ],
    grow: ["c"],
  },
};

const HINGE_FORMS = {
  prompt: {
    name: "One prompt",
    stanzas: [
      { name: "The prompt", slots: ["prompt", "answer"], paras: [] },
      { name: "Liked", slots: ["prompt", "answer"], paras: [["like"]] },
      { name: "An opener", slots: ["prompt", "answer"], paras: [["like"], ["opener"]] },
      { name: "The conversation", slots: ["prompt", "answer"], paras: [["like"], ["opener"], ["reply"]] },
    ],
    beats: {
      like: { name: "who liked it", lines: [
        B(0, "Someone liked your answer."),
        B(0, "It's a match."),
        B(0, "Liked by Dan, 31, who works in logistics."),
        B(0, "Liked by Sarah, 29, who has three photos of the same hike."),
        B(1, "Liked by your cousin, by accident, and then again on purpose."),
        B(1, "Liked by a man whose only photo is a fish."),
        B(1, "Liked by your dentist, who should know better."),
        B(2, "Liked by {answer}."),
        B(2, "Liked by the moon. It's a match."),
      ] },
      opener: { name: "their opener", lines: [
        B(0, "“Okay, but tell me more about that.”"),
        B(0, "“Ha. Okay. Go on.”"),
        B(0, "“Haha same.”"),
        B(1, "“Is this a bit?”"),
        B(1, "“Is {answer} single?”"),
        B(1, "“My grandmother said the same thing, word for word.”"),
        B(2, "“I am {answer}.”"),
        B(2, "“Hello. I am the fish from the photo.”"),
      ] },
      reply: { name: "your reply", lines: [
        B(0, "You wrote back “lol.” It's been three days."),
        B(0, "You said “lol.” That was Monday."),
        B(0, "You suggested coffee. They suggested a different coffee."),
        B(1, "You wrote back a paragraph. You deleted the paragraph."),
        B(1, "You sent a voice memo, which was a mistake."),
        B(2, "You are now engaged. It happened very quickly."),
      ] },
    },
  },

  profile: {
    name: "The profile",
    stanzas: [
      { name: "One prompt", slots: ["prompt", "answer"], paras: [] },
      { name: "Two prompts", slots: ["prompt", "answer", "seek"], paras: [["second"]] },
      { name: "Three prompts", slots: ["prompt", "answer", "seek", "me"], paras: [["second"], ["third"]] },
      { name: "The whole profile", slots: ["prompt", "answer", "seek", "me"], paras: [["basics"], ["second"], ["third"]] },
    ],
    beats: {
      basics: { name: "the basics", lines: [
        B(0, "{Me}. 5′11″, if that matters. Doesn't smoke."),
        B(0, "{Me}. Lives in the city. Has a plant."),
        B(0, "{Me}. Has a cat."),
        B(1, "{Me}. 6′1″ in boots. Owns the boots."),
        B(1, "{Me}. Here for something real, or at least a brunch."),
        B(2, "{Me}. Height: yes. Politics: the soup kind."),
      ] },
      second: { name: "the second prompt", lines: [
        B(0, "I'm looking for: {seek}."),
        B(0, "We'll get along if you're {seek}."),
        B(0, "Green flags I look for: {seek}."),
        B(0, "Typical Sunday: brunch, a long walk, and {seek}."),
        B(1, "Dealbreaker: not being {seek}."),
        B(1, "My mom will love you if you're {seek}."),
        B(2, "Swipe left if you're not {seek}. Swipe right if you are, or if you have a boat."),
      ] },
      third: { name: "the third prompt", lines: [
        B(0, "Two truths and a lie: I'm {me}, I can parallel park, I love hiking."),
        B(0, "My friends would describe me as {me}, mostly."),
        B(0, "Fun fact: I'm {me}."),
        B(1, "Two truths and a lie: I'm {me}, I'm afraid of {answer}, I've never seen the ocean."),
        B(1, "Unusual skills: I can identify {answer} by sound alone."),
        B(2, "Two truths and a lie: I'm {me}. I'm {me}. I'm {me}."),
        B(2, "Two truths and a lie: I'm {me}, I'm not {answer}, I have never once lied."),
      ] },
    },
  },

  classified: {
    name: "Classified ad",
    stanzas: [
      { name: "The prompt", slots: ["prompt", "answer"], paras: [] },
      { name: "The ad", slots: ["prompt", "answer", "me", "seek"], paras: [["ad", "must"]] },
      { name: "With terms", slots: ["prompt", "answer", "me", "seek"], paras: [["ad", "must"], ["box"]] },
      { name: "The personals page", slots: ["prompt", "answer", "me", "seek"], paras: [["ad", "also", "must"], ["box"]] },
    ],
    beats: {
      ad: { name: "the ad", lines: [
        B(0, "{Me} seeks {seek}."),
        B(0, "{Me}, recently relocated, seeks {seek}."),
        B(1, "{Me}, recently out of a situation, seeks {seek}."),
        B(1, "{Me} seeks {seek}. No timewasters. Some timewasting."),
        B(2, "{Me}, legally speaking, seeks {seek}."),
      ] },
      also: { name: "about me", byMood: true, lines: {
        "-1": [B(0, "Fears {answer}."), B(1, "Afraid of {answer}, and working on it."), B(2, "Has a restraining order against {answer}.")],
        "1": [B(0, "Loves {answer}."), B(1, "Weak for {answer}."), B(2, "Has a tattoo of {answer}.")],
        "0": [B(0, "Has opinions about {answer}."), B(1, "Will not shut up about {answer}."), B(2, "Was once briefly married to {answer}.")],
      } },
      must: { name: "the terms", lines: [
        B(0, "Must love weather."),
        B(0, "Must love dogs."),
        B(0, "Must own a car."),
        B(0, "Must be okay with {answer}."),
        B(1, "Must own a car, or a horse that behaves like one."),
        B(1, "Must tolerate accordion."),
        B(1, "No geese."),
        B(2, "Must not be {answer}."),
        B(2, "Must be willing to relocate to the lighthouse."),
      ] },
      box: { name: "how to reply", lines: [
        B(0, "Reply to Box 114, care of the Gazette."),
        B(0, "Serious inquiries only."),
        B(0, "Call 555-0142. Ask for Gus."),
        B(1, "Serious inquiries only. Unserious inquiries also fine."),
        B(1, "Reply in person at the pier, Thursdays, after the fog lifts."),
        B(2, "Reply by carrier pigeon. Not that pigeon."),
      ] },
    },
  },
};

const HINGE_GRAMMAR = {
  id: "hinge",
  name: "Hinge prompts",
  description: "A dating-app prompt and the answer you give it: “My most irrational fear: a heron that knows my name.” One prompt, a three-prompt profile, or a classified ad in the back of the paper. The dial turns green flags red.",
  maxDepth: 1,
  cards: [
    { key: "prompt", label: "Prompt", hint: "the prompt" },
    { key: "answer", label: "Answer", hint: "your answer" },
    { key: "me", label: "You", hint: "what you do" },
    { key: "seek", label: "Seeking", hint: "who you want" },
  ],
  headline: "The prompt",
  pronouns: null,
  moodCard: "prompt",
  line: "{prompt} {answer}.",
  keep: { card: "answer", name: "Your material", verb: "Keep this answer", note: "Answers that worked. Tell another to try one on a different prompt." },
  schemas: HINGE_SCHEMAS,
  forms: HINGE_FORMS,
  rules: {
    landing: false,
    dialName: "Red flags",
    dialLabels: ["Swipe right", "Intriguing", "Red flag"],
    dialNotes: [
      "The answer fits the prompt. A sweet, swipeable profile.",
      "The answer argues with the prompt: the fear is warm bread, the key to your heart is reply-all.",
      "Nothing fits, and the job doesn't help. You'll get three matches, all of them interesting.",
    ],
    pairs: [
      { a: "answer", b: "prompt", on: "mood", label: "prompt ↔ answer" },
      { a: "answer", b: "prompt", on: "register", label: "prompt ↔ answer (register)" },
      { a: "me", b: "answer", on: "register", label: "you ↔ answer" },
      { a: "seek", b: "me", on: "register", label: "you ↔ who you want" },
    ],
    grounded: "prompt",
  },
};
GRAMMARS[HINGE_GRAMMAR.id] = HINGE_GRAMMAR;
