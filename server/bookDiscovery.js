const OPEN_LIBRARY_SEARCH = "https://openlibrary.org/search.json";
const CACHE_TTL_MS = 15 * 60 * 1_000;
const MAX_RESULTS = 8;

const cleanText = (value, maximum) =>
  typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";

const workId = (key) => {
  const match = String(key ?? "").match(/(?:\/works\/)?(OL\d+W)$/i);
  return match?.[1]?.toUpperCase() ?? null;
};

const firstSentence = (value) => {
  if (typeof value === "string") return cleanText(value, 420);
  if (Array.isArray(value)) {
    return cleanText(value.find((item) => typeof item === "string"), 420);
  }
  return "";
};

export const mapOpenLibraryResponse = (payload, _query) => {
  const docs = Array.isArray(payload?.docs) ? payload.docs : [];
  const seen = new Set();

  return docs.slice(0, 20).flatMap((doc) => {
    const id = workId(doc?.key);
    const title = cleanText(doc?.title, 240);
    const author = cleanText(doc?.author_name?.[0], 180);
    const coverId = Number.isInteger(doc?.cover_i) ? doc.cover_i : null;
    if (!id || !title || !author || !coverId) return [];
    const duplicateKey = `${title.toLowerCase()}|${author.toLowerCase()}`;
    if (seen.has(duplicateKey)) return [];
    seen.add(duplicateKey);

    const subjects = Array.isArray(doc.subject)
      ? [
          ...new Set(
            doc.subject
              .filter((subject) => typeof subject === "string")
              .map((subject) => cleanText(subject, 100).toLowerCase())
              .filter(Boolean),
          ),
        ].slice(0, 8)
      : [];
    const genres = subjects.slice(0, 3);
    const themes = subjects.slice(3, 9);
    const description =
      firstSentence(doc.first_sentence) ||
      `Open Library subjects: ${
        [...genres, ...themes].slice(0, 4).join(", ") || "literature"
      }.`;
    const rating =
      typeof doc.ratings_average === "number" &&
      doc.ratings_average >= 0 &&
      doc.ratings_average <= 5
        ? doc.ratings_average
        : undefined;

    return [
      {
        id: `openlibrary-${id.toLowerCase()}`,
        title,
        author,
        year:
          Number.isInteger(doc.first_publish_year)
            ? String(doc.first_publish_year)
            : "Unknown",
        cover: `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`,
        genres: genres.length ? genres : ["literature"],
        themes: themes.length ? themes : genres,
        description,
        ...(rating !== undefined ? { rating } : {}),
        kind: "discover",
        sourceUrl: `https://openlibrary.org/works/${id}`,
        sourceLabel: "Open Library",
      },
    ];
  }).slice(0, MAX_RESULTS);
};

export const createBookDiscoveryService = ({
  fetchImpl = globalThis.fetch,
  timeoutMs = 8_000,
} = {}) => {
  const cache = new Map();

  const search = async (query, requestSignal) => {
    const normalized = query.replace(/\s+/g, " ").trim().slice(0, 160);
    const cacheKey = normalized.toLowerCase();
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      return cached.items;
    }

    const url = new URL(OPEN_LIBRARY_SEARCH);
    url.search = new URLSearchParams({
      q: normalized,
      fields:
        "key,title,author_name,first_publish_year,cover_i,subject,ratings_average,first_sentence",
      limit: "16",
      lang: "en",
    }).toString();
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timer = setTimeout(abort, timeoutMs);
    requestSignal?.addEventListener("abort", abort, { once: true });
    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "MacDashboard/0.1 book-discovery",
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(`Open Library returned ${response.status}.`);
        error.status = response.status;
        throw error;
      }
      const items = mapOpenLibraryResponse(
        await response.json(),
        normalized,
      );
      cache.set(cacheKey, { createdAt: Date.now(), items });
      return items;
    } finally {
      clearTimeout(timer);
      requestSignal?.removeEventListener("abort", abort);
    }
  };

  return { search };
};
