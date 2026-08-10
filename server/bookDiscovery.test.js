import { describe, expect, it, vi } from "vitest";
import {
  createBookDiscoveryService,
  mapOpenLibraryResponse,
} from "./bookDiscovery.js";

const openLibraryPayload = {
  docs: [
    {
      key: "/works/OL123W",
      title: "A House of Quiet Rooms",
      author_name: ["Ada Example"],
      first_publish_year: 2021,
      cover_i: 456,
      subject: [
        "Architecture",
        "Literary fiction",
        "Memory",
        "Solitude",
      ],
      ratings_average: 4.4,
      first_sentence: ["A house remembers everyone who enters."],
    },
  ],
};

describe("Open Library book discovery", () => {
  it("maps bounded work metadata into inspectable book candidates", () => {
    expect(
      mapOpenLibraryResponse(openLibraryPayload, "quiet architecture"),
    ).toEqual([
      {
        id: "openlibrary-ol123w",
        title: "A House of Quiet Rooms",
        author: "Ada Example",
        year: "2021",
        cover: "https://covers.openlibrary.org/b/id/456-L.jpg",
        genres: ["architecture", "literary fiction", "memory"],
        themes: ["solitude"],
        description: "A house remembers everyone who enters.",
        rating: 4.4,
        kind: "discover",
        sourceUrl: "https://openlibrary.org/works/OL123W",
        sourceLabel: "Open Library",
      },
    ]);
  });

  it("makes one identified request and caches repeated searches", async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      expect(init.headers["User-Agent"]).toContain("MacDashboard");
      return new Response(JSON.stringify(openLibraryPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    const service = createBookDiscoveryService({ fetchImpl });

    await expect(service.search("quiet architecture")).resolves.toHaveLength(1);
    await expect(service.search("quiet architecture")).resolves.toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
