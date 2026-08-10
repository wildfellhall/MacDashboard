import type { Note } from "../types";

export type TasteDomain = "general" | "books" | "tv" | "photos";
export type TastePolarity = "positive" | "negative" | "curious";

export type TasteEvidence = {
  noteId: string;
  noteTitle: string;
  folder: Note["folder"];
  passage: string;
  polarity: TastePolarity;
  strength: number;
  domains: TasteDomain[];
  concepts: string[];
  updatedAt: string;
};

export type TasteDossier = {
  currentNoteCount: number;
  evidenceNoteCount: number;
  evidenceCount: number;
  evidence: TasteEvidence[];
};

export type TasteEvidenceMatch = TasteEvidence & {
  matchedConcepts: string[];
  contribution: number;
  directTitleMatch: boolean;
};

export type TasteMatch = {
  adjustment: number;
  confidence: number;
  positive: TasteEvidenceMatch[];
  negative: TasteEvidenceMatch[];
  curious: TasteEvidenceMatch[];
  sourceNoteTitles: string[];
  summary: string;
};

const MAX_EVIDENCE_PER_NOTE = 24;
const MAX_EVIDENCE = 300;
const MAX_CONCEPTS = 20;

const POSITIVE_MARKER =
  /\b(?:favorite|favourite|love|loved|adore|adored|best|prefer|preferred|drawn to|obsessed with|treasure|cherish|enjoy|enjoyed|like|liked|works? for me|resonates?|moving|beautiful|inspiration|inspired by|interests?|things i like)\b/i;
const STRONG_POSITIVE_MARKER =
  /\b(?:favorite|favourite|love|loved|adore|adored|best|obsessed with|treasure|cherish)\b/i;
const NEGATIVE_MARKER =
  /\b(?:avoid|dislike|disliked|hate|hated|not for me|do not like|don['’]t like|cannot stand|can['’]t stand|skip|too bleak|too cynical|put me off|turned me off)\b/i;
const NEGATED_TRAIT_MARKER =
  /\b(?:without|no)\s+([\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){0,2})/iu;
const STRONG_NEGATIVE_MARKER =
  /\b(?:hate|hated|cannot stand|can['’]t stand|never again|dealbreaker)\b/i;
const CURIOUS_MARKER =
  /\b(?:curious about|interested in|want to|would like to|hope to|watchlist|reading list|read next|to read|to watch|explore|try next)\b/i;
const BOOK_MARKER =
  /\b(?:books?|novels?|authors?|read|reading|literature|memoirs?|essays?|poetry)\b/i;
const TV_MARKER =
  /\b(?:shows?|series|television|tv|movies?|films?|documentaries?|watch|watched|watching|streaming|episodes?)\b/i;
const PHOTO_MARKER =
  /\b(?:photos?|photography|images?|visuals?|aesthetic|architecture|colors?|colours?|palette|landscapes?|portraits?|illustration|paintings?|artworks?)\b/i;
const PREFERENCE_LABEL =
  /^\s*(?:interests?|moods?|vibes?|favorites?|favourites?|avoid|dislikes?|inspiration|things i like|things to avoid)\s*:/i;
const AVOID_LABEL = /^\s*(?:avoid|dislikes?|things to avoid)\s*:/i;
const FAVORITE_LABEL = /^\s*(?:favorites?|favourites?)\s*:/i;

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "although",
  "always",
  "among",
  "and",
  "are",
  "because",
  "been",
  "before",
  "being",
  "best",
  "both",
  "but",
  "can",
  "could",
  "did",
  "dislike",
  "disliked",
  "does",
  "doing",
  "don",
  "enjoy",
  "especially",
  "favorite",
  "favorites",
  "feel",
  "feels",
  "for",
  "from",
  "had",
  "has",
  "hate",
  "hated",
  "have",
  "having",
  "how",
  "into",
  "interested",
  "just",
  "like",
  "liked",
  "love",
  "loved",
  "more",
  "most",
  "much",
  "not",
  "often",
  "only",
  "other",
  "our",
  "out",
  "over",
  "prefer",
  "preferred",
  "really",
  "should",
  "some",
  "something",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "thing",
  "things",
  "this",
  "those",
  "through",
  "too",
  "very",
  "want",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "without",
  "would",
  "you",
  "your",
]);

const SEMANTIC_FAMILIES = [
  ["atmospheric", "moody", "evocative", "immersive", "textured"],
  ["quiet", "gentle", "subtle", "understated", "restrained"],
  ["slow", "contemplative", "meditative", "patient", "unhurried"],
  ["dreamlike", "surreal", "oneiric", "uncanny", "liminal"],
  ["tender", "compassionate", "humane", "warm", "empathetic"],
  ["funny", "comedy", "humor", "humour", "witty", "deadpan", "dry"],
  ["mystery", "mysterious", "enigmatic", "puzzle", "secrets"],
  ["architecture", "architectural", "buildings", "interiors", "urban"],
  ["nature", "landscape", "coastal", "forest", "botanical", "wilderness"],
  ["historical", "history", "period", "archive", "archival"],
  ["intimate", "personal", "interior", "character", "character-driven"],
  ["bleak", "grim", "nihilistic", "cynical", "cruel"],
  ["hopeful", "hope", "uplifting", "optimistic", "redemptive"],
  ["intellectual", "philosophical", "ideas", "cerebral", "thoughtful"],
  ["experimental", "inventive", "unconventional", "formally", "innovative"],
  ["vivid", "colorful", "colourful", "saturated", "chromatic"],
] as const;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s'-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const stem = (value: string) => {
  const token = normalize(value).replace(/^['-]+|['-]+$/g, "");
  if (token.length > 6 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 6 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
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

const domainsFor = (
  value: string,
  inherited: TasteDomain[] = ["general"],
): TasteDomain[] => {
  const domains: TasteDomain[] = [];
  if (BOOK_MARKER.test(value)) domains.push("books");
  if (TV_MARKER.test(value)) domains.push("tv");
  if (PHOTO_MARKER.test(value)) domains.push("photos");
  const inheritedSpecific = inherited.filter((domain) => domain !== "general");
  return domains.length
    ? [...new Set([...inheritedSpecific, ...domains])]
    : inherited;
};

const ratingPolarity = (value: string): TastePolarity | null => {
  const rating = value.match(/\b([0-5](?:\.\d)?)\s*\/\s*5\b/);
  if (!rating) return null;
  const score = Number(rating[1]);
  if (score >= 3.75) return "positive";
  if (score <= 2.25) return "negative";
  return "curious";
};

const polarityFor = (
  value: string,
  inherited: TastePolarity | null,
): TastePolarity | null => {
  if (AVOID_LABEL.test(value) || NEGATIVE_MARKER.test(value)) return "negative";
  if (
    FAVORITE_LABEL.test(value) ||
    POSITIVE_MARKER.test(value) ||
    PREFERENCE_LABEL.test(value)
  ) {
    return "positive";
  }
  if (CURIOUS_MARKER.test(value)) return "curious";
  return ratingPolarity(value) ?? inherited;
};

const strengthFor = (value: string, polarity: TastePolarity) => {
  if (polarity === "negative") {
    return STRONG_NEGATIVE_MARKER.test(value) ? 5 : 4;
  }
  if (polarity === "curious") return 2;
  if (STRONG_POSITIVE_MARKER.test(value) || FAVORITE_LABEL.test(value)) {
    return 5;
  }
  return /\b(?:prefer|preferred|enjoy|enjoyed|resonates?)\b/i.test(value)
    ? 4
    : 3;
};

const splitClauses = (value: string) =>
  value
    .replace(/\s+\b(but|however|except|although|while)\b\s+/gi, "|||$1 ")
    .split(/\|\|\||\s*[;]\s*/)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length >= 3);

const conceptsFrom = (value: string) => {
  const normalized = normalize(
    value
      .replace(PREFERENCE_LABEL, "")
      .replace(/\b[0-5](?:\.\d)?\s*\/\s*5\b/g, ""),
  );
  const rawTokens = normalized
    .split(/\s+/)
    .map(stem)
    .filter(
      (token) =>
        token.length >= 3 &&
        !STOP_WORDS.has(token) &&
        !/^\d+$/.test(token),
    );
  const phrases: string[] = [];
  for (let index = 0; index < rawTokens.length - 1; index += 1) {
    phrases.push(`${rawTokens[index]} ${rawTokens[index + 1]}`);
  }
  const quoted = [...value.matchAll(/[“"']([^”"']{3,80})[”"']/g)]
    .map((match) => normalize(match[1]))
    .filter(Boolean);
  return [...new Set([...quoted, ...phrases, ...rawTokens])]
    .filter((concept) => concept.length >= 3)
    .slice(0, MAX_CONCEPTS);
};

const contextFromTitle = (note: Note) => ({
  domains: domainsFor(note.title),
  polarity:
    polarityFor(note.title, null) ??
    (note.folder === "Reviews" ? ratingPolarity(note.content) : null),
});

export const buildTasteDossier = (notes: Note[]): TasteDossier => {
  const evidence: TasteEvidence[] = [];

  for (const note of notes) {
    const document = new DOMParser().parseFromString(note.content, "text/html");
    const blocks = [
      ...document.body.querySelectorAll("h1, h2, h3, p, li, blockquote"),
    ].filter(
      (element) => !(element.tagName === "P" && element.closest("li")),
    );
    let context = contextFromTitle(note);
    const noteEvidence: TasteEvidence[] = [];
    const seen = new Set<string>();

    for (const block of blocks) {
      const passage = blockText(block);
      if (!passage) continue;
      const isHeading = /^H[123]$/.test(block.tagName);
      const nextDomains = domainsFor(passage, context.domains);
      const nextPolarity = polarityFor(passage, context.polarity);

      if (isHeading) {
        context = {
          domains: nextDomains,
          polarity: nextPolarity,
        };
        if (normalize(passage) === normalize(note.title)) continue;
      }

      for (const clause of splitClauses(passage)) {
        const polarity = polarityFor(clause, nextPolarity);
        if (!polarity) continue;
        const concepts = conceptsFrom(clause);
        if (!concepts.length) continue;
        const domains = domainsFor(clause, nextDomains);
        const key = `${polarity}:${domains.join(",")}:${normalize(clause)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        noteEvidence.push({
          noteId: note.id,
          noteTitle: note.title,
          folder: note.folder,
          passage: clause.slice(0, 360),
          polarity,
          strength: strengthFor(clause, polarity),
          domains,
          concepts,
          updatedAt: note.updatedAt,
        });
        const negatedTrait = clause.match(NEGATED_TRAIT_MARKER)?.[1];
        if (
          negatedTrait &&
          polarity !== "negative" &&
          conceptsFrom(negatedTrait).length
        ) {
          const negativePassage = `Avoid ${negatedTrait} — expressed as “${clause}”`;
          const negativeKey = `negative:${domains.join(",")}:${normalize(
            negativePassage,
          )}`;
          if (!seen.has(negativeKey)) {
            seen.add(negativeKey);
            noteEvidence.push({
              noteId: note.id,
              noteTitle: note.title,
              folder: note.folder,
              passage: negativePassage.slice(0, 360),
              polarity: "negative",
              strength: 4,
              domains,
              concepts: conceptsFrom(negatedTrait),
              updatedAt: note.updatedAt,
            });
          }
        }
      }
    }

    evidence.push(
      ...noteEvidence
        .sort(
          (left, right) =>
            right.strength - left.strength ||
            right.concepts.length - left.concepts.length,
        )
        .slice(0, MAX_EVIDENCE_PER_NOTE),
    );
  }

  const bounded = evidence
    .sort(
      (left, right) =>
        right.strength - left.strength ||
        new Date(right.updatedAt).getTime() -
          new Date(left.updatedAt).getTime(),
    )
    .slice(0, MAX_EVIDENCE);
  return {
    currentNoteCount: notes.length,
    evidenceNoteCount: new Set(bounded.map((item) => item.noteId)).size,
    evidenceCount: bounded.length,
    evidence: bounded,
  };
};

const familyFor = (value: string) => {
  const valueStem = stem(value);
  return SEMANTIC_FAMILIES.findIndex((family) =>
    family.some((term) => stem(term) === valueStem),
  );
};

const conceptMatch = (
  concept: string,
  candidate: string,
  candidateTokens: Set<string>,
) => {
  const normalizedConcept = normalize(concept);
  if (!normalizedConcept) return 0;
  if (` ${candidate} `.includes(` ${normalizedConcept} `)) {
    return normalizedConcept.includes(" ") ? 1.5 : 1.15;
  }
  const conceptTokens = normalizedConcept.split(/\s+/).map(stem);
  if (conceptTokens.length > 1) {
    const covered = conceptTokens.filter((token) =>
      candidateTokens.has(token),
    ).length;
    if (covered >= 2 && covered / conceptTokens.length >= 0.66) return 1.1;
  } else if (
    conceptTokens[0]?.length >= 5 &&
    candidateTokens.has(conceptTokens[0])
  ) {
    return 1;
  }
  const family = conceptTokens
    .map(familyFor)
    .find((index) => index >= 0);
  if (
    family !== undefined &&
    family >= 0 &&
    [...candidateTokens].some((token) => familyFor(token) === family)
  ) {
    return 0.8;
  }
  return 0;
};

const matchEvidence = (
  item: TasteEvidence,
  candidate: string,
  candidateTokens: Set<string>,
  candidateTitle: string,
): TasteEvidenceMatch | null => {
  const matches = item.concepts
    .map((concept) => ({
      concept,
      score: conceptMatch(concept, candidate, candidateTokens),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);
  if (!matches.length) return null;
  const uniqueMatches: typeof matches = [];
  const claimedTokens = new Set<string>();
  for (const match of matches) {
    const tokens = normalize(match.concept).split(/\s+/).map(stem);
    if (tokens.every((token) => claimedTokens.has(token))) continue;
    tokens.forEach((token) => claimedTokens.add(token));
    uniqueMatches.push(match);
    if (uniqueMatches.length >= 3) break;
  }
  const confidence = uniqueMatches.reduce(
    (total, match) => total + match.score,
    0,
  );
  const directTitleMatch =
    candidateTitle.length >= 3 &&
    ` ${normalize(item.passage)} `.includes(` ${candidateTitle} `);
  return {
    ...item,
    matchedConcepts: uniqueMatches.map(({ concept }) => concept),
    contribution:
      item.strength *
      Math.min(2.5, confidence) *
        (item.polarity === "curious" ? 0.55 : 1) +
      (directTitleMatch ? 12 : 0),
    directTitleMatch,
  };
};

const evidenceSummary = (
  positive: TasteEvidenceMatch[],
  curious: TasteEvidenceMatch[],
  negative: TasteEvidenceMatch[],
) => {
  const supporting = [...positive, ...curious].slice(0, 2);
  if (supporting.length) {
    const details = supporting
      .map(
        (item) =>
          `${item.matchedConcepts.slice(0, 2).join(" + ")} from “${item.noteTitle}”`,
      )
      .join("; ");
    const caveat = negative[0]
      ? ` It is tempered by ${negative[0].matchedConcepts
          .slice(0, 2)
          .join(" + ")} in “${negative[0].noteTitle}”.`
      : "";
    return `Evidence match: ${details}.${caveat}`;
  }
  if (negative.length) {
    return `Potential mismatch: ${negative[0].matchedConcepts
      .slice(0, 2)
      .join(" + ")} conflicts with “${negative[0].noteTitle}”.`;
  }
  return "";
};

export const matchTasteDossier = (
  values: string[],
  dossier: TasteDossier | undefined,
  domain: Exclude<TasteDomain, "general">,
): TasteMatch => {
  if (!dossier?.evidence.length) {
    return {
      adjustment: 0,
      confidence: 0,
      positive: [],
      negative: [],
      curious: [],
      sourceNoteTitles: [],
      summary: "",
    };
  }
  const candidate = normalize(values.join(" "));
  const candidateTitle = normalize(values[0] ?? "");
  const candidateTokens = new Set(candidate.split(/\s+/).map(stem));
  const matches = dossier.evidence
    .filter(
      (item) =>
        item.domains.includes("general") || item.domains.includes(domain),
    )
    .map((item) =>
      matchEvidence(item, candidate, candidateTokens, candidateTitle),
    )
    .filter((item): item is TasteEvidenceMatch => Boolean(item));
  const ranked = (polarity: TastePolarity) =>
    matches
      .filter((item) => item.polarity === polarity)
      .sort(
        (left, right) =>
          right.contribution - left.contribution ||
          right.strength - left.strength,
      );
  const positive = ranked("positive");
  const negative = ranked("negative");
  const curious = ranked("curious");
  const positiveTotal = positive
    .slice(0, 5)
    .reduce((total, item) => total + item.contribution, 0);
  const curiousTotal = curious
    .slice(0, 3)
    .reduce((total, item) => total + item.contribution, 0);
  const negativeTotal = negative
    .slice(0, 5)
    .reduce((total, item) => total + item.contribution, 0);
  const sourceNoteTitles = [
    ...new Set(
      [...positive, ...curious, ...negative].map((item) => item.noteTitle),
    ),
  ].slice(0, 5);
  const diversityBonus = Math.min(
    5,
    new Set([...positive, ...curious].map((item) => item.noteId)).size * 1.5,
  );
  const adjustment = Math.max(
    -42,
    Math.min(
      28,
      Math.round(
        positiveTotal * 0.72 +
          curiousTotal * 0.5 +
          diversityBonus -
          negativeTotal * 1.1,
      ),
    ),
  );
  const confidence = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        Math.abs(adjustment) * 2.2 +
          sourceNoteTitles.length * 7 +
          Math.min(20, matches.length * 3),
      ),
    ),
  );
  return {
    adjustment,
    confidence,
    positive,
    negative,
    curious,
    sourceNoteTitles,
    summary: evidenceSummary(positive, curious, negative),
  };
};

export const buildTasteDiscoverySeeds = (
  dossier: TasteDossier,
  domain: Exclude<TasteDomain, "general">,
  limit = 6,
) => {
  const candidates = dossier.evidence
    .filter(
      (item) =>
        item.polarity !== "negative" &&
        (item.domains.includes(domain) || item.domains.includes("general")),
    )
    .sort((left, right) => right.strength - left.strength)
    .flatMap((item) => [
      ...item.concepts.filter((concept) => concept.includes(" ")),
      ...item.concepts,
    ])
    .filter((concept) => concept.length >= 4);
  return [...new Set(candidates)].slice(0, Math.max(1, limit));
};

export const dossierForNotes = (
  dossier: TasteDossier,
  noteIds: Set<string>,
): TasteDossier => {
  const eligible = dossier.evidence.filter((item) =>
    noteIds.has(item.noteId),
  );
  const firstByNote = eligible.filter(
    (item, index) =>
      eligible.findIndex((candidate) => candidate.noteId === item.noteId) ===
      index,
  );
  const selectedKeys = new Set(
    firstByNote.map(
      (item) => `${item.noteId}:${item.polarity}:${item.passage}`,
    ),
  );
  const evidence = [
    ...firstByNote,
    ...eligible.filter(
      (item) =>
        !selectedKeys.has(
          `${item.noteId}:${item.polarity}:${item.passage}`,
        ),
    ),
  ].slice(0, 80);
  return {
    currentNoteCount: noteIds.size,
    evidenceNoteCount: new Set(evidence.map((item) => item.noteId)).size,
    evidenceCount: evidence.length,
    evidence,
  };
};
