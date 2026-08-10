import type { Book } from "../types";

const isHttpsUrl = (value: unknown) => {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const parseBook = (value: unknown): Book | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    typeof item.author !== "string" ||
    typeof item.year !== "string" ||
    !isHttpsUrl(item.cover) ||
    !Array.isArray(item.genres) ||
    !item.genres.every((value) => typeof value === "string") ||
    !Array.isArray(item.themes) ||
    !item.themes.every((value) => typeof value === "string") ||
    typeof item.description !== "string" ||
    item.kind !== "discover" ||
    !isHttpsUrl(item.sourceUrl)
  ) {
    return null;
  }
  const rating =
    typeof item.rating === "number" &&
    Number.isFinite(item.rating) &&
    item.rating >= 0 &&
    item.rating <= 5
      ? item.rating
      : undefined;
  return {
    id: item.id.slice(0, 120),
    title: item.title.slice(0, 240),
    author: item.author.slice(0, 180),
    year: item.year.slice(0, 12),
    cover: item.cover as string,
    genres: (item.genres as string[]).slice(0, 10),
    themes: (item.themes as string[]).slice(0, 10),
    description: item.description.slice(0, 500),
    ...(rating !== undefined ? { rating } : {}),
    kind: "discover",
    sourceUrl: item.sourceUrl as string,
    sourceLabel:
      typeof item.sourceLabel === "string"
        ? item.sourceLabel.slice(0, 80)
        : "Open Library",
  };
};

export const discoverBooks = async (
  query: string,
  signal?: AbortSignal,
): Promise<Book[]> => {
  const response = await fetch(
    `/api/discover/books?q=${encodeURIComponent(query.trim())}`,
    {
      headers: { Accept: "application/json" },
      signal,
    },
  );
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      typeof (payload as Record<string, unknown>).error === "string"
        ? String((payload as Record<string, unknown>).error)
        : "Fresh book discovery is unavailable.";
    throw new Error(message);
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    !Array.isArray((payload as { items?: unknown[] }).items)
  ) {
    throw new Error("Book discovery returned an invalid response.");
  }
  return ((payload as { items: unknown[] }).items)
    .map(parseBook)
    .filter((item): item is Book => Boolean(item));
};
