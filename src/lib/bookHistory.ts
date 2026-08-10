export type BookHistoryEntry = {
  title: string;
  author?: string;
  rating?: number;
  readAt?: string;
  minutes?: number;
  shelves: string[];
  review?: string;
};

export type BookHistoryState = {
  fileName: string;
  entries: BookHistoryEntry[];
  importedAt: string;
};

const MAX_ENTRIES = 5_000;
const MAX_FILE_CHARACTERS = 5_000_000;

const normalizeHeader = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const parseCsvRow = (row: string) => {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === '"') {
      if (quoted && row[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current.trim());
  return values;
};

const normalizedDate = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

const normalizedRating = (value: unknown) => {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 5
    ? parsed
    : undefined;
};

const normalizedMinutes = (value: unknown) => {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 1_000_000
    ? parsed
    : undefined;
};

const normalizedShelves = (value: unknown) => {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;|]/)
      : [];
  return [
    ...new Set(
      values
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.replace(/\s+/g, " ").trim().toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, 20);
};

const normalizeEntry = (row: Record<string, unknown>) => {
  const title = row.title ?? row.bookTitle ?? row.name;
  if (typeof title !== "string" || !title.trim()) return null;
  const author = row.author ?? row.authorName ?? row.authors;
  const rating = normalizedRating(
    row.rating ?? row.myRating ?? row.userRating,
  );
  const readAt = normalizedDate(
    row.readAt ??
      row.dateRead ??
      row.finishedAt ??
      row.completedAt ??
      row.lastRead,
  );
  const minutes = normalizedMinutes(
    row.minutes ?? row.timeSpent ?? row.minutesRead,
  );
  const shelves = normalizedShelves(
    row.shelves ?? row.bookshelves ?? row.exclusiveShelf ?? row.genres,
  );
  const review = row.review ?? row.myReview ?? row.notes;
  return {
    title: title.replace(/\s+/g, " ").trim().slice(0, 240),
    ...(typeof author === "string" && author.trim()
      ? { author: author.replace(/\s+/g, " ").trim().slice(0, 180) }
      : {}),
    ...(rating !== undefined ? { rating } : {}),
    ...(readAt ? { readAt } : {}),
    ...(minutes !== undefined ? { minutes } : {}),
    shelves,
    ...(typeof review === "string" && review.trim()
      ? { review: review.replace(/\s+/g, " ").trim().slice(0, 1_000) }
      : {}),
  } satisfies BookHistoryEntry;
};

const csvRows = (text: string) => {
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map(parseCsvRow);
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  const aliases: Record<string, string> = {
    title: "title",
    booktitle: "bookTitle",
    name: "name",
    author: "author",
    authorlf: "author",
    authorname: "authorName",
    authors: "authors",
    myrating: "myRating",
    rating: "rating",
    userrating: "userRating",
    dateread: "dateRead",
    readat: "readAt",
    finishedat: "finishedAt",
    completedat: "completedAt",
    lastread: "lastRead",
    timespent: "timeSpent",
    minutes: "minutes",
    minutesread: "minutesRead",
    bookshelves: "bookshelves",
    exclusiveshelf: "exclusiveShelf",
    shelves: "shelves",
    shelf: "shelves",
    genres: "genres",
    myreview: "myReview",
    review: "review",
    notes: "notes",
  };
  return rows.slice(1).map((values) =>
    Object.fromEntries(
      headers.flatMap((header, index) => {
        const key = aliases[header];
        return key ? [[key, values[index] ?? ""]] : [];
      }),
    ),
  );
};

const jsonRows = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item),
    );
  }
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of ["books", "library", "history", "items", "records", "data"]) {
    const rows = jsonRows(record[key]);
    if (rows.length) return rows;
  }
  return [];
};

export const parseBookHistory = (text: string, fileName: string) => {
  if (text.length > MAX_FILE_CHARACTERS) {
    throw new Error("The selected reading-history export is too large.");
  }
  let rows: Record<string, unknown>[];
  try {
    rows =
      fileName.toLowerCase().endsWith(".json") || text.trim().startsWith("[")
        ? jsonRows(JSON.parse(text) as unknown)
        : csvRows(text);
  } catch {
    throw new Error("The selected file is not valid CSV or JSON.");
  }
  const entries = rows
    .map(normalizeEntry)
    .filter((entry): entry is BookHistoryEntry => Boolean(entry));
  if (!entries.length) {
    throw new Error("No recognizable reading-history rows were found.");
  }
  const seen = new Set<string>();
  return entries
    .filter((entry) => {
      const key = `${entry.title.toLowerCase()}|${entry.author?.toLowerCase() ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_ENTRIES);
};

const normalizedTitle = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const bookHistoryForTitle = (
  title: string,
  entries: BookHistoryEntry[],
) => {
  const target = normalizedTitle(title);
  return entries.find((entry) => normalizedTitle(entry.title) === target);
};

export const bookHistoryAffinity = (entries: BookHistoryEntry[]) => {
  const strong = entries.filter((entry) => (entry.rating ?? 0) >= 4);
  return [
    ...new Set(
      strong.flatMap((entry) => [
        ...(entry.author ? [entry.author.toLowerCase()] : []),
        ...entry.shelves,
      ]),
    ),
  ].slice(0, 30);
};
