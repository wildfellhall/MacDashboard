import type { Note } from "../types";

export type RelevantNoteExcerpt = {
  id: string;
  title: string;
  folder: Note["folder"];
  excerpt: string;
  matchedTerms: string[];
};

export type MentionedRecommendationTerms = {
  positive: string[];
  negative: string[];
};

const STOP_WORDS = new Set([
  "a",
  "about",
  "all",
  "also",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "because",
  "but",
  "by",
  "can",
  "could",
  "do",
  "for",
  "from",
  "give",
  "help",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "note",
  "notes",
  "of",
  "on",
  "or",
  "please",
  "recommend",
  "recommendation",
  "should",
  "some",
  "that",
  "the",
  "this",
  "to",
  "use",
  "want",
  "what",
  "when",
  "which",
  "with",
  "would",
  "you",
]);

const EXPANSION_GROUPS = [
  [
    "book",
    "books",
    "author",
    "authors",
    "novel",
    "novels",
    "read",
    "reading",
    "literature",
  ],
  [
    "tv",
    "television",
    "show",
    "shows",
    "series",
    "movie",
    "movies",
    "film",
    "films",
    "watch",
    "watching",
  ],
  [
    "photo",
    "photos",
    "photography",
    "image",
    "images",
    "picture",
    "pictures",
    "visual",
    "visuals",
    "aesthetic",
    "art",
  ],
  [
    "favorite",
    "favorites",
    "favourite",
    "favourites",
    "like",
    "likes",
    "love",
    "loves",
    "interest",
    "interests",
    "preference",
    "preferences",
    "taste",
  ],
] as const;

const TASTE_INTENT =
  /\b(?:recommend|suggest|favorite|favourite|prefer|preference|taste|interest|like|love|avoid|dislike|read next|watch next|what should i (?:read|watch))\b/i;
const TASTE_NOTE =
  /\b(?:favorite|favourite|prefer|preference|taste|interest|inspiration|love|liked|avoid|dislike|watchlist|reading list|read next|to watch|to read|reviews?)\b/i;
const REVIEW_INTENT =
  /\b(?:books?|authors?|novels?|read(?:ing)?|tv|television|shows?|series|movies?|films?|watch(?:ing)?)\b/i;
const POSITIVE_CONTEXT =
  /\b(?:favorite|favourite|love|loved|like|liked|enjoy|enjoyed|adore|prefer|preferred|drawn to|obsessed with|interest|inspiration|watchlist|reading list|read next|to watch|to read|recommend)\b/i;
const NEGATIVE_CONTEXT =
  /\b(?:avoid|dislike|disliked|hate|hated|not for me|do not like|don['’]t like|cannot stand|can['’]t stand|skip)\b/i;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const stem = (value: string) => {
  const token = normalize(value).replace(/^['-]+|['-]+$/g, "");
  if (token.length > 5 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
};

const tokens = (value: string) =>
  normalize(value)
    .split(/\s+/)
    .map(stem)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

const queryTokens = (query: string) => {
  const expanded = new Set(tokens(query));
  for (const group of EXPANSION_GROUPS) {
    if (group.some((term) => expanded.has(stem(term)))) {
      group.forEach((term) => expanded.add(stem(term)));
    }
  }
  return expanded;
};

const blockText = (element: Element) => {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll("br").forEach((breakElement) => {
    breakElement.replaceWith(document.createTextNode("\n"));
  });
  return (clone.textContent ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const notePassages = (note: Note) => {
  const document = new DOMParser().parseFromString(note.content, "text/html");
  const passages = [
    ...document.body.querySelectorAll("h1, h2, h3, p, li, blockquote"),
  ]
    .filter((element) => !(element.tagName === "P" && element.closest("li")))
    .map(blockText)
    .filter(Boolean);
  return [...new Set(passages)].slice(0, 120);
};

const containsPhrase = (text: string, phrase: string) => {
  const normalizedText = ` ${normalize(text)} `;
  const normalizedPhrase = normalize(phrase);
  return (
    normalizedPhrase.length >= 3 &&
    normalizedText.includes(` ${normalizedPhrase} `)
  );
};

export const findMentionedRecommendationTerms = (
  notes: Note[],
  candidateTerms: string[],
): MentionedRecommendationTerms => {
  const terms = [
    ...new Map(
      candidateTerms
        .map((term) => [normalize(term), term.trim()] as const)
        .filter(([normalized]) => normalized.length >= 3),
    ).values(),
  ];
  const positive = new Set<string>();
  const negative = new Set<string>();

  for (const note of notes) {
    if (note.folder === "Reviews") continue;
    const titleIsPositive = POSITIVE_CONTEXT.test(note.title);
    const titleIsNegative = NEGATIVE_CONTEXT.test(note.title);
    for (const passage of notePassages(note)) {
      const passageIsNegative =
        titleIsNegative || NEGATIVE_CONTEXT.test(passage);
      const passageIsPositive =
        !passageIsNegative &&
        (titleIsPositive || POSITIVE_CONTEXT.test(passage));
      if (!passageIsPositive && !passageIsNegative) continue;
      for (const term of terms) {
        if (!containsPhrase(passage, term)) continue;
        if (passageIsNegative) negative.add(normalize(term));
        else positive.add(normalize(term));
      }
    }
  }

  for (const term of negative) positive.delete(term);
  return {
    positive: [...positive].slice(0, 60),
    negative: [...negative].slice(0, 60),
  };
};

const boundedExcerpt = (passages: string[], maximum = 520) => {
  let excerpt = "";
  for (const passage of passages) {
    const candidate = excerpt ? `${excerpt} … ${passage}` : passage;
    if (candidate.length > maximum) {
      if (!excerpt) return `${candidate.slice(0, maximum - 1).trimEnd()}…`;
      break;
    }
    excerpt = candidate;
  }
  return excerpt;
};

export const retrieveRelevantNotes = (
  query: string,
  notes: Note[],
  { limit = 4 }: { limit?: number } = {},
): RelevantNoteExcerpt[] => {
  const terms = queryTokens(query);
  if (!terms.size) return [];
  const normalizedQuery = normalize(query);
  const tasteIntent = TASTE_INTENT.test(query);
  const reviewIntent = REVIEW_INTENT.test(query);

  return notes
    .map((note) => {
      const passages = notePassages(note);
      const title = normalize(note.title);
      const titleTokens = new Set(tokens(note.title));
      const titleMatches = [...terms].filter((term) => titleTokens.has(term));
      const exactTitle =
        title.length > 2 &&
        (normalizedQuery.includes(title) || title.includes(normalizedQuery));
      const passageScores = passages.map((passage, index) => {
        const passageTokens = new Set(tokens(passage));
        const matches = [...terms].filter((term) => passageTokens.has(term));
        const exact =
          normalizedQuery.length > 5 &&
          normalize(passage).includes(normalizedQuery);
        return {
          passage,
          index,
          matches,
          score:
            matches.length * 2 +
            (exact ? 12 : 0) +
            (tasteIntent && TASTE_NOTE.test(passage) ? 3 : 0),
        };
      });
      const contentScore = passageScores.reduce(
        (score, passage) => Math.max(score, passage.score),
        0,
      );
      const isTasteNote =
        note.folder === "Reviews"
          ? reviewIntent
          : TASTE_NOTE.test(note.title) ||
            passages.some((passage) => TASTE_NOTE.test(passage));
      const score =
        (exactTitle ? 30 : 0) +
        titleMatches.length * 8 +
        contentScore +
        (tasteIntent && isTasteNote ? 7 : 0) +
        (reviewIntent && note.folder === "Reviews" ? 4 : 0) +
        (tasteIntent && note.id === "preferences" ? 8 : 0);

      const rankedPassages = passageScores
        .filter(({ score: passageScore }) => passageScore > 0)
        .sort((left, right) => right.score - left.score || left.index - right.index);
      const selected = rankedPassages
        .slice(0, 2)
        .map(({ passage }) => passage);
      if (selected.length < 3 && (exactTitle || titleMatches.length || isTasteNote)) {
        for (const passage of passages) {
          if (
            selected.length >= 3 ||
            selected.includes(passage) ||
            normalize(passage) === title
          ) {
            continue;
          }
          selected.push(passage);
        }
      }
      const matchedTerms = [
        ...new Set([
          ...titleMatches,
          ...rankedPassages.flatMap(({ matches }) => matches),
        ]),
      ].slice(0, 10);

      return {
        note,
        score,
        excerpt: boundedExcerpt(selected),
        matchedTerms,
      };
    })
    .filter(
      (candidate) =>
        candidate.score >= 4 && Boolean(candidate.excerpt),
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        new Date(right.note.updatedAt).getTime() -
          new Date(left.note.updatedAt).getTime(),
    )
    .slice(0, Math.max(1, Math.min(6, limit)))
    .map(({ note, excerpt, matchedTerms }) => ({
      id: note.id,
      title: note.title,
      folder: note.folder,
      excerpt,
      matchedTerms,
    }));
};
