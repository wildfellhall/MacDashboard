import type { Book, PhotoItem, Profile, WatchItem } from "../types";
import {
  matchTasteDossier,
  type TasteDossier,
} from "./tasteDossier";

const stripHtml = (html: string) => {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element.textContent ?? "";
};

const extractList = (text: string, key: string) => {
  const pattern = new RegExp(
    `${key}\\s*:\\s*(.*?)(?=\\s*(?:Interests|Moods|Favorites|Avoid|Privacy)\\s*:|$)`,
    "i",
  );
  const match = text.match(pattern);
  return match
    ? match[1]
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    : [];
};

export const parseProfile = (preferencesHtml: string): Profile => {
  const text = stripHtml(preferencesHtml)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    interests: extractList(text, "Interests"),
    moods: extractList(text, "Moods"),
    favorites: extractList(text, "Favorites"),
    avoid: extractList(text, "Avoid"),
  };
};

const overlapScore = (values: string[], profile: Profile) => {
  const signals = [
    ...profile.interests,
    ...profile.moods,
    ...profile.favorites,
  ];
  return values.reduce((score, value) => {
    const normalized = value.toLowerCase();
    return (
      score +
      signals.reduce(
        (signalScore, signal) =>
          signal.includes(normalized) || normalized.includes(signal)
            ? signalScore + 1
            : signalScore,
        0,
      )
    );
  }, 0);
};

const avoidancePenalty = (values: string[], profile: Profile) =>
  values.reduce((score, value) => {
    const normalized = value.toLowerCase();
    return (
      score +
      profile.avoid.reduce(
        (avoidScore, avoid) =>
          avoid.includes(normalized) || normalized.includes(avoid)
            ? avoidScore + 1
            : avoidScore,
        0,
      )
    );
  }, 0);

export const scoreBook = (
  book: Book,
  profile: Profile,
  dossier?: TasteDossier,
) => {
  const values = [
    book.title,
    book.author,
    book.description,
    ...book.genres,
    ...book.themes,
  ];
  const titleIsKnown = overlapScore([book.title], profile) > 0;
  const affinity = Math.min(3, overlapScore(values, profile)) * 8;
  const avoidance =
    avoidancePenalty(values, profile) * 22;
  const quality = (book.rating ?? 4.2) * 7;
  const rereadAge = book.lastRead
    ? Math.min(
        20,
        Math.floor(
          (Date.now() - new Date(book.lastRead).getTime()) /
            (1000 * 60 * 60 * 24 * 180),
        ) * 3,
      )
    : 8;
  const novelty = book.kind === "discover" ? (titleIsKnown ? 0 : 12) : rereadAge;
  const engagement = book.minutes
    ? Math.min(10, Math.max(0, Math.round(Math.log2(book.minutes / 30) * 2)))
    : 0;
  const maximum =
    book.kind === "discover" && book.aiFitScore === undefined ? 92 : 98;
  const base = Math.max(
    1,
    Math.min(
      maximum,
      Math.round(
        31 + affinity + quality + novelty + engagement - avoidance,
      ),
    ),
  );
  const evidence = matchTasteDossier(values, dossier, "books");
  const localScore = Math.max(
    1,
    Math.min(maximum, base + Math.min(16, evidence.adjustment)),
  );
  if (book.aiFitScore === undefined) return localScore;
  const blended = Math.round(localScore * 0.22 + book.aiFitScore * 0.78 + 3);
  return Math.max(
    1,
    Math.min(
      maximum,
      evidence.negative.length ? Math.min(localScore, blended) : blended,
    ),
  );
};

export const scoreWatchItem = (
  item: WatchItem,
  profile: Profile,
  dossier?: TasteDossier,
) => {
  const values = [
    item.title,
    item.description,
    ...item.genres,
    ...item.moods,
    ...(item.platforms ?? []),
    ...(item.mediaType ? [item.mediaType] : []),
  ];
  const affinity = Math.min(3, overlapScore(values, profile)) * 8;
  const avoidance =
    avoidancePenalty(values, profile) * 22;
  const quality = (item.rating ?? 4.1) * 6;
  const revisit = item.lastWatched
    ? Math.min(
        18,
        Math.floor(
          (Date.now() - new Date(item.lastWatched).getTime()) /
            (1000 * 60 * 60 * 24 * 180),
        ) * 3,
      )
    : 10;
  const maximum =
    item.kind === "discover" && item.aiFitScore === undefined ? 92 : 98;
  const base = Math.max(
    1,
    Math.min(maximum, Math.round(29 + affinity + quality + revisit - avoidance)),
  );
  const evidence = matchTasteDossier(values, dossier, "tv");
  const localScore = Math.max(
    1,
    Math.min(maximum, base + Math.min(16, evidence.adjustment)),
  );
  if (item.aiFitScore === undefined) return localScore;
  const blended = Math.round(localScore * 0.22 + item.aiFitScore * 0.78 + 3);
  return Math.max(
    1,
    Math.min(
      maximum,
      evidence.negative.length ? Math.min(localScore, blended) : blended,
    ),
  );
};

export const scorePhoto = (
  photo: PhotoItem,
  profile: Profile,
  currentNoteProfile?: Profile,
  dossier?: TasteDossier,
) => {
  const values = [
    photo.title,
    photo.creator,
    photo.reason,
    ...photo.tags,
  ];
  const matches = values.filter((tag) =>
    [...profile.interests, ...profile.moods, ...profile.favorites].some(
      (signal) =>
        signal.toLowerCase().includes(tag.toLowerCase()) ||
        tag.toLowerCase().includes(signal.toLowerCase()),
    ),
  );
  const avoidMatches = values.filter((tag) =>
    profile.avoid.some(
      (avoid) =>
        avoid.toLowerCase().includes(tag.toLowerCase()) ||
        tag.toLowerCase().includes(avoid.toLowerCase()),
    ),
  );
  const noteMatches = currentNoteProfile
    ? values.filter((tag) =>
        [
          ...currentNoteProfile.interests,
          ...currentNoteProfile.moods,
          ...currentNoteProfile.favorites,
        ].some(
          (signal) =>
            signal.toLowerCase().includes(tag.toLowerCase()) ||
            tag.toLowerCase().includes(signal.toLowerCase()),
        ),
      )
    : [];
  const noteAvoidMatches = currentNoteProfile
    ? values.filter((tag) =>
        currentNoteProfile.avoid.some(
          (avoid) =>
            avoid.toLowerCase().includes(tag.toLowerCase()) ||
            tag.toLowerCase().includes(avoid.toLowerCase()),
        ),
      )
    : [];
  const base = Math.max(
    1,
    Math.min(
      98,
      68 +
        matches.length * 12 +
        noteMatches.length * 6 -
        avoidMatches.length * 24 -
      noteAvoidMatches.length * 12,
    ),
  );
  const evidence = matchTasteDossier(values, dossier, "photos");
  return Math.max(1, Math.min(99, base + evidence.adjustment));
};

export const recommendationReason = (
  values: string[],
  profile: Profile,
  fallback: string,
) => {
  const matches = values.filter((value) =>
    [...profile.interests, ...profile.moods, ...profile.favorites].some(
      (signal) =>
        signal.includes(value.toLowerCase()) ||
        value.toLowerCase().includes(signal),
    ),
  );
  return matches.length
    ? `Because you favor ${matches.slice(0, 2).join(" and ")}.`
    : fallback;
};
