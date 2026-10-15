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
        { t: "second sun", tier: 2 },
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
        { t: "holds still", tier: 1 }, { t: "will not talk", tier: 1 }, { t: "stays silent", tier: 1 },
        { t: "walks into a mirror", tier: 2 }, { t: "swallows stars", tier: 2 },
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
      { k: "n", name: "place", det: ["in the", "on the", "at the", "under the", "near the", "in a", "under a", "beside a", "on a", "at a"], frame: "{det} ___", hint: "A place, with how the image is placed in it (in, on, under…).", pool: [
        { det: "in the", t: "kitchen", tier: 0 }, { det: "at the", t: "station", tier: 0 }, { det: "on the", t: "shore", tier: 0 },
        { det: "in a", t: "parking lot", tier: 0 }, { det: "near the", t: "window", tier: 0 }, { det: "under the", t: "stairs", tier: 0 },
        { det: "in the", t: "garden", tier: 0 }, { det: "in the", t: "orchard", tier: 0 }, { det: "on the", t: "porch", tier: 0 }, { det: "at the", t: "bakery", tier: 0 },
        { det: "in the", t: "laundromat", tier: 0 }, { det: "on the", t: "pier", tier: 0 }, { det: "in the", t: "hallway", tier: 0 }, { det: "in a", t: "field", tier: 0 },
        { det: "at the", t: "lake", tier: 0 }, { det: "in the", t: "car", tier: 0 }, { det: "in the", t: "chapel", tier: 1 }, { det: "in the", t: "observatory", tier: 1 },
        { det: "at the", t: "edge of the map", tier: 1 }, { det: "in the", t: "weather of a photograph", tier: 2 }, { det: "on the", t: "underside of the moon", tier: 2 },
        { det: "in a", t: "hospital corridor", tier: 1 }, { det: "at the", t: "bottom of a well", tier: 1 }, { det: "beside a", t: "closed theater", tier: 1 },
        { det: "in the", t: "inside of a bell", tier: 2 }, { det: "in a", t: "city of paper", tier: 2 }, { det: "under a", t: "second sky", tier: 2 },
        { det: "on a", t: "hill", tier: 0 }, { det: "at a", t: "bus stop", tier: 0 }, { det: "in a", t: "small town", tier: 0 },
        { det: "at a", t: "crossroads at night", tier: 1 }, { det: "on a", t: "road with no sign", tier: 1 },
        { det: "on a", t: "stone step", tier: 1 }, { det: "in a", t: "side street", tier: 1 },
        { det: "in a", t: "room of mirrors", tier: 2 }, { det: "at a", t: "bus stop for ghosts", tier: 2 }, { det: "under a", t: "sunken sky", tier: 2 },
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
        { t: "an hour ago", tier: 0 }, { t: "an hour past all hours", tier: 1 }, { t: "on a Monday that is also a moon", tier: 2 },
        { t: "sometimes", tier: 0 }, { t: "someday soon", tier: 1 }, { t: "sixty seconds, sideways", tier: 2 },
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
        { t: "after dark,", tier: 0 }, { t: "in March,", tier: 0 }, { t: "above all,", tier: 0 }, { t: "as a rule,", tier: 0 },
        { t: "on a Sunday,", tier: 0 }, { t: "at a wedding,", tier: 0 }, { t: "in a small town,", tier: 0 },
        { t: "in a leap year,", tier: 1 }, { t: "on the ferry,", tier: 1 }, { t: "during a full moon,", tier: 1 },
        { t: "south of the river,", tier: 1 }, { t: "at a potluck,", tier: 1 },
        { t: "in the next life,", tier: 2 }, { t: "underwater,", tier: 2 }, { t: "once the bees have voted,", tier: 2 },
        { t: "since spring,", tier: 1 }, { t: "so say saints,", tier: 2 },
      ] },
      { k: "n", name: "advice", mood: true, frame: "___ a heron", hint: "The advice, as an order that takes someone: “never trust”, “always thank”. Its mood: a warning is bad, a blessing good.", pool: [
        { t: "never trust", v: -1, tier: 0 }, { t: "never lend money to", v: -1, tier: 0 }, { t: "never argue with", v: -1, tier: 0 },
        { t: "beware of", v: -1, tier: 0 }, { t: "never turn your back on", v: -1, tier: 0 }, { t: "never play cards with", v: -1, tier: 0 },
        { t: "don't marry", v: -1, tier: 0 }, { t: "never ask directions from", v: -1, tier: 0 }, { t: "avoid", v: -1, tier: 0 },
        { t: "never make eye contact with", v: -1, tier: 0 }, { t: "watch out for", v: -1, tier: 0 },
        { t: "never go fishing with", v: -1, tier: 1 }, { t: "never share a canoe with", v: -1, tier: 1 }, { t: "never lend your good pen to", v: -1, tier: 1 },
        { t: "never introduce your mother to", v: -1, tier: 1 }, { t: "shun", v: -1, tier: 1 }, { t: "sue", v: -1, tier: 1 },
        { t: "never sing in front of", v: -1, tier: 1 }, { t: "never confess your middle name to", v: -1, tier: 2 },
        { t: "never let your soup be seen by", v: -1, tier: 2 }, { t: "never teach a card trick to", v: -1, tier: 2 }, { t: "spurn", v: -1, tier: 1 },
        { t: "always thank", v: 1, tier: 0 }, { t: "be kind to", v: 1, tier: 0 }, { t: "always make room for", v: 1, tier: 0 },
        { t: "trust", v: 1, tier: 0 }, { t: "listen to", v: 1, tier: 0 }, { t: "always wave to", v: 1, tier: 0 },
        { t: "always tip", v: 1, tier: 0 }, { t: "save a seat for", v: 1, tier: 0 }, { t: "forgive", v: 1, tier: 0 }, { t: "always laugh at", v: 1, tier: 0 },
        { t: "always set a place for", v: 1, tier: 1 }, { t: "leave the porch light on for", v: 1, tier: 1 }, { t: "spoil", v: 1, tier: 1 },
        { t: "salute", v: 1, tier: 1 }, { t: "write letters to", v: 1, tier: 1 }, { t: "marry", v: 1, tier: 1 },
        { t: "serenade", v: 1, tier: 2 }, { t: "knight", v: 1, tier: 2 }, { t: "name your firstborn after", v: 1, tier: 2 },
        { t: "pity", v: 0, tier: 0 }, { t: "keep an eye on", v: 0, tier: 0 }, { t: "make peace with", v: 0, tier: 0 },
        { t: "learn from", v: 0, tier: 0 }, { t: "never underestimate", v: 0, tier: 0 }, { t: "respect", v: 0, tier: 0 },
        { t: "humor", v: 0, tier: 1 }, { t: "study", v: 0, tier: 1 }, { t: "soothe", v: 0, tier: 1 },
        { t: "count the spoons after a visit from", v: 0, tier: 1 }, { t: "never wake", v: 0, tier: 0 },
        { t: "always know where you stand with", v: 0, tier: 1 }, { t: "speak softly to", v: 0, tier: 1 },
        { t: "never ask the age of", v: 0, tier: 2 }, { t: "leave a small offering for", v: 0, tier: 2 }, { t: "never correct the spelling of", v: 0, tier: 2 },
      ] },
    ],
    grow: ["w"],
  },
  who: {
    noun: true,
    parts: [
      { k: "q", name: "quality", opt: true, odds: 0.3, frame: "a ___ heron", hint: "Describes them. An adjective.", pool: [
        { t: "wet", tier: 0 }, { t: "tall", tier: 0 }, { t: "quiet", tier: 0 }, { t: "retired", tier: 0 }, { t: "smiling", tier: 0 },
        { t: "barefoot", tier: 0 }, { t: "well-dressed", tier: 0 }, { t: "hungry", tier: 0 }, { t: "lonely", tier: 0 },
        { t: "over-friendly", tier: 1 }, { t: "freshly divorced", tier: 1 }, { t: "bilingual", tier: 1 }, { t: "recently knighted", tier: 1 },
        { t: "suspiciously helpful", tier: 1 }, { t: "unlicensed", tier: 1 }, { t: "sunburnt", tier: 0 }, { t: "sober", tier: 0 },
        { t: "invisible", tier: 2 }, { t: "ordained", tier: 2 }, { t: "laminated", tier: 2 }, { t: "time-traveling", tier: 2 }, { t: "haunted", tier: 2 },
        { t: "sleepy", tier: 0 }, { t: "smug", tier: 1 },
      ] },
      { k: "n", name: "subject", pronouns: true, det: ["a", "the", "any", "your"], frame: "{det} ___", hint: "Who the advice is about, with pronouns (a heron is “it”).", pool: [
        { det: "a", t: "heron", ...IT, tier: 0 }, { det: "a", t: "man", ...HE, tier: 0 }, { det: "a", t: "woman", ...SHE, tier: 0 },
        { det: "a", t: "dentist", ...THEY, tier: 0 }, { det: "a", t: "goose", ...IT, tier: 0 }, { det: "a", t: "dog", ...IT, tier: 0 },
        { det: "a", t: "cat", ...IT, tier: 0 }, { det: "your", t: "neighbor", ...THEY, tier: 0 }, { det: "a", t: "priest", ...HE, tier: 0 },
        { det: "a", t: "barber", ...HE, tier: 0 }, { det: "a", t: "landlord", ...THEY, tier: 0 }, { det: "a", t: "fisherman", ...HE, tier: 0 },
        { det: "a", t: "widow", ...SHE, tier: 0 }, { det: "a", t: "lawyer", ...THEY, tier: 0 }, { det: "a", t: "baker", ...SHE, tier: 0 },
        { det: "a", t: "horse", ...IT, tier: 0 }, { det: "a", t: "crow", ...IT, tier: 0 }, { det: "a", t: "sailor", ...HE, tier: 0 },
        { det: "a", t: "tailor", ...HE, tier: 0 }, { det: "your", t: "sister", ...SHE, tier: 0 }, { det: "a", t: "stranger", ...THEY, tier: 0 },
        { det: "a", t: "squirrel", ...IT, tier: 0 }, { det: "a", t: "cousin", ...THEY, tier: 0 },
        { det: "a", t: "accordion player", ...HE, tier: 1 }, { det: "a", t: "lighthouse keeper", ...SHE, tier: 1 }, { det: "a", t: "magician", ...HE, tier: 1 },
        { det: "a", t: "swan", ...IT, tier: 1 }, { det: "a", t: "weatherman", ...HE, tier: 1 }, { det: "a", t: "goat", ...IT, tier: 1 },
        { det: "a", t: "mime", ...THEY, tier: 1 }, { det: "a", t: "notary public", ...SHE, tier: 1 }, { det: "a", t: "substitute teacher", ...HE, tier: 1 },
        { det: "the", t: "tax man", ...HE, tier: 1 }, { det: "a", t: "snail", ...IT, tier: 1 }, { det: "a", t: "saint", ...SHE, tier: 1 },
        { det: "a", t: "parrot", ...IT, tier: 1 },
        { det: "a", t: "ghost", ...IT, tier: 2 }, { det: "the", t: "moon", ...IT, tier: 2 }, { det: "a", t: "small god", ...IT, tier: 2 },
        { det: "a", t: "lighthouse", ...IT, tier: 2 }, { det: "a", t: "weathervane", ...IT, tier: 2 }, { det: "a", t: "ventriloquist's dummy", ...IT, tier: 2 },
        { det: "a", t: "soup", ...IT, tier: 2 }, { det: "any", t: "casserole", ...IT, tier: 2 },
      ] },
      { k: "c", name: "clause", opt: true, trailing: true, frame: "a heron ___", hint: "Trails the subject: “that knows your name”, “with two canoes”.", pool: [
        { t: "that knows your name", tier: 0 }, { t: "with two canoes", tier: 0 }, { t: "that won't sit down", tier: 0 },
        { t: "that calls you “champ”", tier: 0 }, { t: "with clean shoes", tier: 0 }, { t: "in a hurry", tier: 0 }, { t: "with a boat", tier: 0 },
        { t: "that whistles", tier: 0 }, { t: "that owns a van", tier: 0 },
        { t: "with opinions about soup", tier: 1 }, { t: "that follows you home", tier: 1 }, { t: "with a second, smaller wallet", tier: 1 },
        { t: "that is between boats", tier: 1 }, { t: "that laughs at funerals", tier: 1 }, { t: "that hums in church", tier: 1 },
        { t: "that claims to be your cousin", tier: 1 }, { t: "that was raised by {who}", tier: 1 }, { t: "that has never seen Ohio", tier: 1 },
        { t: "that has met {who}", tier: 2 }, { t: "that is secretly {who}", tier: 2 }, { t: "with a lawyer", tier: 2 },
        { t: "that remembers being rain", tier: 2 }, { t: "that sells umbrellas indoors", tier: 2 },
      ] },
    ],
    grow: ["c", "q"],
  },
  why: {
    parts: [
      { k: "n", name: "reason", mood: true, frame: "never trust a heron, ___", hint: "Why, starting with its joining word (“for”, “because”, “unless”). Pronouns agree with the subject: “for {p} {has}…”.", pool: [
        { t: "for {p} {has} already told the others", v: -1, tier: 0 }, { t: "for {p} will want something back", v: -1, tier: 0 },
        { t: "for {p} {has} nothing to lose", v: -1, tier: 0 }, { t: "because {p} remember{s} everything", v: -1, tier: 0 },
        { t: "for {p} {is} never alone", v: -1, tier: 0 }, { t: "because {p} always bring{s} a friend", v: -1, tier: 0 },
        { t: "for {p} will want a favor", v: -1, tier: 0 }, { t: "for {p} {has} a key to your house", v: -1, tier: 1 },
        { t: "since {p} sulk{s}", v: -1, tier: 1 }, { t: "since {p} spit{s}", v: -1, tier: 1 },
        { t: "for {p} {is} owed three geese", v: -1, tier: 2 }, { t: "for {p} {is} the moon in a trench coat", v: -1, tier: 2 },
        { t: "for {p} will remember you kindly", v: 1, tier: 0 }, { t: "because {p} {was} once like you", v: 1, tier: 0 },
        { t: "for {p} always repay{s} a kindness", v: 1, tier: 0 }, { t: "and {p} will bring soup", v: 1, tier: 0 },
        { t: "and your gutters will never clog", v: 1, tier: 1 }, { t: "for {p} will carry your name into the next town", v: 1, tier: 1 },
        { t: "since {p} sing{s} so sweetly", v: 1, tier: 1 }, { t: "and {p} will bring a pie at a bad moment", v: 1, tier: 1 },
        { t: "for {p} {has} a cousin in the weather", v: 1, tier: 2 }, { t: "and the bees will tell the others", v: 1, tier: 2 },
        { t: "for {p} {is} neither friend nor foe", v: 0, tier: 0 }, { t: "unless it is Tuesday", v: 0, tier: 0 },
        { t: "for {p} {is} only passing through", v: 0, tier: 0 }, { t: "and never on a Sunday", v: 0, tier: 0 },
        { t: "and do not ask why", v: 0, tier: 1 }, { t: "for reasons {p} will not explain", v: 0, tier: 1 },
        { t: "until the river thaws", v: 0, tier: 1 }, { t: "since {p} snore{s}", v: 0, tier: 1 }, { t: "or at least wave", v: 0, tier: 1 },
        { t: "for {p} {is} legally your landlord", v: 0, tier: 2 }, { t: "for {p} {was} here before the river", v: 0, tier: 2 },
        { t: "for {p} will outlive your furniture", v: 0, tier: 2 },
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
        { t: "long-legged", tier: 0 }, { t: "spotted", tier: 0 }, { t: "old", tier: 0 }, { t: "patient", tier: 0 }, { t: "gray", tier: 0 },
        { t: "common", tier: 0 }, { t: "humble", tier: 0 }, { t: "little", tier: 0 }, { t: "shy", tier: 0 },
        { t: "melancholy", tier: 1 }, { t: "self-employed", tier: 1 }, { t: "overdressed", tier: 1 }, { t: "lesser", tier: 1 }, { t: "smug", tier: 1 },
        { t: "tax-exempt", tier: 2 }, { t: "unpublished", tier: 2 }, { t: "twice-divorced", tier: 2 }, { t: "sleepy", tier: 0 },
      ] },
      { k: "n", name: "creature", pronouns: true, det: ["the", "your", "a"], frame: "{det} ___", hint: "Who the myth explains, with pronouns (the heron is “it”, the geese are “they”).", pool: [
        { det: "the", t: "heron", ...IT, tier: 0 }, { det: "the", t: "cat", ...IT, tier: 0 }, { det: "the", t: "goose", ...IT, tier: 0 },
        { det: "the", t: "crow", ...IT, tier: 0 }, { det: "the", t: "owl", ...IT, tier: 0 }, { det: "the", t: "tortoise", ...IT, tier: 0 },
        { det: "the", t: "frog", ...IT, tier: 0 }, { det: "the", t: "dog", ...IT, tier: 0 }, { det: "the", t: "snail", ...IT, tier: 0 },
        { det: "the", t: "giraffe", ...IT, tier: 0 }, { det: "the", t: "beaver", ...IT, tier: 0 }, { det: "the", t: "mosquito", ...IT, tier: 0 },
        { det: "the", t: "porcupine", ...IT, tier: 0 }, { det: "the", t: "octopus", ...IT, tier: 0 }, { det: "the", t: "swan", ...IT, tier: 0 },
        { det: "the", t: "pigeon", ...IT, tier: 0 }, { det: "the", t: "squirrel", ...IT, tier: 0 }, { det: "the", t: "sloth", ...IT, tier: 0 },
        { det: "the", t: "cow", ...IT, tier: 0 }, { det: "the", t: "geese", ...THEY, tier: 0 }, { det: "the", t: "moth", ...IT, tier: 0 },
        { det: "the", t: "seal", ...IT, tier: 0 }, { det: "the", t: "skunk", ...IT, tier: 0 },
        { det: "a", t: "frog", ...IT, tier: 0 }, { det: "a", t: "cat", ...IT, tier: 0 }, { det: "a", t: "crow", ...IT, tier: 0 }, { det: "your", t: "dog", ...IT, tier: 0 },
        { det: "the", t: "mailman", ...HE, tier: 1 }, { det: "your", t: "uncle", ...HE, tier: 1 }, { det: "the", t: "toaster", ...IT, tier: 1 },
        { det: "the", t: "dentist", ...SHE, tier: 1 }, { det: "the", t: "radiator", ...IT, tier: 1 }, { det: "the", t: "weatherman", ...HE, tier: 1 },
        { det: "your", t: "landlord", ...HE, tier: 1 }, { det: "the", t: "lighthouse", ...IT, tier: 1 }, { det: "the", t: "bagpipe", ...IT, tier: 1 },
        { det: "the", t: "left sock", ...IT, tier: 2 }, { det: "the", t: "DMV", ...IT, tier: 2 }, { det: "the", t: "smoke detector", ...IT, tier: 2 },
        { det: "the", t: "moon's ex-husband", ...HE, tier: 2 }, { det: "the", t: "concept of brunch", ...IT, tier: 2 }, { det: "the", t: "fax machine", ...IT, tier: 2 },
      ] },
    ],
    grow: ["q"],
  },
  quirk: {
    parts: [
      { k: "n", name: "quirk", frame: "why the heron ___", hint: "What it does now, in the present tense, with {s} on the verb: “stand{s} on one leg”.", pool: [
        { t: "stand{s} on one leg", tier: 0 }, { t: "sleep{s} all day", tier: 0 }, { t: "never blink{s}", tier: 0 }, { t: "eat{s} alone", tier: 0 },
        { t: "look{s} both ways", tier: 0 }, { t: "won't make eye contact", tier: 0 }, { t: "sing{s} at dawn", tier: 0 }, { t: "walk{s} sideways", tier: 0 },
        { t: "hide{s} {pos} face", tier: 0 }, { t: "come{s} out at night", tier: 0 }, { t: "shed{s} in March", tier: 0 }, { t: "can't swim", tier: 0 },
        { t: "avoid{s} the river", tier: 0 }, { t: "always know{s} when it's going to rain", tier: 0 }, { t: "sulk{s}", tier: 0 }, { t: "snore{s}", tier: 0 }, { t: "sit{s} still", tier: 0 }, { t: "sleep{s} sideways", tier: 1 }, { t: "sniff{s} socks", tier: 1 },
        { t: "stare{s} at walls", tier: 1 }, { t: "hum{s} when nervous", tier: 1 }, { t: "follow{s} you home", tier: 1 }, { t: "show{s} up uninvited", tier: 1 },
        { t: "refuse{s} to use stairs", tier: 1 }, { t: "sit{s} in the back at weddings", tier: 1 }, { t: "count{s} things under {pos} breath", tier: 1 },
        { t: "{has} to be home by nine", tier: 1 }, { t: "{is} afraid of buttons", tier: 1 }, { t: "{is} always slightly damp", tier: 1 }, { t: "sigh{s} at boats", tier: 1 },
        { t: "blink{s} in Morse code", tier: 2 }, { t: "file{s} {pos} taxes early", tier: 2 }, { t: "owe{s} the moon money", tier: 2 },
        { t: "attend{s} every funeral in the county", tier: 2 }, { t: "{has} no word for Tuesday", tier: 2 }, { t: "speak{s} only in the third person on Thursdays", tier: 2 },
        { t: "{is} legally a lighthouse", tier: 2 }, { t: "sell{s} insurance to frogs", tier: 2 },
      ] },
    ],
    grow: [],
  },
  deed: {
    parts: [
      { k: "a", name: "manner", opt: true, odds: 0.35, frame: "one day it ___ lied to the river", hint: "How it did it. An adverb.", pool: [
        { t: "foolishly", tier: 0 }, { t: "bravely", tier: 0 }, { t: "accidentally", tier: 0 }, { t: "quietly", tier: 0 }, { t: "proudly", tier: 0 },
        { t: "secretly", tier: 1 }, { t: "very loudly", tier: 1 }, { t: "politely", tier: 1 }, { t: "sort of", tier: 1 },
        { t: "ceremonially", tier: 2 }, { t: "on a technicality", tier: 2 }, { t: "slyly", tier: 1 },
      ] },
      { k: "n", name: "deed", mood: true, frame: "one day it ___", hint: "What it did, in the past tense. Its mood: a good deed, a bad one, or neither.", pool: [
        { t: "lied to the river", v: -1, tier: 0 }, { t: "stole a fish from the king", v: -1, tier: 0 }, { t: "laughed at the moon", v: -1, tier: 0 },
        { t: "broke a promise", v: -1, tier: 0 }, { t: "ate the last plum", v: -1, tier: 0 }, { t: "cheated at cards", v: -1, tier: 0 },
        { t: "skipped the harvest", v: -1, tier: 0 }, { t: "ran from a fight", v: -1, tier: 0 }, { t: "said a bad word", v: -1, tier: 0 }, { t: "bit a king", v: -1, tier: 1 }, { t: "stole six sardines", v: -1, tier: 1 }, { t: "sold sunshine", v: -1, tier: 2 }, { t: "spilt the sun", v: -1, tier: 1 }, { t: "slept through {pos} own wedding", v: -1, tier: 1 },
        { t: "kept the moon waiting", v: -1, tier: 1 }, { t: "lost the river in a bet", v: -1, tier: 1 }, { t: "told the bees a secret", v: -1, tier: 1 },
        { t: "sold the wind a used cart", v: -1, tier: 2 }, { t: "borrowed the sun and returned it dented", v: -1, tier: 2 }, { t: "replied-all to the whole forest", v: -1, tier: 2 },
        { t: "shared {pos} supper with a stranger", v: 1, tier: 0 }, { t: "carried an old frog across the river", v: 1, tier: 0 }, { t: "kept the fire going all winter", v: 1, tier: 0 },
        { t: "saved the last seed", v: 1, tier: 0 }, { t: "gave away {pos} only coat", v: 1, tier: 0 }, { t: "found the lost lamb", v: 1, tier: 0 }, { t: "built a dam for a friend", v: 1, tier: 0 }, { t: "sang sweetly", v: 1, tier: 0 }, { t: "sang to a sad frog", v: 1, tier: 1 }, { t: "saved six swans", v: 1, tier: 1 },
        { t: "sang the sun up", v: 1, tier: 1 }, { t: "taught the wind to whistle", v: 1, tier: 1 }, { t: "learned every name in the forest", v: 1, tier: 1 },
        { t: "saved a swan", v: 1, tier: 1 }, { t: "won a staring contest with the sky", v: 1, tier: 2 }, { t: "returned the moon's wallet", v: 1, tier: 2 },
        { t: "asked one question too many", v: 0, tier: 0 }, { t: "agreed to something without reading it", v: 0, tier: 0 }, { t: "looked back", v: 0, tier: 0 },
        { t: "said yes to the wrong question", v: 0, tier: 0 }, { t: "slept in", v: 0, tier: 0 }, { t: "took a long nap", v: 0, tier: 0 }, { t: "sat still", v: 0, tier: 0 }, { t: "slept soundly", v: 0, tier: 0 }, { t: "skipped Sunday", v: 0, tier: 1 }, { t: "said this was a fair trick", v: 0, tier: 1 },
        { t: "counted the stars and got a different number", v: 0, tier: 1 }, { t: "fell asleep at the edge of the world", v: 0, tier: 1 },
        { t: "tried to be in two places at once", v: 0, tier: 1 }, { t: "sat on a stump for a year", v: 0, tier: 1 },
        { t: "married the wind", v: 0, tier: 2 }, { t: "invented Wednesday", v: 0, tier: 2 }, { t: "swallowed a small storm", v: 0, tier: 2 },
      ] },
      { k: "t", name: "detail", opt: true, odds: 0.35, trailing: true, frame: "one day it lied to the river ___", hint: "When or how it happened: “on the first day of winter”.", pool: [
        { t: "on the first day of winter", tier: 0 }, { t: "in front of everyone", tier: 0 }, { t: "at the edge of the pond", tier: 0 },
        { t: "for a dare", tier: 1 }, { t: "while the moon wasn't looking", tier: 1 }, { t: "with help from {rival}", tier: 1 }, { t: "at a wedding", tier: 1 },
        { t: "using only {pos} left foot", tier: 2 }, { t: "in a borrowed hat", tier: 2 }, { t: "on a Tuesday that was later cancelled", tier: 2 },
      ] },
    ],
    grow: ["a", "t"],
  },
  since: {
    parts: [
      { k: "n", name: "ever since", mood: true, frame: "and that is why the heron stands on one leg, ___", hint: "How it carries on: “out of shame”, “as a reward”, “smugly”. Its mood: a punishment is bad, a reward good.", pool: [
        { t: "out of shame", v: -1, tier: 0 }, { t: "as a punishment", v: -1, tier: 0 }, { t: "in sorrow", v: -1, tier: 0 }, { t: "as payback", v: -1, tier: 0 },
        { t: "to say sorry", v: -1, tier: 0 }, { t: "sadly", v: -1, tier: 0 }, { t: "as penance", v: -1, tier: 1 }, { t: "sullenly", v: -1, tier: 1 },
        { t: "sheepishly", v: -1, tier: 1 }, { t: "under protest", v: -1, tier: 1 }, { t: "as part of a long con", v: -1, tier: 2 }, { t: "on the advice of {pos} lawyer", v: -1, tier: 2 },
        { t: "as a reward", v: 1, tier: 0 }, { t: "proudly", v: 1, tier: 0 }, { t: "for good luck", v: 1, tier: 0 }, { t: "as a gift", v: 1, tier: 0 },
        { t: "sweetly", v: 1, tier: 0 }, { t: "smugly", v: 1, tier: 1 }, { t: "as a gift from the moon", v: 1, tier: 1 }, { t: "with the river's blessing", v: 1, tier: 1 },
        { t: "to show off", v: 1, tier: 1 }, { t: "as a sort of victory lap", v: 1, tier: 2 }, { t: "under a royal charter", v: 1, tier: 2 },
        { t: "out of habit", v: 0, tier: 0 }, { t: "just in case", v: 0, tier: 0 }, { t: "out of pity", v: 0, tier: 0 }, { t: "silently", v: 0, tier: 0 },
        { t: "for reasons {p} won't discuss", v: 0, tier: 1 }, { t: "solemnly", v: 0, tier: 1 }, { t: "until someone apologizes", v: 0, tier: 1 },
        { t: "by order of the frogs", v: 0, tier: 2 }, { t: "on legal advice", v: 0, tier: 2 }, { t: "as a sort of performance piece", v: 0, tier: 2 },
      ] },
    ],
    grow: [],
  },
  rival: {
    noun: true,
    parts: [
      { k: "n", name: "rival", det: ["the", "a"], frame: "{det} ___", hint: "Who else is in the story: “the river”, “a clever crow”.", pool: [
        { det: "the", t: "river", tier: 0 }, { det: "the", t: "moon", tier: 0 }, { det: "the", t: "wind", tier: 0 }, { det: "a", t: "fox", tier: 0 },
        { det: "the", t: "sea", tier: 0 }, { det: "a", t: "old tortoise", tier: 0 }, { det: "the", t: "sun", tier: 0 }, { det: "a", t: "clever crow", tier: 0 },
        { det: "the", t: "mountain", tier: 0 }, { det: "the", t: "snow", tier: 0 }, { det: "a", t: "snake", tier: 0 }, { det: "the", t: "stars", tier: 0 }, { det: "a", t: "wolf", tier: 0 }, { det: "a", t: "hawk", tier: 0 }, { det: "a", t: "snail", tier: 0 },
        { det: "the", t: "first winter", tier: 1 }, { det: "the", t: "king of the frogs", tier: 1 }, { det: "a", t: "duck with a grudge", tier: 1 },
        { det: "a", t: "man selling umbrellas", tier: 1 }, { det: "the", t: "last dinosaur", tier: 1 }, { det: "the", t: "village gossip", tier: 1 },
        { det: "the", t: "Postmaster of the Forest", tier: 2 }, { det: "the", t: "night's accountant", tier: 2 }, { det: "the", t: "Department of Weather", tier: 2 },
        { det: "a", t: "very small god", tier: 2 }, { det: "the", t: "concept of Thursday", tier: 2 },
      ] },
      { k: "c", name: "clause", opt: true, odds: 0.3, trailing: true, frame: "the river ___", hint: "Trails the rival: “who never forgets”.", pool: [
        { t: "who never forgets", tier: 0 }, { t: "who was in a mood", tier: 0 }, { t: "who had been drinking", tier: 1 },
        { t: "who kept a list", tier: 1 }, { t: "with one eye open", tier: 1 }, { t: "who was secretly {who}", tier: 2 }, { t: "in a little hat", tier: 2 },
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
        { t: "My most irrational fear:", v: -1, tier: 0 }, { t: "My biggest date fail:", v: -1, tier: 0 }, { t: "Pet peeve:", v: -1, tier: 0 },
        { t: "The worst idea I've ever had:", v: -1, tier: 0 }, { t: "What keeps me up at night:", v: -1, tier: 0 }, { t: "I'm still not over", v: -1, tier: 0 },
        { t: "Red flags:", v: -1, tier: 0 }, { t: "My worst habit:", v: -1, tier: 0 }, { t: "My biggest flaw:", v: -1, tier: 0 },
        { t: "Never again:", v: -1, tier: 1 }, { t: "My nemesis:", v: -1, tier: 1 }, { t: "Recurring nightmare:", v: -1, tier: 1 },
        { t: "My villain origin story:", v: -1, tier: 1 }, { t: "Sore subjects:", v: -1, tier: 1 }, { t: "Secret shames:", v: -1, tier: 1 }, { t: "Don't ask about", v: -1, tier: 1 },
        { t: "The judge said I can't go near", v: -1, tier: 2 }, { t: "I'm legally required to tell you about", v: -1, tier: 2 },
        { t: "The key to my heart is", v: 1, tier: 0 }, { t: "I go crazy for", v: 1, tier: 0 }, { t: "Green flags I look for:", v: 1, tier: 0 },
        { t: "My simple pleasures:", v: 1, tier: 0 }, { t: "The way to win me over is", v: 1, tier: 0 }, { t: "My love language is", v: 1, tier: 0 },
        { t: "I'm weirdly attracted to", v: 1, tier: 0 }, { t: "Typical Sunday:", v: 1, tier: 0 }, { t: "My happy place:", v: 1, tier: 0 },
        { t: "My idea of a perfect date:", v: 1, tier: 0 },
        { t: "Things I'd save in a fire:", v: 1, tier: 1 }, { t: "Sunday staples:", v: 1, tier: 1 }, { t: "Sweet spots:", v: 1, tier: 1 }, { t: "Specialties:", v: 1, tier: 1 },
        { t: "My emotional support animal is", v: 1, tier: 2 }, { t: "In my will, I leave everything to", v: 1, tier: 2 },
        { t: "Dating me is like", v: 0, tier: 0 }, { t: "I won't shut up about", v: 0, tier: 0 }, { t: "I geek out on", v: 0, tier: 0 },
        { t: "Change my mind about", v: 0, tier: 0 }, { t: "Ask me about", v: 0, tier: 0 }, { t: "I'm overly competitive about", v: 0, tier: 0 },
        { t: "The hill I will die on:", v: 0, tier: 0 }, { t: "Fun fact:", v: 0, tier: 0 }, { t: "A shower thought I recently had:", v: 0, tier: 0 },
        { t: "My therapist says it's about", v: 0, tier: 1 }, { t: "My last relationship was basically", v: 0, tier: 1 }, { t: "Superstitions:", v: 0, tier: 1 },
        { t: "I'm convinced the government is hiding", v: 0, tier: 1 },
        { t: "My emergency contact is", v: 0, tier: 2 }, { t: "What I'd bring to a duel:", v: 0, tier: 2 }, { t: "My rising sign is", v: 0, tier: 2 },
      ] },
    ],
    grow: [],
  },
  answer: {
    noun: true,
    parts: [
      { k: "n", name: "answer", mood: true, frame: "my most irrational fear: ___", hint: "Your answer, as a thing (with its own “a” or “my” if it needs one): “geese”, “a damp sock”. Its mood: something bad, good, or neither.", pool: [
        { t: "geese", v: -1, tier: 0 }, { t: "small talk", v: -1, tier: 0 }, { t: "people who clap when the plane lands", v: -1, tier: 0 },
        { t: "a damp sock", v: -1, tier: 0 }, { t: "voicemail", v: -1, tier: 0 }, { t: "mayonnaise", v: -1, tier: 0 }, { t: "group projects", v: -1, tier: 0 },
        { t: "the deep end", v: -1, tier: 0 }, { t: "a tax audit", v: -1, tier: 0 }, { t: "seagulls", v: -1, tier: 0 }, { t: "spiders", v: -1, tier: 0 },
        { t: "hold music", v: -1, tier: 0 }, { t: "my ex's band", v: -1, tier: 0 }, { t: "a wet handshake", v: -1, tier: 0 },
        { t: "a heron", v: -1, tier: 1 }, { t: "the ocean at night", v: -1, tier: 1 }, { t: "a mime", v: -1, tier: 1 }, { t: "ventriloquist dummies", v: -1, tier: 1 },
        { t: "reply-all", v: -1, tier: 1 }, { t: "my mother's new boyfriend, Gary", v: -1, tier: 1 }, { t: "a goose", v: -1, tier: 1 },
        { t: "the moon", v: -1, tier: 2 }, { t: "a sentient casserole", v: -1, tier: 2 }, { t: "a second, smaller me", v: -1, tier: 2 }, { t: "the concept of Wednesday", v: -1, tier: 2 },
        { t: "warm bread", v: 1, tier: 0 }, { t: "a good map", v: 1, tier: 0 }, { t: "someone who texts back", v: 1, tier: 0 }, { t: "a long walk", v: 1, tier: 0 },
        { t: "dogs", v: 1, tier: 0 }, { t: "a clean kitchen", v: 1, tier: 0 }, { t: "breakfast for dinner", v: 1, tier: 0 }, { t: "people who return the cart", v: 1, tier: 0 },
        { t: "a fresh notebook", v: 1, tier: 0 }, { t: "snacks", v: 1, tier: 0 }, { t: "sunsets", v: 1, tier: 0 }, { t: "a nap", v: 1, tier: 0 }, { t: "soft pretzels", v: 1, tier: 0 },
        { t: "a well-organized spice rack", v: 1, tier: 1 }, { t: "a man who owns a canoe", v: 1, tier: 1 }, { t: "a perfectly ripe pear", v: 1, tier: 1 },
        { t: "an accordion", v: 1, tier: 1 }, { t: "the smell of a hardware store", v: 1, tier: 1 }, { t: "a library card", v: 1, tier: 1 }, { t: "someone who knows a guy", v: 1, tier: 1 },
        { t: "a small, polite frog", v: 1, tier: 2 }, { t: "a goose who believes in me", v: 1, tier: 2 }, { t: "the ghost in my apartment", v: 1, tier: 2 },
        { t: "a wizard with a pension", v: 1, tier: 2 }, { t: "an apology from the moon", v: 1, tier: 2 },
        { t: "soup", v: 0, tier: 0 }, { t: "my cousin Dale", v: 0, tier: 0 }, { t: "the DMV", v: 0, tier: 0 }, { t: "jury duty", v: 0, tier: 0 },
        { t: "my landlord", v: 0, tier: 0 }, { t: "the weather", v: 0, tier: 0 }, { t: "sardines", v: 0, tier: 0 }, { t: "the group chat", v: 0, tier: 0 }, { t: "Costco", v: 0, tier: 0 },
        { t: "a strong opinion about fonts", v: 0, tier: 1 }, { t: "a lighthouse keeper", v: 0, tier: 1 }, { t: "soup, but cold", v: 0, tier: 1 },
        { t: "a canoe", v: 0, tier: 1 }, { t: "the bagpipes", v: 0, tier: 1 }, { t: "my ex's mom", v: 0, tier: 1 }, { t: "a timeshare", v: 0, tier: 1 },
        { t: "a single, very old goose", v: 0, tier: 2 }, { t: "the concept of Tuesday", v: 0, tier: 2 }, { t: "my second family", v: 0, tier: 2 }, { t: "a ghost", v: 0, tier: 2 },
      ] },
      { k: "c", name: "clause", opt: true, odds: 0.4, trailing: true, frame: "geese ___", hint: "Trails the answer: “that knows my name”, “on a first date”.", pool: [
        { t: "on a Tuesday", tier: 0 }, { t: "at a wedding", tier: 0 }, { t: "in the rain", tier: 0 }, { t: "from the nineties", tier: 0 },
        { t: "after midnight", tier: 0 }, { t: "on a first date", tier: 0 }, { t: "at the airport", tier: 0 },
        { t: "that learned my name", tier: 1 }, { t: "with a plan", tier: 1 }, { t: "that won't stop looking at me", tier: 1 }, { t: "named Gerald", tier: 1 },
        { t: "in a little hat", tier: 1 }, { t: "at my funeral", tier: 1 }, { t: "that called me “champ”", tier: 1 },
        { t: "with a law degree", tier: 2 }, { t: "with my mother's number", tier: 2 }, { t: "with a memory like a ledger", tier: 2 }, { t: "in a trench coat, stacked", tier: 2 },
      ] },
    ],
    grow: ["c"],
  },
  me: {
    noun: true, article: true,
    parts: [
      { k: "q", name: "quality", opt: true, odds: 0.5, frame: "a ___ lighthouse keeper", hint: "Describes you. An adjective.", pool: [
        { t: "retired", tier: 0 }, { t: "recently divorced", tier: 0 }, { t: "semi-retired", tier: 0 }, { t: "tall", tier: 0 }, { t: "part-time", tier: 0 },
        { t: "newly single", tier: 0 }, { t: "single", tier: 0 }, { t: "sober", tier: 0 }, { t: "sincere", tier: 0 },
        { t: "very online", tier: 1 }, { t: "formerly famous", tier: 1 }, { t: "emotionally available", tier: 1 }, { t: "overqualified", tier: 1 },
        { t: "allegedly immortal", tier: 2 }, { t: "twice-knighted", tier: 2 }, { t: "unlicensed", tier: 2 },
      ] },
      { k: "n", name: "job", frame: "a ___", hint: "What you do, or what you are.", pool: [
        { t: "dental hygienist", tier: 0 }, { t: "notary public", tier: 0 }, { t: "beekeeper", tier: 0 }, { t: "substitute teacher", tier: 0 },
        { t: "middle school band director", tier: 0 }, { t: "tax attorney", tier: 0 }, { t: "park ranger", tier: 0 }, { t: "sommelier", tier: 0 },
        { t: "wedding DJ", tier: 0 }, { t: "local weatherman", tier: 0 }, { t: "nurse", tier: 0 }, { t: "librarian", tier: 0 }, { t: "accountant", tier: 0 },
        { t: "surgeon", tier: 0 }, { t: "sailor", tier: 0 }, { t: "scientist", tier: 0 }, { t: "dog walker", tier: 0 },
        { t: "lighthouse keeper", tier: 1 }, { t: "former child actor", tier: 1 }, { t: "professional mourner", tier: 1 }, { t: "competitive eater", tier: 1 },
        { t: "mall Santa", tier: 1 }, { t: "hand model", tier: 1 }, { t: "ghost hunter", tier: 1 }, { t: "Renaissance faire blacksmith", tier: 1 }, { t: "mime", tier: 1 },
        { t: "minor wizard", tier: 2 }, { t: "pirate", tier: 2 }, { t: "time traveler from 1987", tier: 2 }, { t: "duke", tier: 2 }, { t: "ghost", tier: 2 },
      ] },
      { k: "c", name: "clause", opt: true, odds: 0.35, trailing: true, frame: "a lighthouse keeper ___", hint: "Trails what you are: “with a boat”.", pool: [
        { t: "with a boat", tier: 0 }, { t: "with two cats", tier: 0 }, { t: "with a minivan", tier: 0 },
        { t: "with two cats and a grudge", tier: 1 }, { t: "with a timeshare in Branson", tier: 1 }, { t: "between boats", tier: 1 },
        { t: "with a past", tier: 1 }, { t: "who has seen things", tier: 1 },
        { t: "with a second, smaller boat inside the first boat", tier: 2 }, { t: "with no further questions", tier: 2 }, { t: "with a restraining order against the sea", tier: 2 },
      ] },
    ],
    grow: ["q", "c"],
  },
  seek: {
    noun: true,
    parts: [
      { k: "n", name: "who you want", frame: "seeks ___", hint: "Who you're looking for, with its own “a” or “someone”.", pool: [
        { t: "someone who can parallel park", tier: 0 }, { t: "someone kind", tier: 0 }, { t: "a hiking buddy", tier: 0 },
        { t: "someone to split appetizers with", tier: 0 }, { t: "a person who reads the instructions", tier: 0 }, { t: "someone with a car", tier: 0 },
        { t: "someone sweet", tier: 0 }, { t: "someone sane", tier: 0 }, { t: "someone smart", tier: 0 }, { t: "a guy with a car", tier: 0 }, { t: "a big spoon", tier: 0 },
        { t: "someone to argue with about soup", tier: 1 }, { t: "a plus-one for my cousin's third wedding", tier: 1 }, { t: "a tall person, for shelf reasons", tier: 1 },
        { t: "a partner in crime, small crimes only", tier: 1 }, { t: "someone who gets along with geese", tier: 1 }, { t: "a pen pal with a boat", tier: 1 },
        { t: "a second-in-command", tier: 1 }, { t: "a dance partner for one very specific dance", tier: 1 }, { t: "a co-pilot", tier: 1 },
        { t: "a co-defendant", tier: 2 }, { t: "someone to inherit my lighthouse", tier: 2 }, { t: "a witness", tier: 2 }, { t: "an heir", tier: 2 },
        { t: "someone to haunt this house with", tier: 2 }, { t: "a getaway driver", tier: 2 },
      ] },
      { k: "c", name: "clause", opt: true, odds: 0.3, trailing: true, frame: "someone kind ___", hint: "Trails who you want: “with references”.", pool: [
        { t: "for long walks and short conversations", tier: 0 }, { t: "who likes dogs", tier: 0 },
        { t: "to grow old and suspicious with", tier: 1 }, { t: "who isn't a mime", tier: 1 }, { t: "with references", tier: 1 },
        { t: "for tax reasons", tier: 2 }, { t: "who won't ask about the basement", tier: 2 },
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
