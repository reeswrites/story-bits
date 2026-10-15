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
        { det: "the", t: "mountain", tier: 0, tags: ["land"] }, { det: "the", t: "snow", tier: 0, tags: ["sky"] }, { det: "a", t: "snake", tier: 0, tags: ["beasts"] }, { det: "the", t: "stars", tier: 0, tags: ["sky"], retired: true }, { det: "a", t: "wolf", tier: 0, tags: ["beasts"] }, { det: "a", t: "hawk", tier: 0, tags: ["beasts"] }, { det: "a", t: "snail", tier: 0, tags: ["beasts"] },
        { det: "the", t: "first winter", tier: 1, tags: ["sky"] }, { det: "the", t: "king of the frogs", tier: 1, tags: ["beasts"] }, { det: "a", t: "duck with a grudge", tier: 1, tags: ["beasts"] },
        { det: "a", t: "man selling umbrellas", tier: 1, tags: ["folk"] }, { det: "the", t: "last dinosaur", tier: 1, tags: ["beasts"] }, { det: "the", t: "village gossip", tier: 1, tags: ["folk"] },
        { det: "the", t: "Postmaster of the Forest", tier: 2, tags: ["office"] }, { det: "the", t: "night's accountant", tier: 2, tags: ["office"] }, { det: "the", t: "Department of Weather", tier: 2, tags: ["office", "sky"] },
        { det: "a", t: "very small god", tier: 2, tags: ["myth"] }, { det: "the", t: "concept of Thursday", tier: 2, tags: ["myth"] },
        { det: "the", t: "forest", tier: 0, tags: ["land"] }, { det: "the", t: "longest night", tier: 1, tags: ["sky"] },
        // "the stars" is retired: every rival line reads it as one ("the stars still sends a card").
        { det: "the", t: "North Star", tier: 0, tags: ["sky"] },
      ] },
      { k: "c", name: "clause", opt: true, odds: 0.3, trailing: true, frame: "the river ___", hint: "Trails the rival: “that never forgets”. “That” suits a river or a fox as well as a person.", pool: [
        { t: "that never forgets", tier: 0, tags: ["grudge"] }, { t: "that was in a mood", tier: 0, tags: ["grudge", "state"] }, { t: "that had been drinking", tier: 1, tags: ["state"] },
        { t: "that kept a list", tier: 1, tags: ["grudge"] }, { t: "with one eye open", tier: 1, tags: ["state"] }, { t: "that was secretly {who}", tier: 2, tags: ["guise"] }, { t: "in a little hat", tier: 2, tags: ["guise"] },
        { t: "that had just woken up", tier: 0, tags: ["state"] }, { t: "that was owed money", tier: 1, tags: ["grudge"] },
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
