import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverPhotos } from "./photoDiscovery";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("photo discovery client", () => {
  it("accepts bounded attributed HTTPS records and drops malformed ones", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            source: "Wikimedia Commons",
            query: "quiet architecture",
            items: [
              {
                id: "commons-42",
                title: "Quiet courtyard",
                url: "https://upload.wikimedia.org/quiet.jpg",
                sourceUrl:
                  "https://commons.wikimedia.org/wiki/File:Quiet.jpg",
                creator: "Ada Example",
                tags: ["quiet", "architecture"],
                reason: "Found through Wikimedia Commons.",
                license: "CC BY-SA 4.0",
                licenseUrl:
                  "https://creativecommons.org/licenses/by-sa/4.0/",
              },
              {
                id: "tracker",
                title: "Unsafe",
                url: "javascript:alert(1)",
                sourceUrl: "https://example.com",
                creator: "Unknown",
                tags: [],
                reason: "Unsafe URL.",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(discoverPhotos("quiet architecture")).resolves.toEqual([
      expect.objectContaining({
        id: "commons-42",
        license: "CC BY-SA 4.0",
      }),
    ]);
  });

  it("surfaces the local proxy's safe failure message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ error: "Commons is taking a quiet moment." }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(discoverPhotos("quiet architecture")).rejects.toThrow(
      "Commons is taking a quiet moment.",
    );
  });
});
