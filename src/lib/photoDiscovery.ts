import type { PhotoItem } from "../types";

type DiscoveryResponse = {
  source: string;
  query: string;
  items: unknown[];
};

const isHttpsUrl = (value: unknown) => {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const parsePhoto = (value: unknown): PhotoItem | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    !isHttpsUrl(item.url) ||
    !isHttpsUrl(item.sourceUrl) ||
    typeof item.creator !== "string" ||
    !Array.isArray(item.tags) ||
    !item.tags.every((tag) => typeof tag === "string") ||
    typeof item.reason !== "string"
  ) {
    return null;
  }
  return {
    id: item.id.slice(0, 120),
    title: item.title.slice(0, 180),
    url: item.url as string,
    sourceUrl: item.sourceUrl as string,
    creator: item.creator.slice(0, 180),
    tags: (item.tags as string[]).slice(0, 12),
    reason: item.reason.slice(0, 300),
    ...(typeof item.license === "string"
      ? { license: item.license.slice(0, 120) }
      : {}),
    ...(isHttpsUrl(item.licenseUrl)
      ? { licenseUrl: item.licenseUrl as string }
      : {}),
  };
};

export const discoverPhotos = async (
  query: string,
  signal?: AbortSignal,
): Promise<PhotoItem[]> => {
  const response = await fetch(
    `/api/discover/photos?q=${encodeURIComponent(query.trim())}`,
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
        : "Fresh photo discovery is unavailable.";
    throw new Error(message);
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    !Array.isArray((payload as DiscoveryResponse).items)
  ) {
    throw new Error("Photo discovery returned an invalid response.");
  }
  return (payload as DiscoveryResponse).items
    .map(parsePhoto)
    .filter((item): item is PhotoItem => Boolean(item));
};
