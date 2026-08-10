import type { WatchItem } from "../types";

export type TvDiscoveryResult = {
  items: WatchItem[];
  sources: string[];
  region: string;
  tmdbConfigured: boolean;
};

const isHttpsUrl = (value: unknown) => {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const cleanStringList = (value: unknown, maximum: number) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 100))
        .filter(Boolean)
        .slice(0, maximum)
    : [];

const parseWatchItem = (value: unknown): WatchItem | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    typeof item.year !== "string" ||
    !isHttpsUrl(item.artwork) ||
    !Array.isArray(item.genres) ||
    !item.genres.every((value) => typeof value === "string") ||
    !Array.isArray(item.moods) ||
    !item.moods.every((value) => typeof value === "string") ||
    typeof item.runtime !== "string" ||
    typeof item.description !== "string" ||
    item.kind !== "discover" ||
    !isHttpsUrl(item.sourceUrl)
  ) {
    return null;
  }
  const providerTypes = new Set([
    "subscription",
    "free",
    "with ads",
    "rent",
    "buy",
    "rent/buy",
    "network",
  ]);
  const platforms = cleanStringList(item.platforms, 12);
  const providers = Array.isArray(item.providers)
    ? item.providers.flatMap((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return [];
        }
        const provider = value as Record<string, unknown>;
        if (
          typeof provider.name !== "string" ||
          typeof provider.type !== "string" ||
          !providerTypes.has(provider.type)
        ) {
          return [];
        }
        const name = provider.name.trim().slice(0, 100);
        return name
          ? [
              {
                name,
                type: provider.type as NonNullable<
                  WatchItem["providers"]
                >[number]["type"],
              },
            ]
          : [];
      }).slice(0, 18)
    : [];
  const sourceLinks = Array.isArray(item.sourceLinks)
    ? item.sourceLinks.flatMap((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return [];
        }
        const link = value as Record<string, unknown>;
        if (typeof link.label !== "string" || !isHttpsUrl(link.url)) {
          return [];
        }
        const label = link.label.trim().slice(0, 80);
        return label
          ? [{ label, url: link.url as string }]
          : [];
      }).slice(0, 5)
    : [];
  return {
    id: item.id.slice(0, 120),
    title: item.title.slice(0, 240),
    year: item.year.slice(0, 12),
    artwork: item.artwork as string,
    genres: (item.genres as string[]).slice(0, 8),
    moods: (item.moods as string[]).slice(0, 8),
    runtime: item.runtime.slice(0, 60),
    description: item.description.slice(0, 520),
    kind: "discover",
    ...(item.mediaType === "movie" || item.mediaType === "series"
      ? { mediaType: item.mediaType }
      : {}),
    platforms,
    providers,
    sourceUrl: item.sourceUrl as string,
    sourceLabel:
      typeof item.sourceLabel === "string"
        ? item.sourceLabel.slice(0, 80)
        : "Open source",
    sourceLinks:
      sourceLinks.length > 0
        ? sourceLinks
        : [
            {
              label:
                typeof item.sourceLabel === "string"
                  ? item.sourceLabel.slice(0, 80)
                  : "Open source",
              url: item.sourceUrl as string,
            },
          ],
    providerAttribution:
      typeof item.providerAttribution === "string"
        ? item.providerAttribution.slice(0, 220)
        : undefined,
    ...(typeof item.rating === "number" &&
    Number.isFinite(item.rating) &&
    item.rating > 0 &&
    item.rating <= 5
      ? { rating: item.rating }
      : {}),
  };
};

export const discoverTv = async (
  query: string,
  signal?: AbortSignal,
): Promise<TvDiscoveryResult> => {
  const response = await fetch(
    `/api/discover/tv?q=${encodeURIComponent(query.trim())}`,
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
        : "Fresh TV discovery is unavailable.";
    throw new Error(message);
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    !Array.isArray((payload as { items?: unknown[] }).items)
  ) {
    throw new Error("TV discovery returned an invalid response.");
  }
  const responsePayload = payload as {
    items: unknown[];
    sources?: unknown;
    source?: unknown;
    region?: unknown;
    tmdbConfigured?: unknown;
  };
  const items = responsePayload.items
    .map(parseWatchItem)
    .filter((item): item is WatchItem => Boolean(item));
  const sources = cleanStringList(responsePayload.sources, 6);
  if (
    sources.length === 0 &&
    typeof responsePayload.source === "string" &&
    responsePayload.source.trim()
  ) {
    sources.push(responsePayload.source.trim().slice(0, 100));
  }
  return {
    items,
    sources,
    region:
      typeof responsePayload.region === "string" &&
      /^[A-Z]{2}$/.test(responsePayload.region)
        ? responsePayload.region
        : "US",
    tmdbConfigured: responsePayload.tmdbConfigured === true,
  };
};
