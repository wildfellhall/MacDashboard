import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverBooks } from "./bookDiscovery";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("book discovery client", () => {
  it("accepts bounded Open Library candidates and drops unsafe URLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            items: [
              {
                id: "openlibrary-ol123w",
                title: "A House of Quiet Rooms",
                author: "Ada Example",
                year: "2021",
                cover: "https://covers.openlibrary.org/b/id/456-L.jpg",
                genres: ["architecture"],
                themes: ["quiet"],
                description: "A house remembers everyone who enters.",
                rating: 4.4,
                kind: "discover",
                sourceUrl: "https://openlibrary.org/works/OL123W",
                sourceLabel: "Open Library",
              },
              {
                id: "unsafe",
                title: "Unsafe",
                author: "Unknown",
                year: "2026",
                cover: "javascript:alert(1)",
                genres: [],
                themes: [],
                description: "Unsafe.",
                kind: "discover",
                sourceUrl: "https://example.com",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(discoverBooks("quiet architecture")).resolves.toEqual([
      expect.objectContaining({
        id: "openlibrary-ol123w",
        sourceLabel: "Open Library",
      }),
    ]);
  });
});
