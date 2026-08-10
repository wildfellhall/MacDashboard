const APPLE_SEARCH = "https://itunes.apple.com/search";
const TVMAZE_SEARCH = "https://api.tvmaze.com/search/shows";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_SITE = "https://www.themoviedb.org";
const CACHE_TTL_MS = 30 * 60 * 1_000;
const MAX_RESULTS = 18;
const TMDB_DETAIL_LIMIT = 8;

const TMDB_MOVIE_GENRES = {
  12: "adventure",
  14: "fantasy",
  16: "animation",
  18: "drama",
  27: "horror",
  28: "action",
  35: "comedy",
  36: "history",
  37: "western",
  53: "thriller",
  80: "crime",
  99: "documentary",
  878: "science fiction",
  9648: "mystery",
  10402: "music",
  10749: "romance",
  10751: "family",
  10752: "war",
  10770: "tv movie",
};

const TMDB_TV_GENRES = {
  16: "animation",
  18: "drama",
  35: "comedy",
  37: "western",
  80: "crime",
  99: "documentary",
  9648: "mystery",
  10751: "family",
  10759: "action & adventure",
  10762: "kids",
  10763: "news",
  10764: "reality",
  10765: "sci-fi & fantasy",
  10766: "soap",
  10767: "talk",
  10768: "war & politics",
};

const cleanText = (value, maximum) =>
  typeof value === "string"
    ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";

const httpsUrl = (value) => {
  const cleaned = cleanText(value, 1_000);
  if (!cleaned) return null;
  try {
    const url = new URL(cleaned);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
};

const largerArtwork = (value) => {
  const url = httpsUrl(value);
  if (!url) return null;
  return url
    .replace(/\/\d+x\d+bb\./i, "/600x600bb.")
    .replace(/\.\d+x\d+-\d+\./i, ".600x600-75.");
};

const yearFor = (value) => {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    String(value).trim() === ""
  ) {
    return "Unknown";
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? String(date.getUTCFullYear())
    : "Unknown";
};

const runtimeFor = (milliseconds, kind) => {
  if (typeof milliseconds !== "number" || !Number.isFinite(milliseconds)) {
    return kind === "show" ? "TV series" : "Feature";
  }
  const minutes = Math.max(1, Math.round(milliseconds / 60_000));
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours > 0
    ? `${hours} hr${remaining ? ` ${remaining} min` : ""}`
    : `${minutes} min`;
};

const minuteRuntime = (minutes, mediaType) => {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) {
    return mediaType === "series" ? "TV series" : "Feature";
  }
  const rounded = Math.round(minutes);
  if (mediaType === "series") return `${rounded} min episodes`;
  const hours = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  return hours > 0
    ? `${hours} hr${remaining ? ` ${remaining} min` : ""}`
    : `${rounded} min`;
};

const inferMoods = (...values) => {
  const text = values.join(" ").toLowerCase();
  const vocabulary = [
    "atmospheric",
    "bittersweet",
    "contemplative",
    "dark",
    "dreamlike",
    "funny",
    "gentle",
    "hopeful",
    "intimate",
    "mysterious",
    "playful",
    "quiet",
    "romantic",
    "tense",
    "warm",
  ];
  return vocabulary.filter((mood) => text.includes(mood)).slice(0, 6);
};

const uniqueStrings = (values, maximum = 12) => {
  const seen = new Set();
  return values.flatMap((value) => {
    const cleaned = cleanText(value, 100);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key) || seen.size >= maximum) return [];
    seen.add(key);
    return [cleaned];
  });
};

const normalizeSearchText = (value) =>
  cleanText(value, 260)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const titleRelevance = (item, query) => {
  const title = normalizeSearchText(item.title);
  const search = normalizeSearchText(query);
  if (!title || !search) return 0;
  if (title === search) return 100;
  if (search.startsWith(title) || title.startsWith(search)) return 82;
  if (search.includes(title) || title.includes(search)) return 72;
  const titleWords = new Set(title.split(" "));
  const searchWords = new Set(search.split(" "));
  const shared = [...titleWords].filter((word) => searchWords.has(word)).length;
  return (shared / Math.max(titleWords.size, searchWords.size)) * 60;
};

const sourceLink = (label, url) => {
  const safeLabel = cleanText(label, 80);
  const safeUrl = httpsUrl(url);
  return safeLabel && safeUrl ? { label: safeLabel, url: safeUrl } : null;
};

export const mapAppleSearchResponse = (
  payload,
  _query,
  media,
  region = "US",
) => {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const seen = new Set();

  return results.flatMap((item) => {
    const isMovie =
      media === "movie" &&
      item?.kind === "feature-movie" &&
      Number.isSafeInteger(item?.trackId);
    const isShow =
      media === "tvShow" &&
      Number.isSafeInteger(item?.collectionId) &&
      cleanText(item?.collectionName, 240);
    if (!isMovie && !isShow) return [];

    const idValue = isMovie ? item.trackId : item.collectionId;
    const rawTitle = cleanText(
      isMovie ? item.trackName : item.collectionName,
      240,
    );
    const title = isShow
      ? rawTitle
          .replace(
            /\s*(?:,|[-–—:])?\s*(?:season|series)\s+\d+\s*$/i,
            "",
          )
          .trim()
      : rawTitle;
    const artwork = largerArtwork(item.artworkUrl100);
    const sourceUrl = httpsUrl(
      isMovie ? item.trackViewUrl : item.collectionViewUrl,
    );
    if (!title || !artwork || !sourceUrl) return [];
    const duplicateKey = title.toLowerCase();
    if (seen.has(duplicateKey)) return [];
    seen.add(duplicateKey);

    const genre =
      cleanText(item.primaryGenreName, 100).toLowerCase() ||
      (isMovie ? "movie" : "television");
    const description =
      cleanText(
        item.longDescription ||
          item.description ||
          item.shortDescription,
        520,
      ) ||
      "Description unavailable from Apple Search.";
    const appleLink = sourceLink("View on Apple TV", sourceUrl);
    const justWatchUrl = new URL(
      `https://www.justwatch.com/${region.toLowerCase()}/search`,
    );
    justWatchUrl.searchParams.set("q", title);
    const comparisonLink = sourceLink(
      "Compare streaming services",
      justWatchUrl.toString(),
    );

    return [
      {
        id: `apple-${isMovie ? "movie" : "tv"}-${idValue}`,
        title,
        year: yearFor(item.releaseDate),
        artwork,
        genres: [genre, isMovie ? "movie" : "television"],
        moods: inferMoods(description, genre),
        runtime: runtimeFor(item.trackTimeMillis, isMovie ? "movie" : "show"),
        description,
        kind: "discover",
        mediaType: isMovie ? "movie" : "series",
        platforms: ["Apple TV Store"],
        providers: [{ name: "Apple TV Store", type: "rent/buy" }],
        sourceUrl,
        sourceLabel: "View on Apple TV",
        sourceLinks: [appleLink, comparisonLink].filter(Boolean),
        providerAttribution: "Catalog data from Apple Search",
      },
    ];
  });
};

export const mapTvmazeSearchResponse = (payload, _query) => {
  if (!Array.isArray(payload)) return [];
  const seen = new Set();

  return payload.flatMap((match) => {
    const show = match?.show;
    if (!Number.isSafeInteger(show?.id)) return [];
    const title = cleanText(show.name, 240);
    const artwork = httpsUrl(show.image?.original || show.image?.medium);
    const sourceUrl = httpsUrl(show.url);
    if (!title || !artwork || !sourceUrl) return [];
    const key = title.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);

    const platform = cleanText(
      show.webChannel?.name || show.network?.name,
      100,
    );
    const runtime =
      typeof show.averageRuntime === "number"
        ? show.averageRuntime
        : show.runtime;
    const officialSite = httpsUrl(show.officialSite);
    const links = [
      sourceLink("View on TVmaze", sourceUrl),
      officialSite
        ? sourceLink(
            platform ? `Open ${platform}` : "Official site",
            officialSite,
          )
        : null,
    ].filter(Boolean);
    const genres = uniqueStrings(
      [
        ...(Array.isArray(show.genres)
          ? show.genres.map((genre) => cleanText(genre, 100).toLowerCase())
          : []),
        cleanText(show.type, 80).toLowerCase(),
        "television",
      ],
      8,
    );

    const description =
      cleanText(show.summary, 520) ||
      "Description unavailable from TVmaze.";
    return [
      {
        id: `tvmaze-${show.id}`,
        title,
        year: yearFor(show.premiered),
        artwork,
        genres,
        moods: inferMoods(description, ...genres),
        runtime: minuteRuntime(runtime, "series"),
        description,
        kind: "discover",
        mediaType: "series",
        platforms: platform ? [platform] : [],
        providers: platform
          ? [
              {
                name: platform,
                type: show.webChannel ? "subscription" : "network",
              },
            ]
          : [],
        sourceUrl,
        sourceLabel: "View on TVmaze",
        sourceLinks: links,
        providerAttribution: "Series data from TVmaze · CC BY-SA",
      },
    ];
  });
};

const tmdbGenreNames = (mediaType, item, detail) => {
  if (Array.isArray(detail?.genres)) {
    const detailed = detail.genres
      .map((genre) => cleanText(genre?.name, 100).toLowerCase())
      .filter(Boolean);
    if (detailed.length) return detailed.slice(0, 8);
  }
  const genreMap =
    mediaType === "movie" ? TMDB_MOVIE_GENRES : TMDB_TV_GENRES;
  return Array.isArray(item?.genre_ids)
    ? item.genre_ids
        .map((id) => genreMap[id])
        .filter(Boolean)
        .slice(0, 8)
    : [];
};

const tmdbProviders = (bucket) => {
  const groups = [
    ["flatrate", "subscription"],
    ["free", "free"],
    ["ads", "with ads"],
    ["rent", "rent"],
    ["buy", "buy"],
  ];
  const seen = new Set();
  return groups.flatMap(([key, type]) => {
    const values = Array.isArray(bucket?.[key]) ? bucket[key] : [];
    return values.flatMap((provider) => {
      const name = cleanText(provider?.provider_name, 100);
      const duplicateKey = `${name.toLowerCase()}|${type}`;
      if (!name || seen.has(duplicateKey) || seen.size >= 18) return [];
      seen.add(duplicateKey);
      return [{ name, type }];
    });
  });
};

export const mapTmdbSearchResult = (
  item,
  detail,
  _query,
  region = "US",
) => {
  const mediaType =
    item?.media_type === "movie"
      ? "movie"
      : item?.media_type === "tv"
        ? "series"
        : null;
  if (!mediaType || !Number.isSafeInteger(item?.id) || item?.adult === true) {
    return null;
  }
  const title = cleanText(
    mediaType === "movie" ? item.title : item.name,
    240,
  );
  const imagePath =
    cleanText(detail?.backdrop_path || item.backdrop_path, 240) ||
    cleanText(detail?.poster_path || item.poster_path, 240);
  const artwork = imagePath
    ? httpsUrl(`https://image.tmdb.org/t/p/w1280${imagePath}`)
    : null;
  if (!title || !artwork) return null;

  const normalizedRegion = /^[A-Z]{2}$/.test(region) ? region : "US";
  const availability =
    detail?.["watch/providers"]?.results?.[normalizedRegion] ?? null;
  const providers = tmdbProviders(availability);
  const platforms = uniqueStrings(
    providers.map((provider) => provider.name),
    12,
  );
  const sourceUrl = httpsUrl(
    `${TMDB_SITE}/${mediaType === "movie" ? "movie" : "tv"}/${item.id}`,
  );
  const availabilityUrl = httpsUrl(availability?.link);
  const sourceLinks = [
    availabilityUrl
      ? sourceLink(`Where to watch in ${normalizedRegion}`, availabilityUrl)
      : null,
    sourceLink("View on TMDB", sourceUrl),
  ].filter(Boolean);
  const runtime =
    mediaType === "movie"
      ? detail?.runtime
      : detail?.episode_run_time?.[0] ??
        detail?.last_episode_to_air?.runtime;
  const ratingValue =
    typeof item.vote_average === "number" && item.vote_average > 0
      ? Math.round((item.vote_average / 2) * 10) / 10
      : undefined;

  return {
    id: `tmdb-${mediaType}-${item.id}`,
    title,
    year: yearFor(
      mediaType === "movie" ? item.release_date : item.first_air_date,
    ),
    artwork,
    genres: uniqueStrings(
      [...tmdbGenreNames(mediaType, item, detail), mediaType],
      8,
    ),
    moods: inferMoods(
      cleanText(detail?.overview || item.overview, 520),
      ...tmdbGenreNames(mediaType, item, detail),
    ),
    runtime: minuteRuntime(runtime, mediaType),
    description:
      cleanText(detail?.overview || item.overview, 520) ||
      "Description unavailable from TMDB.",
    kind: "discover",
    mediaType,
    platforms,
    providers,
    ...(ratingValue ? { rating: ratingValue } : {}),
    sourceUrl,
    sourceLabel: availabilityUrl ? "Check streaming options" : "View on TMDB",
    sourceLinks,
    providerAttribution: platforms.length
      ? "Streaming availability by JustWatch · Title data from TMDB"
      : "Title data from TMDB",
  };
};

const mergeDiscoveredItems = (groups, query) => {
  const merged = new Map();
  for (const item of groups.flat()) {
    const key = `${item.mediaType ?? "title"}:${item.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, item);
      continue;
    }
    const itemProviderCount = item.providers?.length ?? 0;
    const currentProviderCount = current.providers?.length ?? 0;
    const primary = itemProviderCount > currentProviderCount ? item : current;
    const secondary = primary === item ? current : item;
    const sourceLinks = [
      ...(primary.sourceLinks ?? []),
      ...(secondary.sourceLinks ?? []),
    ].filter(
      (link, index, links) =>
        links.findIndex(
          (candidate) =>
            candidate.url === link.url && candidate.label === link.label,
        ) === index,
    );
    const providers = [
      ...(primary.providers ?? []),
      ...(secondary.providers ?? []),
    ].filter(
      (provider, index, values) =>
        values.findIndex(
          (candidate) =>
            candidate.name.toLowerCase() === provider.name.toLowerCase() &&
            candidate.type === provider.type,
        ) === index,
    );
    merged.set(key, {
      ...primary,
      genres: uniqueStrings(
        [...primary.genres, ...secondary.genres],
        8,
      ),
      moods: uniqueStrings([...primary.moods, ...secondary.moods], 8),
      platforms: uniqueStrings(
        [...(primary.platforms ?? []), ...(secondary.platforms ?? [])],
        12,
      ),
      providers,
      sourceLinks: sourceLinks.slice(0, 5),
      providerAttribution: uniqueStrings(
        [primary.providerAttribution, secondary.providerAttribution],
        3,
      ).join(" · "),
    });
  }
  return [...merged.values()]
    .sort(
      (left, right) =>
        titleRelevance(right, query) - titleRelevance(left, query) ||
        (right.providers?.length ?? 0) - (left.providers?.length ?? 0) ||
        (right.rating ?? 0) - (left.rating ?? 0),
    )
    .slice(0, MAX_RESULTS);
};

export const createTvDiscoveryService = ({
  fetchImpl = globalThis.fetch,
  timeoutMs = 8_000,
  tmdbToken = process.env.TMDB_READ_ACCESS_TOKEN ?? "",
  region = process.env.TMDB_REGION ?? "US",
} = {}) => {
  const cache = new Map();
  const safeTmdbToken = cleanText(tmdbToken, 1_000);
  const safeRegion = /^[A-Za-z]{2}$/.test(region)
    ? region.toUpperCase()
    : "US";
  const tmdbConfigured = Boolean(safeTmdbToken);

  const requestJson = async (url, signal, headers = {}) => {
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MacDashboard/0.1 tv-discovery",
        ...headers,
      },
      signal,
    });
    if (!response.ok) {
      const error = new Error(
        `${new URL(url).hostname} returned ${response.status}.`,
      );
      error.status = response.status;
      throw error;
    }
    return response.json();
  };

  const searchAppleMedia = async (query, media, signal) => {
    const url = new URL(APPLE_SEARCH);
    url.search = new URLSearchParams({
      term: query,
      country: safeRegion,
      media,
      entity: media === "movie" ? "movie" : "tvSeason",
      limit: "8",
      lang: "en_us",
      explicit: "No",
    }).toString();
    return mapAppleSearchResponse(
      await requestJson(url, signal),
      query,
      media,
      safeRegion,
    );
  };

  const searchTvmaze = async (query, signal) => {
    const url = new URL(TVMAZE_SEARCH);
    url.search = new URLSearchParams({ q: query }).toString();
    return mapTvmazeSearchResponse(
      await requestJson(url, signal),
      query,
    );
  };

  const tmdbRequest = async (path, parameters, signal) => {
    const url = new URL(`${TMDB_API}${path}`);
    url.search = new URLSearchParams(parameters).toString();
    return requestJson(url, signal, {
      Authorization: `Bearer ${safeTmdbToken}`,
    });
  };

  const searchTmdb = async (query, signal) => {
    const payload = await tmdbRequest(
      "/search/multi",
      {
        query,
        include_adult: "false",
        language: "en-US",
        page: "1",
      },
      signal,
    );
    const candidates = (Array.isArray(payload?.results) ? payload.results : [])
      .filter(
        (item) =>
          (item?.media_type === "movie" || item?.media_type === "tv") &&
          item?.adult !== true,
      )
      .slice(0, TMDB_DETAIL_LIMIT);
    const detailed = await Promise.allSettled(
      candidates.map(async (item) => {
        const path =
          item.media_type === "movie"
            ? `/movie/${item.id}`
            : `/tv/${item.id}`;
        return tmdbRequest(
          path,
          {
            append_to_response: "watch/providers",
            language: "en-US",
          },
          signal,
        );
      }),
    );
    return candidates.flatMap((item, index) => {
      const result = detailed[index];
      const mapped = mapTmdbSearchResult(
        item,
        result?.status === "fulfilled" ? result.value : null,
        query,
        safeRegion,
      );
      return mapped ? [mapped] : [];
    });
  };

  const search = async (query, requestSignal) => {
    const normalized = query.replace(/\s+/g, " ").trim().slice(0, 120);
    const cacheKey = `${safeRegion}:${normalized.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      return cached.items;
    }

    const controller = new AbortController();
    const abort = () => controller.abort();
    const timer = setTimeout(abort, timeoutMs);
    requestSignal?.addEventListener("abort", abort, { once: true });
    try {
      const searches = [
        searchAppleMedia(normalized, "movie", controller.signal),
        searchAppleMedia(normalized, "tvShow", controller.signal),
        searchTvmaze(normalized, controller.signal),
        ...(tmdbConfigured
          ? [searchTmdb(normalized, controller.signal)]
          : []),
      ];
      const settled = await Promise.allSettled(searches);
      const successful = settled.flatMap((result, index) =>
        result.status === "fulfilled"
          ? [{ index, items: result.value }]
          : [],
      );
      if (!successful.length) {
        throw new AggregateError(
          settled.flatMap((result) =>
            result.status === "rejected" ? [result.reason] : [],
          ),
          "All TV discovery sources were unavailable.",
        );
      }
      const preferredGroups = tmdbConfigured
        ? [
            ...successful
              .filter(({ index }) => index === 3)
              .map(({ items }) => items),
            ...successful
              .filter(({ index }) => index !== 3)
              .reverse()
              .map(({ items }) => items),
          ]
        : successful.reverse().map(({ items }) => items);
      const items = mergeDiscoveredItems(
        preferredGroups,
        normalized,
      );
      cache.set(cacheKey, { createdAt: Date.now(), items });
      return items;
    } finally {
      clearTimeout(timer);
      requestSignal?.removeEventListener("abort", abort);
    }
  };

  return {
    search,
    sources: [
      "Apple Search",
      "TVmaze",
      ...(tmdbConfigured ? ["TMDB"] : []),
    ],
    region: safeRegion,
    tmdbConfigured,
  };
};
