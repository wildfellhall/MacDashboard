import type { Note } from "../types";

export type VocabularySource =
  "diagnostic" | "word-of-day" | "practice" | "lookup";
export type VocabularyStatus = "learning" | "familiar" | "mastered";

export type VocabularyWord = {
  id: string;
  word: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
  plainDefinition: string;
  example: string;
  etymology: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  synonyms: string[];
  distractors: string[];
};

export type VocabularyEncounter = {
  wordId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  sources: VocabularySource[];
  status: VocabularyStatus;
  attempts: number;
  correct: number;
  taughtAt?: string;
};

export type VocabularyDiagnostic = {
  completedAt: string;
  correct: number;
  total: number;
  band: number;
  label: string;
};

export type VocabularyProgress = {
  version: 1;
  diagnostic: VocabularyDiagnostic | null;
  encounters: VocabularyEncounter[];
  practiceStreak: number;
  lastPracticeAt: string | null;
  answeredQuestionIds?: string[];
};

export type VocabularyQuestionKind =
  "definition" | "context" | "synonym" | "usage";

export type VocabularyQuestion = {
  id: string;
  wordId: string;
  kind: VocabularyQuestionKind;
  label: string;
  prompt: string;
  choices: string[];
  correct: string;
  context?: string;
};

export const VOCABULARY_JOURNAL_ID = "vocabulary-journal";

export const VOCABULARY_WORDS: VocabularyWord[] = [
  {
    id: "quotidian",
    word: "quotidian",
    pronunciation: "/kwoh-TID-ee-uhn/",
    partOfSpeech: "adjective",
    definition: "Occurring every day; ordinary or commonplace.",
    plainDefinition: "Everyday and unremarkable.",
    example:
      "Her essays find quiet drama in the quotidian rituals of breakfast and commuting.",
    etymology: "Latin quotidianus, from quot die, ‘how many days’ or ‘daily.’",
    difficulty: 1,
    synonyms: ["daily", "ordinary", "routine"],
    distractors: [
      "Lasting for only an instant.",
      "Excessively ornate or showy.",
      "Spoken with deliberate secrecy.",
    ],
  },
  {
    id: "laconic",
    word: "laconic",
    pronunciation: "/luh-KON-ik/",
    partOfSpeech: "adjective",
    definition: "Using very few words, often to striking effect.",
    plainDefinition: "Brief and sparing with words.",
    example:
      "His laconic reply—‘Perhaps’—ended the debate more effectively than a speech.",
    etymology:
      "From Laconia, the region of ancient Sparta, whose people were famed for brevity.",
    difficulty: 1,
    synonyms: ["terse", "succinct", "pithy"],
    distractors: [
      "Given to extravagant praise.",
      "Unable to make a decision.",
      "Concerned with laws and courts.",
    ],
  },
  {
    id: "pellucid",
    word: "pellucid",
    pronunciation: "/puh-LOO-sid/",
    partOfSpeech: "adjective",
    definition: "Translucently clear; or clear in style and meaning.",
    plainDefinition: "Crystal clear, literally or figuratively.",
    example:
      "The lecturer made a difficult argument pellucid without making it simplistic.",
    etymology: "Latin pellucidus, ‘shining through.’",
    difficulty: 2,
    synonyms: ["limpid", "lucid", "transparent"],
    distractors: [
      "Dull from overuse.",
      "Full of hidden resentment.",
      "Likely to cause laughter.",
    ],
  },
  {
    id: "redolent",
    word: "redolent",
    pronunciation: "/RED-uh-luhnt/",
    partOfSpeech: "adjective",
    definition: "Strongly reminiscent or suggestive of something; fragrant.",
    plainDefinition: "Evocative of something, often through scent.",
    example:
      "The old library was redolent of cedar, dust, and long afternoons.",
    etymology: "Latin redolere, ‘to emit a scent.’",
    difficulty: 2,
    synonyms: ["evocative", "suggestive", "fragrant"],
    distractors: [
      "Difficult to bend or reshape.",
      "Unconcerned with consequences.",
      "Arranged in chronological order.",
    ],
  },
  {
    id: "liminal",
    word: "liminal",
    pronunciation: "/LIM-uh-nuhl/",
    partOfSpeech: "adjective",
    definition: "Occupying a threshold or transitional state.",
    plainDefinition: "Between one state, place, or stage and another.",
    example:
      "The empty station at dawn had a liminal hush, poised between night and day.",
    etymology: "Latin limen, ‘threshold.’",
    difficulty: 2,
    synonyms: ["transitional", "threshold", "in-between"],
    distractors: [
      "Concerned only with practical results.",
      "Too small to be measured.",
      "Marked by noisy celebration.",
    ],
  },
  {
    id: "apricity",
    word: "apricity",
    pronunciation: "/uh-PRIS-uh-tee/",
    partOfSpeech: "noun",
    definition: "The warmth of the sun in winter.",
    plainDefinition: "Winter sunlight felt as warmth.",
    example:
      "They lingered on the cold terrace to enjoy the afternoon apricity.",
    etymology: "Latin apricitas, ‘warmth of the sun.’",
    difficulty: 3,
    synonyms: ["winter sun", "sun-warmth"],
    distractors: [
      "The scent released by rain on dry ground.",
      "A fear of open spaces.",
      "The first light visible before dawn.",
    ],
  },
  {
    id: "susurrus",
    word: "susurrus",
    pronunciation: "/soo-SUR-uhs/",
    partOfSpeech: "noun",
    definition: "A whispering, murmuring, or rustling sound.",
    plainDefinition: "A soft continuous whisper or rustle.",
    example: "The susurrus of leaves followed them along the evening path.",
    etymology: "Latin susurrus, ‘a whisper or murmur.’",
    difficulty: 3,
    synonyms: ["murmur", "rustle", "whisper"],
    distractors: [
      "A sudden burst of bright light.",
      "A formal objection in a debate.",
      "A narrow passage through mountains.",
    ],
  },
  {
    id: "aporia",
    word: "aporia",
    pronunciation: "/uh-POR-ee-uh/",
    partOfSpeech: "noun",
    definition:
      "A state of puzzlement or an irresolvable impasse in reasoning.",
    plainDefinition: "A thoughtful state of doubt or logical difficulty.",
    example:
      "The novel ends in aporia, refusing to settle which memory is true.",
    etymology: "Greek aporos, ‘without passage’ or ‘at a loss.’",
    difficulty: 3,
    synonyms: ["perplexity", "impasse", "doubt"],
    distractors: [
      "An enthusiastic public celebration.",
      "A concise moral saying.",
      "An aversion to unfamiliar food.",
    ],
  },
  {
    id: "inchoate",
    word: "inchoate",
    pronunciation: "/in-KOH-it/",
    partOfSpeech: "adjective",
    definition: "Only partly formed or developed; rudimentary.",
    plainDefinition: "Just beginning and not yet fully formed.",
    example: "An inchoate idea for a story hovered at the edge of her notes.",
    etymology: "Latin inchoare, ‘to begin.’",
    difficulty: 3,
    synonyms: ["embryonic", "undeveloped", "nascent"],
    distractors: [
      "Perfectly balanced in form.",
      "Repeated at regular intervals.",
      "Deliberately insulting or rude.",
    ],
  },
  {
    id: "palimpsest",
    word: "palimpsest",
    pronunciation: "/PAL-imp-sest/",
    partOfSpeech: "noun",
    definition:
      "Something reused or altered while still bearing visible traces of its earlier form.",
    plainDefinition:
      "A layered thing whose earlier versions still show through.",
    example:
      "The city is a palimpsest of medieval lanes, factories, and glass towers.",
    etymology:
      "Greek palimpsestos, ‘scraped again,’ for manuscripts written over erased text.",
    difficulty: 3,
    synonyms: ["layered record", "overwritten text"],
    distractors: [
      "A person who collects maps.",
      "A ceremonial farewell speech.",
      "A problem with exactly two solutions.",
    ],
  },
  {
    id: "synecdoche",
    word: "synecdoche",
    pronunciation: "/si-NEK-duh-kee/",
    partOfSpeech: "noun",
    definition:
      "A figure of speech in which a part represents the whole, or the whole a part.",
    plainDefinition:
      "Using a part to stand for a whole, as in ‘hands’ for workers.",
    example: "Calling a car ‘wheels’ is a familiar synecdoche.",
    etymology: "Greek synekdochē, ‘simultaneous understanding.’",
    difficulty: 4,
    synonyms: ["figure of speech", "metonymic substitution"],
    distractors: [
      "A contradiction that reveals a truth.",
      "A word that imitates a sound.",
      "A comparison using ‘like’ or ‘as.’",
    ],
  },
  {
    id: "numinous",
    word: "numinous",
    pronunciation: "/NOO-muh-nuhs/",
    partOfSpeech: "adjective",
    definition: "Having a mysterious, spiritual presence that inspires awe.",
    plainDefinition: "Mysteriously sacred or awe-inspiring.",
    example:
      "The darkened chapel possessed a numinous stillness even for nonbelievers.",
    etymology: "Latin numen, ‘divine will or presence.’",
    difficulty: 4,
    synonyms: ["mystical", "sacred", "awe-inspiring"],
    distractors: [
      "Expressed through exact numbers.",
      "So familiar as to be comforting.",
      "Quick to notice small mistakes.",
    ],
  },
  {
    id: "perspicacious",
    word: "perspicacious",
    pronunciation: "/pur-spi-KAY-shuhs/",
    partOfSpeech: "adjective",
    definition:
      "Having a ready insight into things; perceptive and discerning.",
    plainDefinition: "Exceptionally perceptive.",
    example:
      "Her perspicacious questions exposed the assumption beneath the proposal.",
    etymology: "Latin perspicax, ‘seeing clearly.’",
    difficulty: 4,
    synonyms: ["discerning", "astute", "perceptive"],
    distractors: [
      "Prone to forgetting names.",
      "Overly concerned with appearances.",
      "Unable to remain still.",
    ],
  },
  {
    id: "rebarbative",
    word: "rebarbative",
    pronunciation: "/ree-BAR-buh-tiv/",
    partOfSpeech: "adjective",
    definition: "Unattractive, objectionable, or difficult to deal with.",
    plainDefinition: "Off-putting or forbiddingly unpleasant.",
    example:
      "The subject was fascinating, despite the book’s rebarbative prose.",
    etymology:
      "French rébarbatif, from barbe, ‘beard,’ suggesting bristling resistance.",
    difficulty: 4,
    synonyms: ["repellent", "forbidding", "off-putting"],
    distractors: [
      "Able to recover quickly from illness.",
      "Worthy of being remembered.",
      "Carefully arranged in rows.",
    ],
  },
  {
    id: "chiaroscuro",
    word: "chiaroscuro",
    pronunciation: "/kee-ar-uh-SKYOOR-oh/",
    partOfSpeech: "noun",
    definition:
      "The treatment or strong contrast of light and shade in art or composition.",
    plainDefinition: "Dramatic contrast between light and dark.",
    example:
      "The portrait’s chiaroscuro gives the face a sculptural intensity.",
    etymology: "Italian chiaro, ‘clear or light,’ plus oscuro, ‘dark.’",
    difficulty: 4,
    synonyms: ["light-dark contrast", "shading"],
    distractors: [
      "A rapid series of musical notes.",
      "A decorative border in a manuscript.",
      "A painting made entirely from memory.",
    ],
  },
  {
    id: "anfractuous",
    word: "anfractuous",
    pronunciation: "/an-FRAK-choo-uhs/",
    partOfSpeech: "adjective",
    definition: "Full of twists and turns; circuitous or intricate.",
    plainDefinition: "Winding, indirect, and complicated.",
    example:
      "They followed an anfractuous road through the hills to the coast.",
    etymology: "Latin anfractus, ‘a bending around.’",
    difficulty: 5,
    synonyms: ["sinuous", "circuitous", "tortuous"],
    distractors: [
      "Broken into equal fragments.",
      "Free from social restraint.",
      "Having a sharply pleasant taste.",
    ],
  },
  {
    id: "eleemosynary",
    word: "eleemosynary",
    pronunciation: "/el-uh-MOS-uh-nair-ee/",
    partOfSpeech: "adjective",
    definition: "Relating to charity, alms, or charitable donations.",
    plainDefinition: "Charitable or supported by charity.",
    example:
      "The trust began as an eleemosynary institution for local families.",
    etymology:
      "Medieval Latin eleemosynarius, from a Greek word for pity or alms.",
    difficulty: 5,
    synonyms: ["charitable", "philanthropic", "benevolent"],
    distractors: [
      "Dependent on personal testimony.",
      "Relating to formal ceremonies.",
      "Designed to improve memory.",
    ],
  },
  {
    id: "ultracrepidarian",
    word: "ultracrepidarian",
    pronunciation: "/ul-truh-krep-i-DAIR-ee-uhn/",
    partOfSpeech: "noun or adjective",
    definition:
      "A person who gives opinions beyond their expertise; or characteristic of such advice.",
    plainDefinition: "Speaking authoritatively outside one’s knowledge.",
    example:
      "The panel resisted ultracrepidarian claims and deferred to the engineers.",
    etymology:
      "Latin ultra crepidam, ‘beyond the sandal,’ from a warning to a critic who exceeded his field.",
    difficulty: 5,
    synonyms: ["presumptuous adviser", "know-it-all"],
    distractors: [
      "A walker who travels extremely long distances.",
      "A scholar of ancient inscriptions.",
      "Someone who avoids firm opinions.",
    ],
  },
  {
    id: "fugacious",
    word: "fugacious",
    pronunciation: "/fyoo-GAY-shuhs/",
    partOfSpeech: "adjective",
    definition: "Tending to disappear; fleeting or short-lived.",
    plainDefinition: "Brief and quick to vanish.",
    example: "The blossom’s fugacious beauty made the annual walk feel urgent.",
    etymology: "Latin fugax, ‘apt to flee.’",
    difficulty: 5,
    synonyms: ["fleeting", "evanescent", "transitory"],
    distractors: [
      "Inclined to argue over details.",
      "Producing abundant fruit.",
      "Hidden beneath the surface.",
    ],
  },
  {
    id: "desideratum",
    word: "desideratum",
    pronunciation: "/di-zid-uh-RAH-tuhm/",
    partOfSpeech: "noun",
    definition:
      "Something desired or considered necessary; a thing still lacking.",
    plainDefinition: "A needed or greatly wanted thing.",
    example:
      "A quiet public reading room remained the neighborhood’s chief desideratum.",
    etymology: "Latin desideratum, ‘something desired.’",
    difficulty: 5,
    synonyms: ["requirement", "need", "object of desire"],
    distractors: [
      "A final summary of an argument.",
      "An accidental discovery.",
      "A debt that cannot be repaid.",
    ],
  },
  {
    id: "taciturn",
    word: "taciturn",
    pronunciation: "/TAS-ih-turn/",
    partOfSpeech: "adjective",
    definition:
      "Reserved or uncommunicative in speech; inclined to say little.",
    plainDefinition: "Habitually quiet and sparing with words.",
    example:
      "Usually taciturn in meetings, he offered only a nod and one precise correction.",
    etymology: "Latin taciturnus, from tacitus, ‘silent.’",
    difficulty: 1,
    synonyms: ["reticent", "reserved", "uncommunicative"],
    distractors: [
      "Eager to please strangers.",
      "Unable to sit still.",
      "Careful about spending money.",
    ],
  },
  {
    id: "fastidious",
    word: "fastidious",
    pronunciation: "/fa-STID-ee-uhs/",
    partOfSpeech: "adjective",
    definition: "Very attentive to accuracy, detail, or cleanliness.",
    plainDefinition: "Exacting and highly attentive to detail.",
    example:
      "The conservator was fastidious about matching every pigment to the original fresco.",
    etymology: "Latin fastidiosus, from fastidium, ‘loathing or aversion.’",
    difficulty: 1,
    synonyms: ["meticulous", "scrupulous", "exacting"],
    distractors: [
      "Openly hostile to authority.",
      "Quick to change direction.",
      "Cheerful despite bad news.",
    ],
  },
  {
    id: "sanguine",
    word: "sanguine",
    pronunciation: "/SANG-gwin/",
    partOfSpeech: "adjective",
    definition: "Optimistic or positive, especially in a difficult situation.",
    plainDefinition: "Confidently optimistic.",
    example:
      "Despite the early setbacks, the director remained sanguine about opening on time.",
    etymology:
      "Old French sanguin, from Latin sanguis, ‘blood,’ once linked to an optimistic temperament.",
    difficulty: 2,
    synonyms: ["optimistic", "buoyant", "hopeful"],
    distractors: [
      "Deeply suspicious of praise.",
      "Bloodless or pale in color.",
      "Given to very long speeches.",
    ],
  },
  {
    id: "trenchant",
    word: "trenchant",
    pronunciation: "/TREN-chuhnt/",
    partOfSpeech: "adjective",
    definition: "Vigorous, incisive, and sharply effective in expression.",
    plainDefinition: "Sharp and forceful in thought or style.",
    example:
      "Her trenchant review exposed the argument’s central contradiction in two sentences.",
    etymology: "Old French trenchier, ‘to cut.’",
    difficulty: 2,
    synonyms: ["incisive", "penetrating", "sharp"],
    distractors: [
      "Softened by repeated handling.",
      "Unwilling to take sides.",
      "Related to deep ocean water.",
    ],
  },
  {
    id: "halcyon",
    word: "halcyon",
    pronunciation: "/HAL-see-uhn/",
    partOfSpeech: "adjective",
    definition: "Denoting an idyllically happy, calm, and peaceful period.",
    plainDefinition: "Peaceful and happy, often in remembered times.",
    example:
      "They spoke of the town’s halcyon summers before the highway arrived.",
    etymology:
      "Greek alkuōn, ‘kingfisher,’ a mythical bird said to calm the winter sea.",
    difficulty: 2,
    synonyms: ["idyllic", "serene", "golden"],
    distractors: [
      "Marked by reckless speed.",
      "Too ancient to date.",
      "Covered in a bluish haze.",
    ],
  },
  {
    id: "ineffable",
    word: "ineffable",
    pronunciation: "/in-EF-uh-buhl/",
    partOfSpeech: "adjective",
    definition: "Too great, extreme, or profound to be expressed in words.",
    plainDefinition: "Beyond adequate description.",
    example:
      "The final chord left an ineffable mixture of grief and wonder in the hall.",
    etymology:
      "Latin ineffabilis, from in-, ‘not,’ and effabilis, ‘utterable.’",
    difficulty: 2,
    synonyms: ["indescribable", "inexpressible", "unutterable"],
    distractors: [
      "Unable to be corrected.",
      "Easy to overlook.",
      "Forbidden by a written rule.",
    ],
  },
  {
    id: "mellifluous",
    word: "mellifluous",
    pronunciation: "/muh-LIF-loo-uhs/",
    partOfSpeech: "adjective",
    definition: "Sweet, smooth, or musical to hear.",
    plainDefinition: "Pleasantly flowing in sound.",
    example: "A mellifluous voice carried the poem to the back of the room.",
    etymology: "Latin mellifluus, from mel, ‘honey,’ and fluere, ‘to flow.’",
    difficulty: 3,
    synonyms: ["dulcet", "euphonious", "honeyed"],
    distractors: [
      "Sticky to the touch.",
      "Difficult to translate.",
      "Spoken without preparation.",
    ],
  },
  {
    id: "crepuscular",
    word: "crepuscular",
    pronunciation: "/kri-PUS-kyuh-lur/",
    partOfSpeech: "adjective",
    definition: "Relating to twilight; or active chiefly at dawn and dusk.",
    plainDefinition: "Of twilight, dawn, or dusk.",
    example:
      "The photographer waited for the crepuscular light to soften the empty street.",
    etymology: "Latin crepusculum, ‘twilight.’",
    difficulty: 3,
    synonyms: ["twilit", "dusky", "vespertine"],
    distractors: [
      "Hidden beneath thick foliage.",
      "Growing in circular patterns.",
      "Audible only at great distances.",
    ],
  },
  {
    id: "oneiric",
    word: "oneiric",
    pronunciation: "/oh-NY-rik/",
    partOfSpeech: "adjective",
    definition: "Relating to dreams or dreaming; dreamlike.",
    plainDefinition: "Dreamlike or connected with dreams.",
    example:
      "Mirrored corridors give the film an oneiric logic rather than a realistic one.",
    etymology: "Greek oneiros, ‘dream.’",
    difficulty: 3,
    synonyms: ["dreamlike", "visionary", "surreal"],
    distractors: [
      "Relating to a single ruler.",
      "Intended to provoke anger.",
      "Produced without artificial light.",
    ],
  },
  {
    id: "diaphanous",
    word: "diaphanous",
    pronunciation: "/dy-AF-uh-nuhs/",
    partOfSpeech: "adjective",
    definition: "Light, delicate, and translucent, especially of fabric.",
    plainDefinition: "Sheer and almost transparent.",
    example:
      "Diaphanous curtains stirred in the breeze and diffused the afternoon sun.",
    etymology: "Greek diaphanēs, from dia, ‘through,’ and phainein, ‘to show.’",
    difficulty: 3,
    synonyms: ["sheer", "gauzy", "translucent"],
    distractors: [
      "Heavy enough to resist wind.",
      "Made from several fused metals.",
      "Painfully bright and reflective.",
    ],
  },
  {
    id: "efflorescence",
    word: "efflorescence",
    pronunciation: "/ef-luh-RES-uhns/",
    partOfSpeech: "noun",
    definition:
      "A period or process of flowering, growth, or rich development.",
    plainDefinition: "A flourishing burst of growth or creativity.",
    example:
      "The decade brought an efflorescence of small presses and experimental magazines.",
    etymology: "Latin efflorescere, ‘to burst into bloom.’",
    difficulty: 4,
    synonyms: ["flowering", "flourishing", "unfolding"],
    distractors: [
      "A gradual loss of color.",
      "A formal refusal to cooperate.",
      "A copy made from a damaged original.",
    ],
  },
  {
    id: "quiddity",
    word: "quiddity",
    pronunciation: "/KWID-ih-tee/",
    partOfSpeech: "noun",
    definition:
      "The inherent nature or essential quality of a person or thing.",
    plainDefinition: "The essential whatness of something.",
    example:
      "The adaptation preserves the novel’s quiddity even while changing its plot.",
    etymology: "Medieval Latin quidditas, from Latin quid, ‘what.’",
    difficulty: 4,
    synonyms: ["essence", "nature", "whatness"],
    distractors: [
      "A trivial financial debt.",
      "An answer phrased as a question.",
      "A sudden change of loyalty.",
    ],
  },
  {
    id: "tenebrous",
    word: "tenebrous",
    pronunciation: "/TEN-uh-bruhs/",
    partOfSpeech: "adjective",
    definition: "Dark, shadowy, obscure, or difficult to understand.",
    plainDefinition: "Gloomily dark or obscure.",
    example:
      "A tenebrous stairwell descended beneath the otherwise cheerful house.",
    etymology: "Latin tenebrae, ‘darkness.’",
    difficulty: 4,
    synonyms: ["shadowy", "murky", "obscure"],
    distractors: [
      "Fragile despite appearing solid.",
      "Loudly argumentative.",
      "Divided into exactly ten parts.",
    ],
  },
  {
    id: "ratiocination",
    word: "ratiocination",
    pronunciation: "/rash-ee-os-uh-NAY-shuhn/",
    partOfSpeech: "noun",
    definition: "The process of exact, methodical, logical reasoning.",
    plainDefinition: "Careful reasoning by logic.",
    example:
      "The detective’s patient ratiocination mattered more than sudden inspiration.",
    etymology: "Latin ratiocinari, ‘to calculate or reason,’ from ratio.",
    difficulty: 4,
    synonyms: ["reasoning", "inference", "deduction"],
    distractors: [
      "A rapid numerical estimate.",
      "A speech intended to flatter.",
      "The classification of living things.",
    ],
  },
  {
    id: "sempiternal",
    word: "sempiternal",
    pronunciation: "/sem-pih-TUR-nuhl/",
    partOfSpeech: "adjective",
    definition: "Eternal, unchanging, or seemingly everlasting.",
    plainDefinition: "Everlasting and unending.",
    example:
      "The poem sets one brief summer against the sempiternal movement of the stars.",
    etymology:
      "Latin sempiternus, from semper, ‘always,’ and aeternus, ‘eternal.’",
    difficulty: 4,
    synonyms: ["everlasting", "perpetual", "endless"],
    distractors: [
      "Occurring twice each year.",
      "Half-finished but promising.",
      "Preserved only in memory.",
    ],
  },
  {
    id: "legerdemain",
    word: "legerdemain",
    pronunciation: "/lej-ur-duh-MAYN/",
    partOfSpeech: "noun",
    definition: "Skillful sleight of hand; or artful trickery and deception.",
    plainDefinition: "Dexterous trickery, literal or figurative.",
    example:
      "No amount of accounting legerdemain could hide the missing funds.",
    etymology: "French léger de main, ‘light of hand.’",
    difficulty: 5,
    synonyms: ["sleight of hand", "trickery", "chicanery"],
    distractors: [
      "A law written in plain language.",
      "A minor injury to the hand.",
      "A graceful form of greeting.",
    ],
  },
  {
    id: "opsimath",
    word: "opsimath",
    pronunciation: "/OP-sih-math/",
    partOfSpeech: "noun",
    definition: "A person who begins to learn or study late in life.",
    plainDefinition: "Someone who becomes a student later in life.",
    example: "A proud opsimath, she began studying astronomy after retirement.",
    etymology: "Greek opsimathēs, from opse, ‘late,’ and math-, ‘learn.’",
    difficulty: 5,
    synonyms: ["late learner", "mature student"],
    distractors: [
      "A specialist in visual illusions.",
      "One who refuses arithmetic.",
      "A historian of vanished schools.",
    ],
  },
  {
    id: "absquatulate",
    word: "absquatulate",
    pronunciation: "/ab-SKWAH-chuh-layt/",
    partOfSpeech: "verb",
    definition: "To leave abruptly or abscond, often humorously.",
    plainDefinition: "To depart suddenly.",
    example:
      "Before anyone could assign cleanup, the guests absquatulated through the side door.",
    etymology:
      "A playful 19th-century blend modeled on abscond, squat, and perambulate.",
    difficulty: 5,
    synonyms: ["abscond", "depart", "decamp"],
    distractors: [
      "To argue from a seated position.",
      "To compress into a small space.",
      "To estimate without evidence.",
    ],
  },
  {
    id: "contumelious",
    word: "contumelious",
    pronunciation: "/kon-too-MEE-lee-uhs/",
    partOfSpeech: "adjective",
    definition: "Scornfully insulting, insolent, or humiliating.",
    plainDefinition: "Arrogantly and contemptuously insulting.",
    example:
      "The contumelious dismissal wounded more deeply than a reasoned refusal would have.",
    etymology: "Latin contumelia, ‘abuse or insult.’",
    difficulty: 5,
    synonyms: ["insolent", "scornful", "derisive"],
    distractors: [
      "Eager to repair a friendship.",
      "Capable of being counted.",
      "Suitable for public celebration.",
    ],
  },
  {
    id: "zeugma",
    word: "zeugma",
    pronunciation: "/ZOOG-muh/",
    partOfSpeech: "noun",
    definition:
      "A figure of speech in which one word applies to two others in different senses.",
    plainDefinition: "One word yoked to two phrases in different meanings.",
    example:
      "In ‘she broke his car and his heart,’ the shared verb creates a zeugma.",
    etymology: "Greek zeugnunai, ‘to yoke.’",
    difficulty: 5,
    synonyms: ["figure of speech", "yoked construction"],
    distractors: [
      "A repeated consonant sound.",
      "A deliberate grammatical error.",
      "A story contained within another story.",
    ],
  },
];

export const DIAGNOSTIC_WORD_IDS = [
  "quotidian",
  "laconic",
  "pellucid",
  "liminal",
  "aporia",
  "synecdoche",
  "anfractuous",
  "eleemosynary",
] as const;

export const INITIAL_VOCABULARY_PROGRESS: VocabularyProgress = {
  version: 1,
  diagnostic: null,
  encounters: [],
  practiceStreak: 0,
  lastPracticeAt: null,
  answeredQuestionIds: [],
};

export const vocabularyWord = (id: string) =>
  VOCABULARY_WORDS.find((candidate) => candidate.id === id);

export const diagnosticResult = (
  correct: number,
  total: number = DIAGNOSTIC_WORD_IDS.length,
): Omit<VocabularyDiagnostic, "completedAt"> => {
  const ratio = total > 0 ? correct / total : 0;
  if (ratio <= 0.25) return { correct, total, band: 1, label: "Word Curious" };
  if (ratio <= 0.5)
    return { correct, total, band: 2, label: "Attentive Reader" };
  if (ratio <= 0.7)
    return { correct, total, band: 3, label: "Lexical Explorer" };
  if (ratio < 1)
    return { correct, total, band: 4, label: "Formidable Wordsmith" };
  return { correct, total, band: 5, label: "Rare-Word Savant" };
};

const statusRank: Record<VocabularyStatus, number> = {
  learning: 0,
  familiar: 1,
  mastered: 2,
};

export const recordVocabularyEncounter = (
  progress: VocabularyProgress,
  wordId: string,
  source: VocabularySource,
  options: {
    correct?: boolean;
    status?: VocabularyStatus;
    taught?: boolean;
    at?: string;
  } = {},
): VocabularyProgress => {
  const at = options.at ?? new Date().toISOString();
  const existing = progress.encounters.find((item) => item.wordId === wordId);
  const inferredStatus: VocabularyStatus =
    options.status ?? (options.correct ? "familiar" : "learning");
  const nextStatus =
    existing && statusRank[existing.status] > statusRank[inferredStatus]
      ? existing.status
      : inferredStatus;
  const next: VocabularyEncounter = existing
    ? {
        ...existing,
        lastSeenAt: at,
        sources: existing.sources.includes(source)
          ? existing.sources
          : [...existing.sources, source],
        status: nextStatus,
        attempts:
          existing.attempts + (typeof options.correct === "boolean" ? 1 : 0),
        correct: existing.correct + (options.correct ? 1 : 0),
        taughtAt: options.taught ? at : existing.taughtAt,
      }
    : {
        wordId,
        firstSeenAt: at,
        lastSeenAt: at,
        sources: [source],
        status: inferredStatus,
        attempts: typeof options.correct === "boolean" ? 1 : 0,
        correct: options.correct ? 1 : 0,
        taughtAt: options.taught ? at : undefined,
      };

  return {
    ...progress,
    encounters: existing
      ? progress.encounters.map((item) =>
          item.wordId === wordId ? next : item,
        )
      : [...progress.encounters, next],
  };
};

export const practiceNeedsIntroduction = (
  progress: VocabularyProgress,
  wordId: string,
) => {
  const encounter = progress.encounters.find((item) => item.wordId === wordId);
  return (
    !encounter ||
    (encounter.status === "learning" &&
      encounter.taughtAt === undefined &&
      !encounter.sources.includes("word-of-day") &&
      !encounter.sources.includes("lookup"))
  );
};

const dayNumber = (date: Date) =>
  Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );

export const wordOfTheDay = (
  date: Date,
  progress: VocabularyProgress,
): VocabularyWord => {
  const band = progress.diagnostic?.band ?? 2;
  const lower = Math.max(2, band - 1);
  const upper = Math.min(5, band + 1);
  const pool = VOCABULARY_WORDS.filter(
    (word) => word.difficulty >= lower && word.difficulty <= upper,
  );
  return pool[dayNumber(date) % pool.length] ?? VOCABULARY_WORDS[0];
};

export const nextPracticeWord = (
  progress: VocabularyProgress,
  offset = 0,
): VocabularyWord => {
  const ranked = rankedPracticeWords(progress);
  return ranked[offset % ranked.length] ?? VOCABULARY_WORDS[0];
};

const rankedPracticeWords = (
  progress: VocabularyProgress,
): VocabularyWord[] => {
  const target = progress.diagnostic?.band ?? 2;
  const encounters = new Map(
    progress.encounters.map((item) => [item.wordId, item]),
  );
  return [...VOCABULARY_WORDS].sort((left, right) => {
    const leftEncounter = encounters.get(left.id);
    const rightEncounter = encounters.get(right.id);
    const learningPriority = (encounter?: VocabularyEncounter) => {
      if (
        encounter?.status === "learning" &&
        encounter.sources.includes("diagnostic")
      ) {
        return -2;
      }
      return encounter ? statusRank[encounter.status] : -1;
    };
    const leftMastery = learningPriority(leftEncounter);
    const rightMastery = learningPriority(rightEncounter);
    if (leftMastery !== rightMastery) return leftMastery - rightMastery;
    const leftDistance = Math.abs(left.difficulty - target);
    const rightDistance = Math.abs(right.difficulty - target);
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    return left.word.localeCompare(right.word);
  });
};

export const definitionOptions = (word: VocabularyWord) => {
  const options = [word.definition, ...word.distractors];
  const shift = word.word.length % options.length;
  return [...options.slice(shift), ...options.slice(0, shift)];
};

export const VOCABULARY_QUESTION_KINDS: VocabularyQuestionKind[] = [
  "definition",
  "context",
  "synonym",
  "usage",
];

const rotate = <T>(values: T[], seed: number) => {
  if (values.length === 0) return values;
  const shift = seed % values.length;
  return [...values.slice(shift), ...values.slice(0, shift)];
};

const nearbyWords = (word: VocabularyWord) => {
  const peers = VOCABULARY_WORDS.filter(
    (candidate) =>
      candidate.id !== word.id &&
      Math.abs(candidate.difficulty - word.difficulty) <= 1,
  );
  return rotate(peers, word.word.length).slice(0, 3);
};

const contextOptions = (word: VocabularyWord) =>
  rotate(
    [word.word, ...nearbyWords(word).map((candidate) => candidate.word)],
    word.id.length,
  );

const synonymOptions = (word: VocabularyWord) => {
  const correct = word.synonyms[0] ?? word.plainDefinition;
  const distractors = nearbyWords(word).map(
    (candidate) => candidate.synonyms[0] ?? candidate.word,
  );
  return rotate([correct, ...distractors], word.word.length + 1);
};

const escapedRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const usageOptions = (word: VocabularyWord) => {
  const distractors = nearbyWords(word).map((candidate) => {
    const pattern = new RegExp(escapedRegExp(candidate.word), "i");
    return pattern.test(candidate.example)
      ? candidate.example.replace(pattern, word.word)
      : `The scene felt ${word.word}, meaning ${candidate.plainDefinition.toLowerCase()}`;
  });
  return rotate([word.example, ...distractors], word.word.length + 2);
};

export const vocabularyQuestionsForWord = (
  word: VocabularyWord,
): VocabularyQuestion[] => {
  const synonym = word.synonyms[0] ?? word.plainDefinition;
  const context = word.example.replace(
    new RegExp(escapedRegExp(word.word), "i"),
    "__________",
  );
  const contextLead = context.split(/\s+/).slice(0, 6).join(" ");
  return [
    {
      id: `${word.id}:definition`,
      wordId: word.id,
      kind: "definition",
      label: "Meaning",
      prompt: `What does “${word.word}” mean?`,
      choices: definitionOptions(word),
      correct: word.definition,
    },
    {
      id: `${word.id}:context`,
      wordId: word.id,
      kind: "context",
      label: "In context",
      prompt: `Complete the sentence beginning “${contextLead}…”`,
      context,
      choices: contextOptions(word),
      correct: word.word,
    },
    {
      id: `${word.id}:synonym`,
      wordId: word.id,
      kind: "synonym",
      label: "Synonym",
      prompt: `Which word is closest in meaning to “${word.word}”?`,
      choices: synonymOptions(word),
      correct: synonym,
    },
    {
      id: `${word.id}:usage`,
      wordId: word.id,
      kind: "usage",
      label: "Usage",
      prompt: `Which sentence uses “${word.word}” correctly?`,
      choices: usageOptions(word),
      correct: word.example,
    },
  ];
};

export const VOCABULARY_QUESTIONS = VOCABULARY_WORDS.flatMap(
  vocabularyQuestionsForWord,
);

export const completedVocabularyQuestionIds = (
  progress: VocabularyProgress,
) => {
  if (progress.answeredQuestionIds !== undefined) {
    return [...new Set(progress.answeredQuestionIds)];
  }
  return progress.encounters.flatMap((encounter) =>
    encounter.sources.includes("practice")
      ? VOCABULARY_QUESTION_KINDS.slice(0, encounter.attempts).map(
          (kind) => `${encounter.wordId}:${kind}`,
        )
      : [],
  );
};

export const recordVocabularyQuestionAnswer = (
  progress: VocabularyProgress,
  questionId: string,
) => ({
  ...progress,
  answeredQuestionIds: [
    ...new Set([...completedVocabularyQuestionIds(progress), questionId]),
  ],
});

export const recordVocabularyWordKnown = (
  progress: VocabularyProgress,
  wordId: string,
) => ({
  ...progress,
  answeredQuestionIds: [
    ...new Set([
      ...completedVocabularyQuestionIds(progress),
      ...VOCABULARY_QUESTION_KINDS.map((kind) => `${wordId}:${kind}`),
    ]),
  ],
});

export const nextVocabularyQuestion = (
  progress: VocabularyProgress,
): VocabularyQuestion | undefined => {
  const completed = new Set(completedVocabularyQuestionIds(progress));
  const lastQuestionId = completedVocabularyQuestionIds(progress).at(-1);
  const lastWordId = lastQuestionId?.split(":")[0];
  const words = rankedPracticeWords(progress);
  const orderedWords = [
    ...words.filter((word) => word.id !== lastWordId),
    ...words.filter((word) => word.id === lastWordId),
  ];
  const kindOffset = completed.size % VOCABULARY_QUESTION_KINDS.length;
  const orderedKinds = rotate(VOCABULARY_QUESTION_KINDS, kindOffset);

  for (const word of orderedWords) {
    const questions = vocabularyQuestionsForWord(word);
    const next = orderedKinds
      .map((kind) => questions.find((question) => question.kind === kind))
      .find((question) => question && !completed.has(question.id));
    if (next) return next;
  }
  return undefined;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const journalSourceLabel = (sources: VocabularySource[]) =>
  sources
    .map((source) =>
      source === "word-of-day"
        ? "Word of the Day"
        : source === "lookup"
          ? "Dictionary lookup"
          : source.charAt(0).toUpperCase() + source.slice(1),
    )
    .join(", ");

export const buildVocabularyJournalNote = (
  progress: VocabularyProgress,
): Note => {
  const encounters = [...progress.encounters].sort((left, right) =>
    right.lastSeenAt.localeCompare(left.lastSeenAt),
  );
  const diagnostic = progress.diagnostic;
  const wordSections = encounters
    .map((encounter) => {
      const word = vocabularyWord(encounter.wordId);
      if (!word) return "";
      return `<h2>${escapeHtml(word.word)}</h2><p><strong>${escapeHtml(word.partOfSpeech)}</strong> · ${escapeHtml(word.pronunciation)} · ${escapeHtml(encounter.status)}</p><p>${escapeHtml(word.definition)}</p><blockquote>${escapeHtml(word.example)}</blockquote><p><strong>Encountered in:</strong> ${escapeHtml(journalSourceLabel(encounter.sources))}</p>`;
    })
    .join("");

  return {
    id: VOCABULARY_JOURNAL_ID,
    title: "Vocabulary Journal",
    folder: "Personal",
    updatedAt:
      encounters[0]?.lastSeenAt ??
      diagnostic?.completedAt ??
      new Date().toISOString(),
    content: `<h1>Vocabulary Journal</h1><p><em>Automatically maintained by Dictionary.</em> Every word you encounter or practise is recorded here so it can inform future conversations and recommendations.</p>${
      diagnostic
        ? `<h2>Your starting point</h2><p><strong>${escapeHtml(diagnostic.label)}</strong> · ${diagnostic.correct} of ${diagnostic.total} diagnostic words known · band ${diagnostic.band} of 5</p>`
        : ""
    }<h2>Words encountered</h2>${wordSections || "<p>Your first word will appear here.</p>"}`,
  };
};
