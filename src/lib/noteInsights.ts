import type { Note, Profile } from "../types";

export type NoteInsightSource = {
  noteId: string;
  title: string;
  signalCount: number;
};

export type NoteRecommendationInsights = {
  interests: string[];
  moods: string[];
  favorites: string[];
  avoid: string[];
  bookTitles: string[];
  watchTitles: string[];
  watchPlatforms: string[];
  photoTerms: string[];
  sources: NoteInsightSource[];
};

type SignalContext = {
  domain: "book" | "watch" | "photo" | "general";
  bucket: "interest" | "mood" | "favorite" | "avoid";
  subject?: "platform";
};

const MAX_SIGNALS_PER_BUCKET = 40;
const POSITIVE_MARKER =
  /\b(?:favorite|favourite|love|loved|liked|enjoy|enjoyed|adore|best|prefer|preferred|drawn to|obsessed with|interest|inspiration|recommend|watchlist|reading list|read next|things? i like|i (?:really )?like|want to (?:read|watch)|to (?:read|watch))\b/i;
const NEGATIVE_MARKER =
  /\b(?:avoid|dislike|disliked|hate|hated|not for me|do not like|don['’]t like|cannot stand|can['’]t stand|skip)\b/i;
const BOOK_MARKER =
  /\b(?:books?|novels?|authors?|reading|read(?:ing)? list|literature)\b/i;
const WATCH_MARKER =
  /\b(?:shows?|series|television|tv|movies?|films?|watch(?:ing|list)?|streaming (?:platforms?|services?)|watch providers?)\b/i;
const PLATFORM_MARKER =
  /\b(?:streaming (?:platforms?|services?)|watch providers?)\b/i;
const PHOTO_MARKER =
  /\b(?:photos?|photography|images?|visuals?|aesthetic|art|architecture|colors?|colours?|palette|landscapes?|portraits?|style|inspiration)\b/i;
const MOOD_MARKER = /\b(?:moods?|vibes?|tones?|atmosphere)\b/i;
const LABEL_PREFIX =
  /^(?:my\s+)?(?:(?:all[- ]time\s+)?(?:favorite|favourite|best|loved?|liked?|enjoyed?|adored?)\s+)?(?:(?:books?|novels?|authors?|reading|shows?|series|television|tv|movies?|films?|watchlist|streaming (?:platforms?|services?)|watch providers?|photos?|photography|images?|visuals?|aesthetic|art|architecture|colors?|colours?|palette|landscapes?|portraits?|moods?|vibes?|tones?|interests?|inspirations?|things to avoid|avoid|dislikes?|not for me|recommendations?))(?:\s+(?:are|include|includes))?\s*[:—–-]?\s*/i;
const PROSE_PREFIX =
  /^(?:(?:i(?:['’]m)?\s+)?(?:really\s+)?(?:love|loved|like|liked|enjoy|enjoyed|adore|adored|prefer|preferred|drawn to|am drawn to|(?:am )?obsessed with|dislike|disliked|hate|hated|avoid|skip|do not like|don['’]t like|cannot stand|can['’]t stand))\s+/i;
const hasProperTitleCase = (value: string) =>
  /(?:^|[\s,])[\p{Lu}][\p{L}'’-]{2,}/u.test(
    value.replace(/^\s*I\b/, ""),
  );

const GENERIC_LABELS = new Set([
  "aesthetic",
  "art",
  "avoid",
  "books",
  "colors",
  "colours",
  "dislikes",
  "favorite books",
  "favorite movies",
  "favorite shows",
  "favorites",
  "favourite books",
  "favourite movies",
  "favourite shows",
  "favourites",
  "films",
  "images",
  "inspiration",
  "interests",
  "movies",
  "moods",
  "not for me",
  "palette",
  "photography",
  "photos",
  "reading list",
  "recommendations",
  "series",
  "shows",
  "streaming platforms",
  "streaming services",
  "television",
  "things to avoid",
  "to read",
  "to watch",
  "tv",
  "vibes",
  "visuals",
  "watchlist",
  "watch providers",
]);

const normalizeSignal = (value: string) =>
  value
    .replace(/^[\s•·☐☑✓]+/, "")
    .replace(/^\d{1,3}[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "")
    .trim()
    .toLowerCase()
    .slice(0, 80);

const unique = (values: string[]) =>
  [...new Set(values.map(normalizeSignal).filter(Boolean))].slice(
    0,
    MAX_SIGNALS_PER_BUCKET,
  );

const contextFor = (value: string): SignalContext | null => {
  const negative = NEGATIVE_MARKER.test(value);
  const positive = POSITIVE_MARKER.test(value);
  const mood = MOOD_MARKER.test(value);
  const domain = BOOK_MARKER.test(value)
    ? "book"
    : WATCH_MARKER.test(value)
      ? "watch"
      : PHOTO_MARKER.test(value)
        ? "photo"
        : "general";

  if (
    !negative &&
    !positive &&
    !mood &&
    domain === "general"
  ) {
    return null;
  }

  return {
    domain,
    bucket: negative
      ? "avoid"
      : mood
        ? "mood"
        : /\b(?:favorite|favourite|love|loved|adore|adored|best)\b/i.test(
              value,
            )
          ? "favorite"
          : "interest",
    ...(PLATFORM_MARKER.test(value) ? { subject: "platform" as const } : {}),
  };
};

const blockText = (element: Element) => {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll("br").forEach((breakElement) => {
    breakElement.replaceWith(document.createTextNode("\n"));
  });
  return clone.textContent?.replace(/\u00a0/g, " ").trim() ?? "";
};

const splitValues = (value: string) =>
  value
    .split(/[,;\n]+/)
    .map(normalizeSignal)
    .filter(
      (item) =>
        item.length >= 2 &&
        item.split(/\s+/).length <= 12 &&
        !GENERIC_LABELS.has(item),
    );

const valuesAfterLabel = (value: string) => {
  const colon = value.match(/^[^:]{1,80}:\s*(.+)$/);
  if (colon?.[1]) return colon[1];
  return value.replace(LABEL_PREFIX, "").replace(PROSE_PREFIX, "").trim();
};

const titleAndDescriptors = (
  value: string,
  context: SignalContext,
) => {
  if (context.domain !== "book" && context.domain !== "watch") {
    return { primary: splitValues(value), descriptors: [] as string[] };
  }
  const divider = value.match(/^(.{1,80}?)\s+[—–]\s+(.{2,120})$/);
  if (!divider?.[1] || !divider[2]) {
    return { primary: splitValues(value), descriptors: [] as string[] };
  }
  return {
    primary: splitValues(divider[1]),
    descriptors: splitValues(divider[2]),
  };
};

export const extractNoteRecommendationInsights = (
  notes: Note[],
): NoteRecommendationInsights => {
  const interests: string[] = [];
  const moods: string[] = [];
  const favorites: string[] = [];
  const avoid: string[] = [];
  const bookTitles: string[] = [];
  const watchTitles: string[] = [];
  const watchPlatforms: string[] = [];
  const photoTerms: string[] = [];
  const sources: NoteInsightSource[] = [];

  for (const note of notes) {
    // Preferences and Reviews have their own structured parsers. Keeping those
    // paths separate prevents prose and headings from being counted twice.
    if (note.id === "preferences" || note.folder === "Reviews") continue;

    const sourceValues = new Set<string>();
    const document = new DOMParser().parseFromString(note.content, "text/html");
    let activeContext = contextFor(note.title);
    const blocks = [
      ...document.body.querySelectorAll("h1, h2, h3, p, li, blockquote"),
    ];

    for (const block of blocks) {
      if (block.tagName === "P" && block.closest("li")) continue;
      const raw = blockText(block);
      if (!raw) continue;

      const rawBlockContext = contextFor(raw);
      const isHeading = /^H[123]$/.test(block.tagName);
      const isListItem = block.tagName === "LI";
      const hasLabel = LABEL_PREFIX.test(raw);
      const repeatsTitle =
        isHeading &&
        normalizeSignal(raw) === normalizeSignal(note.title);
      const blockContext =
        !isHeading &&
        !hasLabel &&
        activeContext &&
        activeContext.domain !== "general" &&
        rawBlockContext
          ? {
              ...rawBlockContext,
              domain: activeContext.domain,
              subject: rawBlockContext.subject ?? activeContext.subject,
            }
          : rawBlockContext;

      if (blockContext && (isHeading || hasLabel)) {
        activeContext = blockContext;
      }
      if (repeatsTitle || (isHeading && !valuesAfterLabel(raw))) continue;

      const context =
        blockContext ??
        (isListItem || isHeading || raw.length <= 180 ? activeContext : null);
      if (!context) continue;

      const explicit = Boolean(
        blockContext || hasLabel || PROSE_PREFIX.test(raw),
      );
      if (!explicit && !isListItem && !activeContext) continue;

      const candidate = explicit ? valuesAfterLabel(raw) : raw;
      if (!candidate || normalizeSignal(candidate) === normalizeSignal(note.title)) {
        continue;
      }
      const { primary, descriptors } = titleAndDescriptors(candidate, context);
      const structuredTitleSignal =
        isListItem ||
        hasLabel ||
        (PROSE_PREFIX.test(raw) && hasProperTitleCase(raw));

      for (const value of primary) {
        sourceValues.add(`${context.bucket}:${context.domain}:${value}`);
        if (context.bucket === "avoid") {
          avoid.push(value);
          continue;
        }
        if (context.bucket === "mood") moods.push(value);
        else if (context.bucket === "favorite") favorites.push(value);
        else interests.push(value);

        if (context.domain === "book" && structuredTitleSignal) {
          bookTitles.push(value);
          favorites.push(value);
        } else if (context.domain === "watch" && structuredTitleSignal) {
          if (context.subject === "platform") {
            watchPlatforms.push(value);
            interests.push(value);
          } else {
            watchTitles.push(value);
            favorites.push(value);
          }
        } else if (context.domain === "photo") {
          photoTerms.push(value);
          interests.push(value);
        }
      }

      for (const descriptor of descriptors) {
        sourceValues.add(`interest:general:${descriptor}`);
        interests.push(descriptor);
      }
    }

    if (sourceValues.size) {
      sources.push({
        noteId: note.id,
        title: note.title,
        signalCount: sourceValues.size,
      });
    }
  }

  return {
    interests: unique(interests),
    moods: unique(moods),
    favorites: unique(favorites),
    avoid: unique(avoid),
    bookTitles: unique(bookTitles),
    watchTitles: unique(watchTitles),
    watchPlatforms: unique(watchPlatforms),
    photoTerms: unique(photoTerms),
    sources,
  };
};

export const noteInsightsToProfile = (
  insights: NoteRecommendationInsights,
): Profile => ({
  interests: unique([
    ...insights.interests,
    ...insights.photoTerms,
    ...insights.watchPlatforms,
  ]),
  moods: unique(insights.moods),
  favorites: unique([
    ...insights.favorites,
    ...insights.bookTitles,
    ...insights.watchTitles,
  ]),
  avoid: unique(insights.avoid),
});

const normalizeTitle = (value: string) =>
  value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export const titleAppearsInSignals = (
  title: string,
  signals: string[],
) => {
  const normalizedTitle = normalizeTitle(title);
  return signals.some((signal) => normalizeTitle(signal) === normalizedTitle);
};
