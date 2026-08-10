export type ViewingHistoryEntry = {
  title: string;
  watchedAt?: string;
  source: "netflix" | "prime" | "import";
};

export type ViewingHistoryState = {
  fileName: string;
  entries: ViewingHistoryEntry[];
  importedAt: string;
};

const MAX_ENTRIES = 5_000;
const MAX_TITLE_LENGTH = 240;

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

const normalizeDate = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const normalizeEntry = (
  title: unknown,
  watchedAt: unknown,
  source: ViewingHistoryEntry["source"],
): ViewingHistoryEntry | null => {
  if (typeof title !== "string") return null;
  const cleanTitle = title.replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH);
  if (!cleanTitle) return null;
  const date = normalizeDate(watchedAt);
  return {
    title: cleanTitle,
    ...(date ? { watchedAt: date } : {}),
    source,
  };
};

const parseCsv = (text: string, source: ViewingHistoryEntry["source"]) => {
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map(parseCsvRow);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);
  const titleIndex = headers.findIndex((header) =>
    ["title", "videotitle", "name", "show"].includes(header),
  );
  const dateIndex = headers.findIndex((header) =>
    ["date", "watchedat", "watchdate", "datewatched", "lastwatched"].includes(
      header,
    ),
  );
  if (titleIndex < 0) return [];

  return rows
    .slice(1)
    .flatMap((row) => {
      const entry = normalizeEntry(
        row[titleIndex],
        dateIndex >= 0 ? row[dateIndex] : undefined,
        source,
      );
      return entry ? [entry] : [];
    });
};

const findJsonRows = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item),
    );
  }
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of ["history", "watchHistory", "items", "records", "data"]) {
    const rows = findJsonRows(record[key]);
    if (rows.length) return rows;
  }
  return [];
};

const parseJson = (text: string, source: ViewingHistoryEntry["source"]) => {
  const rows = findJsonRows(JSON.parse(text) as unknown);
  return rows.flatMap((row) => {
    const title =
      row.title ?? row.videoTitle ?? row.name ?? row.show ?? row.seriesTitle;
    const date =
      row.watchedAt ??
      row.watchDate ??
      row.date ??
      row.dateWatched ??
      row.lastWatched;
    const entry = normalizeEntry(title, date, source);
    return entry ? [entry] : [];
  });
};

export const parseViewingHistory = (text: string, fileName: string) => {
  if (text.length > 5_000_000) {
    throw new Error("The selected history export is too large.");
  }
  const lowerName = fileName.toLowerCase();
  const source: ViewingHistoryEntry["source"] = lowerName.includes("netflix")
    ? "netflix"
    : lowerName.includes("prime") || lowerName.includes("amazon")
      ? "prime"
      : "import";

  let entries: ViewingHistoryEntry[];
  try {
    entries =
      lowerName.endsWith(".json") || text.trim().startsWith("[")
        ? parseJson(text, source)
        : parseCsv(text, source);
  } catch {
    throw new Error("The selected file is not valid CSV or JSON history.");
  }
  if (!entries.length) {
    throw new Error("No recognizable viewing-history rows were found.");
  }

  const seen = new Set<string>();
  return entries
    .filter((entry) => {
      const key = `${entry.title.toLowerCase()}|${entry.watchedAt ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_ENTRIES);
};

const normalizeTitle = (title: string) =>
  title
    .toLowerCase()
    .split(":")[0]
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const wasWatched = (
  title: string,
  history: ViewingHistoryEntry[],
) => {
  const target = normalizeTitle(title);
  return history.some((entry) => {
    const candidate = normalizeTitle(entry.title);
    return (
      candidate === target ||
      candidate.includes(target) ||
      target.includes(candidate)
    );
  });
};

export const latestWatchFor = (
  title: string,
  history: ViewingHistoryEntry[],
) => {
  const target = normalizeTitle(title);
  return history
    .filter((entry) => {
      const candidate = normalizeTitle(entry.title);
      return (
        candidate === target ||
        candidate.includes(target) ||
        target.includes(candidate)
      );
    })
    .map((entry) => entry.watchedAt)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);
};
