import { describe, expect, it } from "vitest";
import {
  latestWatchFor,
  parseViewingHistory,
  wasWatched,
} from "./viewingHistory";

describe("opt-in viewing history imports", () => {
  it("parses a Netflix-style CSV with quoted episode titles", () => {
    const entries = parseViewingHistory(
      'Title,Date\n"Detectorists: Series 1: Episode 1",7/20/2026\nArrival,7/21/2026',
      "NetflixViewingHistory.csv",
    );

    expect(entries).toHaveLength(2);
    expect(entries[0].source).toBe("netflix");
    expect(latestWatchFor("Detectorists", entries)).toContain("2026-07-20");
    expect(wasWatched("Detectorists", entries)).toBe(true);
    expect(wasWatched("A Completely New Show", [
      {
        title: "A Completely New Show: Season 1: Pilot",
        source: "netflix",
      },
    ])).toBe(true);
  });

  it("parses a Prime-style JSON export and rejects unknown shapes", () => {
    const entries = parseViewingHistory(
      JSON.stringify({
        watchHistory: [
          { videoTitle: "After Yang", watchedAt: "2026-06-10" },
        ],
      }),
      "amazon-prime.json",
    );
    expect(entries[0]).toMatchObject({
      title: "After Yang",
      source: "prime",
    });
    expect(() =>
      parseViewingHistory('{"account":"example"}', "history.json"),
    ).toThrow(/No recognizable/);
  });
});
