import { describe, expect, it, vi } from "vitest";
import {
  createTvDiscoveryService,
  mapAppleSearchResponse,
  mapTmdbSearchResult,
  mapTvmazeSearchResponse,
} from "./tvDiscovery.js";

const moviePayload = {
  results: [
    {
      kind: "feature-movie",
      trackId: 42,
      trackName: "The Quiet Future",
      releaseDate: "2022-10-01T07:00:00Z",
      artworkUrl100:
        "https://is1-ssl.mzstatic.com/image/thumb/Movie/42/100x100bb.jpg",
      trackViewUrl: "https://tv.apple.com/us/movie/the-quiet-future/umc.42",
      primaryGenreName: "Sci-Fi & Fantasy",
      trackTimeMillis: 6_540_000,
      longDescription: "A patient story about memory and an unfamiliar city.",
    },
  ],
};

const tvmazePayload = [
  {
    score: 0.91,
    show: {
      id: 77,
      name: "Quiet Signals",
      type: "Scripted",
      premiered: "2024-02-10",
      image: {
        original: "https://static.tvmaze.com/uploads/images/quiet.jpg",
      },
      url: "https://www.tvmaze.com/shows/77/quiet-signals",
      officialSite: "https://www.netflix.com/title/quiet-signals",
      webChannel: { name: "Netflix" },
      genres: ["Drama", "Science-Fiction"],
      averageRuntime: 48,
      summary: "<p>A patient mystery in a future city.</p>",
    },
  },
];

describe("cross-platform TV catalog discovery", () => {
  it("maps Apple candidates with store and media metadata", () => {
    expect(
      mapAppleSearchResponse(moviePayload, "thoughtful science fiction", "movie"),
    ).toEqual([
      expect.objectContaining({
        id: "apple-movie-42",
        title: "The Quiet Future",
        year: "2022",
        artwork:
          "https://is1-ssl.mzstatic.com/image/thumb/Movie/42/600x600bb.jpg",
        genres: ["sci-fi & fantasy", "movie"],
        moods: [],
        runtime: "1 hr 49 min",
        mediaType: "movie",
        platforms: ["Apple TV Store"],
        providers: [{ name: "Apple TV Store", type: "rent/buy" }],
        sourceUrl:
          "https://tv.apple.com/us/movie/the-quiet-future/umc.42",
        sourceLinks: expect.arrayContaining([
          {
            label: "Compare streaming services",
            url: "https://www.justwatch.com/us/search?q=The+Quiet+Future",
          },
        ]),
      }),
    ]);
  });

  it("maps TVmaze web channels, official links, and CC BY-SA provenance", () => {
    expect(
      mapTvmazeSearchResponse(tvmazePayload, "patient science fiction"),
    ).toEqual([
      expect.objectContaining({
        id: "tvmaze-77",
        title: "Quiet Signals",
        year: "2024",
        mediaType: "series",
        platforms: ["Netflix"],
        providers: [{ name: "Netflix", type: "subscription" }],
        runtime: "48 min episodes",
        description: "A patient mystery in a future city.",
        providerAttribution: "Series data from TVmaze · CC BY-SA",
        sourceLinks: expect.arrayContaining([
          {
            label: "View on TVmaze",
            url: "https://www.tvmaze.com/shows/77/quiet-signals",
          },
          {
            label: "Open Netflix",
            url: "https://www.netflix.com/title/quiet-signals",
          },
        ]),
      }),
    ]);
  });

  it("normalizes Apple TV season records to the searchable show title", () => {
    const mapped = mapAppleSearchResponse(
      {
        results: [
          {
            collectionId: 91,
            collectionName: "Severance, Season 1",
            releaseDate: "2022-02-18T00:00:00Z",
            artworkUrl100:
              "https://is1-ssl.mzstatic.com/image/thumb/TV/91/100x100bb.jpg",
            collectionViewUrl:
              "https://tv.apple.com/us/show/severance/umc.91",
            primaryGenreName: "Drama",
          },
        ],
      },
      "Severance",
      "tvShow",
    );

    expect(mapped[0]).toMatchObject({
      title: "Severance",
      mediaType: "series",
    });
  });

  it("maps region-aware TMDB and JustWatch provider data", () => {
    const mapped = mapTmdbSearchResult(
      {
        id: 501,
        media_type: "movie",
        title: "Glass Harbor",
        release_date: "2025-04-12",
        backdrop_path: "/glass.jpg",
        genre_ids: [18, 9648],
        overview: "A quiet coastal mystery.",
        vote_average: 8.2,
      },
      {
        runtime: 112,
        genres: [{ name: "Drama" }, { name: "Mystery" }],
        "watch/providers": {
          results: {
            US: {
              link: "https://www.themoviedb.org/movie/501/watch",
              flatrate: [{ provider_name: "Max" }],
              rent: [{ provider_name: "Prime Video" }],
            },
          },
        },
      },
      "coastal mystery",
      "US",
    );

    expect(mapped).toMatchObject({
      id: "tmdb-movie-501",
      title: "Glass Harbor",
      mediaType: "movie",
      platforms: ["Max", "Prime Video"],
      providers: [
        { name: "Max", type: "subscription" },
        { name: "Prime Video", type: "rent" },
      ],
      sourceLabel: "Check streaming options",
      providerAttribution:
        "Streaming availability by JustWatch · Title data from TMDB",
    });
  });

  it("searches Apple and TVmaze, then caches the merged result", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      expect(init.headers["User-Agent"]).toContain("MacDashboard");
      const parsed = new URL(url);
      if (parsed.hostname === "api.tvmaze.com") {
        return Response.json(tvmazePayload);
      }
      const media = parsed.searchParams.get("media");
      return Response.json(media === "movie" ? moviePayload : { results: [] });
    });
    const service = createTvDiscoveryService({ fetchImpl, tmdbToken: "" });

    await expect(
      service.search("thoughtful science fiction"),
    ).resolves.toHaveLength(2);
    await expect(
      service.search("thoughtful science fiction"),
    ).resolves.toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(service.sources).toEqual(["Apple Search", "TVmaze"]);
    expect(service.tmdbConfigured).toBe(false);
  });

  it("ranks an exact title match ahead of loose provider results", async () => {
    const fetchImpl = vi.fn(async (url) => {
      const parsed = new URL(url);
      if (parsed.hostname === "api.tvmaze.com") {
        return Response.json(tvmazePayload);
      }
      return Response.json(
        parsed.searchParams.get("media") === "movie"
          ? moviePayload
          : { results: [] },
      );
    });
    const service = createTvDiscoveryService({ fetchImpl, tmdbToken: "" });

    const results = await service.search("Quiet Signals");
    expect(results[0].title).toBe("Quiet Signals");
    expect(results[0].moods).not.toContain("signals");
  });

  it("keeps TVmaze results when Apple is offline", async () => {
    const fetchImpl = vi.fn(async (url) => {
      const parsed = new URL(url);
      if (parsed.hostname === "api.tvmaze.com") {
        return Response.json(tvmazePayload);
      }
      return new Response("offline", { status: 503 });
    });
    const service = createTvDiscoveryService({ fetchImpl, tmdbToken: "" });

    await expect(service.search("quiet signals")).resolves.toEqual([
      expect.objectContaining({
        id: "tvmaze-77",
        platforms: ["Netflix"],
      }),
    ]);
  });

  it("uses an optional server-side TMDB token without exposing it in results", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      const parsed = new URL(url);
      if (parsed.hostname === "itunes.apple.com") {
        return Response.json({ results: [] });
      }
      if (parsed.hostname === "api.tvmaze.com") {
        return Response.json([]);
      }
      expect(init.headers.Authorization).toBe("Bearer secret-token");
      if (parsed.pathname === "/3/search/multi") {
        return Response.json({
          results: [
            {
              id: 501,
              media_type: "movie",
              title: "Glass Harbor",
              release_date: "2025-04-12",
              backdrop_path: "/glass.jpg",
              genre_ids: [18, 9648],
              overview: "A quiet coastal mystery.",
              vote_average: 8.2,
            },
          ],
        });
      }
      return Response.json({
        runtime: 112,
        "watch/providers": {
          results: {
            US: {
              link: "https://www.themoviedb.org/movie/501/watch",
              flatrate: [{ provider_name: "Max" }],
            },
          },
        },
      });
    });
    const service = createTvDiscoveryService({
      fetchImpl,
      tmdbToken: "secret-token",
      region: "us",
    });

    await expect(service.search("coastal mystery")).resolves.toEqual([
      expect.objectContaining({
        id: "tmdb-movie-501",
        platforms: ["Max"],
      }),
    ]);
    expect(service.sources).toEqual(["Apple Search", "TVmaze", "TMDB"]);
    expect(service.region).toBe("US");
    expect(JSON.stringify(await service.search("coastal mystery"))).not.toContain(
      "secret-token",
    );
  });
});
