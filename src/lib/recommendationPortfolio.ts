import type { Book, WatchItem } from "../types";
import type { RecommendationPlanCandidate } from "./recommendationPlanner";

const normalizedWords = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const normalizedTitle = (value: string) => normalizedWords(value).join(" ");

const overlap = (left: string[], right: string[]) => {
  const rightSet = new Set(right);
  const intersection = new Set(left.filter((word) => rightSet.has(word))).size;
  return intersection / Math.max(1, new Set([...left, ...right]).size);
};

export const plannedCandidateFor = (
  item: Pick<Book, "title" | "author"> | Pick<WatchItem, "title" | "mediaType">,
  candidates: RecommendationPlanCandidate[],
) => {
  const itemTitle = normalizedTitle(item.title);
  const itemWords = normalizedWords(item.title);
  return candidates
    .map((candidate, index) => {
      const candidateTitle = normalizedTitle(candidate.title);
      const exact = itemTitle === candidateTitle;
      const containment =
        itemTitle.length >= 4 &&
        candidateTitle.length >= 4 &&
        (itemTitle.includes(candidateTitle) || candidateTitle.includes(itemTitle));
      const titleOverlap = overlap(itemWords, normalizedWords(candidate.title));
      const creator =
        "author" in item
          ? normalizedTitle(item.author)
          : "";
      const creatorMatch =
        creator &&
        normalizedTitle(candidate.creator) &&
        (creator.includes(normalizedTitle(candidate.creator)) ||
          normalizedTitle(candidate.creator).includes(creator));
      const mediaMatch =
        "mediaType" in item &&
        item.mediaType &&
        candidate.mediaType !== "book" &&
        item.mediaType === candidate.mediaType;
      return {
        candidate,
        index,
        confidence:
          (exact ? 5 : containment ? 3 : titleOverlap * 2) +
          (creatorMatch ? 1.5 : 0) +
          (mediaMatch ? 0.35 : 0),
      };
    })
    .filter((match) => match.confidence >= 1.05)
    .sort(
      (left, right) =>
        right.confidence - left.confidence || left.index - right.index,
    )[0]?.candidate;
};

const signalSimilarity = (left: string[], right: string[]) =>
  overlap(
    left.flatMap(normalizedWords),
    right.flatMap(normalizedWords),
  );

const diversify = <T>(
  items: T[],
  scoreFor: (item: T) => number,
  creatorFor: (item: T) => string,
  signalsFor: (item: T) => string[],
) => {
  const remaining = [...items];
  const selected: T[] = [];
  while (remaining.length) {
    let bestIndex = 0;
    let bestUtility = Number.NEGATIVE_INFINITY;
    remaining.forEach((item, index) => {
      const creator = normalizedTitle(creatorFor(item));
      const sameCreatorCount = selected.filter(
        (chosen) =>
          creator &&
          normalizedTitle(creatorFor(chosen)) === creator,
      ).length;
      const nearestSimilarity = selected.reduce(
        (maximum, chosen) =>
          Math.max(
            maximum,
            signalSimilarity(signalsFor(item), signalsFor(chosen)),
          ),
        0,
      );
      const utility =
        scoreFor(item) -
        sameCreatorCount * 16 -
        nearestSimilarity * 18 -
        index * 0.015;
      if (utility > bestUtility) {
        bestUtility = utility;
        bestIndex = index;
      }
    });
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }
  return selected;
};

export const diversifyBooks = <T extends Book & { score: number }>(
  books: T[],
) =>
  diversify(
    books,
    (book) => book.score,
    (book) => book.author,
    (book) => [...book.genres, ...book.themes, ...(book.aiFacets ?? [])],
  );

export const diversifyWatchItems = <
  T extends WatchItem & { score: number },
>(
  items: T[],
) =>
  diversify(
    items,
    (item) => item.score,
    () => "",
    (item) => [
      ...item.genres,
      ...item.moods,
      ...(item.aiFacets ?? []),
      ...(item.mediaType ? [item.mediaType] : []),
    ],
  );
