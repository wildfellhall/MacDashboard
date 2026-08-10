const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const OPENVERSE_API = "https://api.openverse.org/v1/images/";
const ARTIC_SEARCH =
  "https://api.artic.edu/api/v1/artworks/search";
const MET_SEARCH =
  "https://collectionapi.metmuseum.org/public/collection/v1/search";
const MET_OBJECT =
  "https://collectionapi.metmuseum.org/public/collection/v1/objects";
const CACHE_TTL_MS = 15 * 60 * 1_000;
const MAX_RESULTS = 8;
const MAX_COMBINED_RESULTS = 20;
const MAX_MET_DETAILS = 5;

const stripHtml = (value = "") =>
  String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

const safeHttpsUrl = (value, allowedHosts) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      allowedHosts.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

const safeExternalHttpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

const metadataValue = (metadata, key) =>
  metadata?.[key] && typeof metadata[key].value === "string"
    ? metadata[key].value
    : "";

const titleFromFile = (title = "") =>
  title
    .replace(/^File:/i, "")
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

export const mapCommonsResponse = (payload, query) => {
  const pages = Array.isArray(payload?.query?.pages)
    ? payload.query.pages
    : Object.values(payload?.query?.pages ?? {});
  const queryTags = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((tag) => tag.length > 2)
    .slice(0, 8);

  return pages.slice(0, MAX_RESULTS).flatMap((page) => {
    const info = page?.imageinfo?.[0];
    if (!info) return [];
    const url = safeHttpsUrl(info.thumburl || info.url, [
      "wikimedia.org",
      "wikipedia.org",
    ]);
    const sourceUrl = safeHttpsUrl(info.descriptionurl, [
      "commons.wikimedia.org",
    ]);
    if (!url || !sourceUrl) return [];

    const metadata = info.extmetadata;
    const creator =
      stripHtml(metadataValue(metadata, "Artist")) ||
      (typeof info.user === "string" ? info.user : "") ||
      "Wikimedia Commons contributor";
    const license =
      stripHtml(metadataValue(metadata, "LicenseShortName")) ||
      "See source for license";
    const licenseUrl = safeHttpsUrl(
      metadataValue(metadata, "LicenseUrl"),
      ["creativecommons.org", "wikimedia.org"],
    );
    const description = stripHtml(
      metadataValue(metadata, "ImageDescription"),
    );
    const title =
      titleFromFile(page.title) || description.slice(0, 180) || "Commons image";

    return [
      {
        id: `commons-${page.pageid}`,
        title,
        url,
        sourceUrl,
        creator: creator.slice(0, 180),
        tags: [...new Set([...queryTags, "wikimedia commons"])],
        reason: `Found through Wikimedia Commons for “${query}”.`,
        license: license.slice(0, 120),
        ...(licenseUrl ? { licenseUrl } : {}),
      },
    ];
  });
};

const openverseLicense = (item) => {
  const code =
    typeof item?.license === "string" ? item.license.toLowerCase() : "";
  const version =
    typeof item?.license_version === "string" ? item.license_version : "";
  if (code === "pdm") return "Public Domain Mark";
  if (code === "cc0") return `CC0${version ? ` ${version}` : ""}`;
  return code
    ? `CC ${code.toUpperCase()}${version ? ` ${version}` : ""}`
    : "See source for license";
};

export const mapOpenverseResponse = (payload, query) => {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const queryTags = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((tag) => tag.length > 2)
    .slice(0, 8);

  return results.slice(0, MAX_RESULTS).flatMap((item) => {
    if (item?.mature === true || typeof item?.id !== "string") return [];
    const url =
      safeHttpsUrl(item.thumbnail, ["api.openverse.org"]) ||
      safeExternalHttpsUrl(item.url);
    const sourceUrl = safeExternalHttpsUrl(item.foreign_landing_url);
    if (!url || !sourceUrl) return [];

    const sourceTags = Array.isArray(item.tags)
      ? item.tags
          .map((tag) =>
            typeof tag?.name === "string"
              ? stripHtml(tag.name).toLowerCase()
              : "",
          )
          .filter((tag) => tag.length > 2 && tag.length <= 40)
          .slice(0, 8)
      : [];
    const creator =
      (typeof item.creator === "string" && stripHtml(item.creator)) ||
      "Openverse contributor";
    const title =
      (typeof item.title === "string" && stripHtml(item.title)) ||
      `${creator}'s image`;
    const licenseUrl = safeHttpsUrl(item.license_url, [
      "creativecommons.org",
    ]);
    const source =
      typeof item.source === "string" && item.source.trim()
        ? item.source.trim()
        : "open collection";

    return [
      {
        id: `openverse-${item.id}`.slice(0, 120),
        title: title.slice(0, 180),
        url,
        sourceUrl,
        creator: creator.slice(0, 180),
        tags: [
          ...new Set([...queryTags, ...sourceTags, "openverse"]),
        ].slice(0, 12),
        reason: `Openly licensed image found through Openverse for “${query}” from ${source}.`,
        license: openverseLicense(item).slice(0, 120),
        ...(licenseUrl ? { licenseUrl } : {}),
      },
    ];
  });
};

export const mapArtInstituteResponse = (payload, query) => {
  const results = Array.isArray(payload?.data) ? payload.data : [];
  const iiifBase = safeHttpsUrl(payload?.config?.iiif_url, ["artic.edu"]);
  if (!iiifBase) return [];
  const queryTags = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((tag) => tag.length > 2)
    .slice(0, 8);

  return results.slice(0, MAX_RESULTS).flatMap((item) => {
    if (
      !Number.isSafeInteger(item?.id) ||
      item?.is_public_domain !== true ||
      typeof item?.image_id !== "string"
    ) {
      return [];
    }
    const imageId = item.image_id.trim();
    const url = safeHttpsUrl(
      `${iiifBase.replace(/\/$/, "")}/${encodeURIComponent(
        imageId,
      )}/full/843,/0/default.jpg`,
      ["artic.edu"],
    );
    const sourceUrl = safeHttpsUrl(
      `https://www.artic.edu/artworks/${item.id}`,
      ["artic.edu"],
    );
    if (!url || !sourceUrl) return [];

    const title =
      stripHtml(item.title) || `Art Institute artwork ${item.id}`;
    const artist =
      stripHtml(item.artist_title || item.artist_display) ||
      "Unknown artist";
    const metadataTags = [
      item.classification_title,
      item.medium_display,
      item.date_display,
    ]
      .map((value) => stripHtml(value).toLowerCase())
      .filter((value) => value.length > 2 && value.length <= 80);

    return [
      {
        id: `artic-${item.id}`,
        title: title.slice(0, 180),
        url,
        sourceUrl,
        creator: `${artist} · Art Institute of Chicago`.slice(0, 180),
        tags: [
          ...new Set([
            ...queryTags,
            ...metadataTags,
            "art institute of chicago",
            "public domain art",
          ]),
        ].slice(0, 12),
        reason: `Public-domain image found through the Art Institute of Chicago for “${query}”.`,
        license: "Public Domain",
        licenseUrl: "https://www.artic.edu/image-licensing",
      },
    ];
  });
};

export const mapMetObject = (item, query) => {
  if (
    !Number.isSafeInteger(item?.objectID) ||
    item?.isPublicDomain !== true
  ) {
    return null;
  }
  const url = safeHttpsUrl(
    item.primaryImageSmall || item.primaryImage,
    ["metmuseum.org"],
  );
  const sourceUrl = safeHttpsUrl(item.objectURL, ["metmuseum.org"]);
  if (!url || !sourceUrl) return null;

  const queryTags = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((tag) => tag.length > 2)
    .slice(0, 8);
  const objectTags = Array.isArray(item.tags)
    ? item.tags
        .map((tag) => stripHtml(tag?.term).toLowerCase())
        .filter((tag) => tag.length > 2 && tag.length <= 60)
        .slice(0, 6)
    : [];
  const metadataTags = [
    item.objectName,
    item.classification,
    item.department,
    item.culture,
  ]
    .map((value) => stripHtml(value).toLowerCase())
    .filter((value) => value.length > 2 && value.length <= 80);
  const artist =
    stripHtml(item.artistDisplayName || item.culture) || "Unknown artist";

  return {
    id: `met-${item.objectID}`,
    title: (stripHtml(item.title) || `The Met object ${item.objectID}`).slice(
      0,
      180,
    ),
    url,
    sourceUrl,
    creator: `${artist} · The Metropolitan Museum of Art`.slice(0, 180),
    tags: [
      ...new Set([
        ...queryTags,
        ...objectTags,
        ...metadataTags,
        "the met",
        "public domain art",
      ]),
    ].slice(0, 12),
    reason: `Public-domain image found through The Met Open Access collection for “${query}”.`,
    license: "Public Domain · The Met Open Access",
    licenseUrl:
      "https://www.metmuseum.org/about-the-met/policies-and-documents/open-access",
  };
};

const interleaveResults = (groups) => {
  const combined = [];
  const seen = new Set();
  const longest = Math.max(0, ...groups.map((group) => group.length));
  for (let index = 0; index < longest; index += 1) {
    for (const group of groups) {
      const item = group[index];
      if (!item) continue;
      const key = `${item.sourceUrl}|${item.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      combined.push(item);
      if (combined.length >= MAX_COMBINED_RESULTS) return combined;
    }
  }
  return combined;
};

export const createPhotoDiscoveryService = ({
  fetchImpl = globalThis.fetch,
  timeoutMs = 8_000,
} = {}) => {
  const cache = new Map();

  const fetchJson = async (url, signal, provider) => {
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "Api-User-Agent": "MacDashboard/0.1 photo-discovery",
        "User-Agent": "MacDashboard/0.1 photo-discovery",
      },
      signal,
    });
    if (!response.ok) {
      const error = new Error(`${provider} returned ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  };

  const searchMet = async (query, signal) => {
    const searchUrl = new URL(MET_SEARCH);
    searchUrl.search = new URLSearchParams({
      q: query,
      hasImages: "true",
    }).toString();
    const payload = await fetchJson(searchUrl, signal, "The Met");
    const ids = (Array.isArray(payload?.objectIDs) ? payload.objectIDs : [])
      .filter((id) => Number.isSafeInteger(id))
      .slice(0, MAX_MET_DETAILS);
    const details = await Promise.allSettled(
      ids.map((id) =>
        fetchJson(
          new URL(`${MET_OBJECT}/${id}`),
          signal,
          "The Met",
        ),
      ),
    );
    return details.flatMap((result) => {
      if (result.status !== "fulfilled") return [];
      const mapped = mapMetObject(result.value, query);
      return mapped ? [mapped] : [];
    });
  };

  const search = async (query, requestSignal) => {
    const normalized = query.replace(/\s+/g, " ").trim().slice(0, 160);
    const cached = cache.get(normalized.toLowerCase());
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      return cached.items;
    }

    const openverseUrl = new URL(OPENVERSE_API);
    openverseUrl.search = new URLSearchParams({
      q: normalized,
      page_size: String(MAX_RESULTS),
      mature: "false",
      filter_dead: "true",
    }).toString();

    const commonsUrl = new URL(COMMONS_API);
    commonsUrl.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `${normalized} filetype:bitmap`,
      gsrnamespace: "6",
      gsrlimit: String(MAX_RESULTS),
      prop: "imageinfo",
      iiprop: "url|user|extmetadata",
      iiurlwidth: "1600",
      iiextmetadatalanguage: "en",
      iiextmetadatafilter:
        "Artist|LicenseShortName|LicenseUrl|ImageDescription",
      format: "json",
      formatversion: "2",
      origin: "*",
    }).toString();

    const articUrl = new URL(ARTIC_SEARCH);
    articUrl.search = new URLSearchParams({
      q: normalized,
      "query[term][is_public_domain]": "true",
      limit: String(MAX_RESULTS),
      fields: [
        "id",
        "title",
        "image_id",
        "artist_title",
        "artist_display",
        "date_display",
        "is_public_domain",
        "classification_title",
        "medium_display",
      ].join(","),
    }).toString();

    const controller = new AbortController();
    const abort = () => controller.abort();
    const timer = setTimeout(abort, timeoutMs);
    requestSignal?.addEventListener("abort", abort, { once: true });
    try {
      const settled = await Promise.allSettled([
        fetchJson(openverseUrl, controller.signal, "Openverse").then(
          (payload) => mapOpenverseResponse(payload, normalized),
        ),
        fetchJson(
          commonsUrl,
          controller.signal,
          "Wikimedia Commons",
        ).then((payload) => mapCommonsResponse(payload, normalized)),
        fetchJson(
          articUrl,
          controller.signal,
          "Art Institute of Chicago",
        ).then((payload) => mapArtInstituteResponse(payload, normalized)),
        searchMet(normalized, controller.signal),
      ]);
      const successful = settled.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      if (!successful.length) {
        throw new AggregateError(
          settled.flatMap((result) =>
            result.status === "rejected" ? [result.reason] : [],
          ),
          "All open image sources were unavailable.",
        );
      }
      const items = interleaveResults(successful);
      cache.set(normalized.toLowerCase(), {
        createdAt: Date.now(),
        items,
      });
      return items;
    } finally {
      clearTimeout(timer);
      requestSignal?.removeEventListener("abort", abort);
    }
  };

  return {
    search,
    sources: [
      "Openverse",
      "Wikimedia Commons",
      "Art Institute of Chicago",
      "The Met Open Access",
    ],
  };
};
