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
