// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverTv } from "./tvDiscovery";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TV discovery client", () => {
  it("accepts bounded cross-platform metadata and rejects malformed items", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            sources: ["Apple Search", "TVmaze", "TMDB"],
            region: "US",
            tmdbConfigured: true,
            items: [
              {
                id: "apple-movie-42",
                title: "Quiet Future",
                year: "2022",
                artwork: "https://is1-ssl.mzstatic.com/quiet.jpg",
                genres: ["science fiction"],
                moods: ["thoughtful"],
                runtime: "1 hr 49 min",
                description: "A patient story.",
                kind: "discover",
                sourceUrl: "https://tv.apple.com/us/movie/quiet/umc.42",
                sourceLabel: "View on Apple TV",
                mediaType: "movie",
                platforms: ["Apple TV Store", "Max"],
                providers: [
                  { name: "Max", type: "subscription" },
                  { name: "Prime Video", type: "rent" },
                  { name: "Unsafe", type: "unknown" },
                ],
                sourceLinks: [
                  {
                    label: "Where to watch in US",
                    url: "https://www.themoviedb.org/movie/42/watch",
                  },
                  {
                    label: "Unsafe",
                    url: "javascript:alert(1)",
                  },
                ],
                providerAttribution:
                  "Streaming availability by JustWatch · Title data from TMDB",
              },
              {
                id: "unsafe",
                title: "Unsafe",
                year: "2022",
                artwork: "javascript:alert(1)",
                genres: [],
                moods: [],
                runtime: "1 hr",
                description: "No.",
                kind: "discover",
                sourceUrl: "https://tv.apple.com/unsafe",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(discoverTv("science fiction")).resolves.toEqual({
      sources: ["Apple Search", "TVmaze", "TMDB"],
      region: "US",
      tmdbConfigured: true,
      items: [
        expect.objectContaining({
          id: "apple-movie-42",
          sourceLabel: "View on Apple TV",
          mediaType: "movie",
          platforms: ["Apple TV Store", "Max"],
          providers: [
            { name: "Max", type: "subscription" },
            { name: "Prime Video", type: "rent" },
          ],
          sourceLinks: [
            {
              label: "Where to watch in US",
              url: "https://www.themoviedb.org/movie/42/watch",
            },
          ],
        }),
      ],
    });
  });
});
