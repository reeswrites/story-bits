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
        { t: "question", tier: 1, tags: ["word"] }, { t: "silence", tier: 1, tags: ["word"] }, { t: "apology", tier: 1, tags: ["word"] }, { t: "hallway", tier: 1, tags: ["house"] }, { t: "weather", tier: 1, mass: true, tags: ["sky"] },
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
