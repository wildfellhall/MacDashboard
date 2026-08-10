import { describe, expect, it } from "vitest";
import type { Profile } from "../types";
import { buildPhotoDiscoveryQueries } from "./photoTaste";

const profile: Profile = {
  interests: [
    "thoughtful science fiction",
    "quiet architecture",
    "art history",
    "coastal landscapes",
  ],
  moods: ["contemplative", "warm", "visually lush"],
  favorites: ["atmospheric photography"],
  avoid: ["gratuitous violence"],
};

describe("aesthetic photo discovery queries", () => {
  it("searches focused visual interests instead of one impossible combined phrase", () => {
    expect(
      buildPhotoDiscoveryQueries({
        query: "",
        profile,
        localSignals: null,
      }),
    ).toEqual([
      "quiet architecture",
      "art history",
      "coastal landscapes",
      "atmospheric photography",
    ]);
  });

  it("prioritizes opted-in local visual signals", () => {
    expect(
      buildPhotoDiscoveryQueries({
        query: "",
        profile,
        noteProfile: {
          interests: [],
          moods: [],
          favorites: [],
          avoid: [],
        },
        localSignals: {
          importedAt: "2026-07-29T12:00:00.000Z",
          fileCount: 3,
          tags: [
            { label: "misty", count: 2 },
            { label: "coastal", count: 2 },
            { label: "architecture", count: 1 },
          ],
          palette: [{ label: "muted palette", count: 2 }],
          formats: [{ label: "jpeg", count: 3 }],
        },
      }),
    ).toEqual([
      "misty coastal architecture",
      "coastal",
      "architecture",
      "muted palette",
    ]);
  });

  it("keeps an explicit search first and adds a broader subject fallback", () => {
    expect(
      buildPhotoDiscoveryQueries({
        query: "quiet brutalist architecture",
        profile,
        localSignals: null,
      }),
    ).toEqual([
      "quiet brutalist architecture",
      "brutalist architecture",
      "brutalist architecture photography",
    ]);
  });

  it("prioritizes current Note signals and drops a deleted Note's direction", () => {
    const currentNotes: Profile = {
      interests: ["misty observatories", "quiet architecture"],
      moods: [],
      favorites: [],
      avoid: [],
    };
    const afterDeletion: Profile = {
      interests: ["quiet architecture"],
      moods: [],
      favorites: [],
      avoid: [],
    };
    const withNote = buildPhotoDiscoveryQueries({
      query: "",
      profile,
      noteProfile: currentNotes,
      localSignals: null,
    });
    const withoutDeletedNote = buildPhotoDiscoveryQueries({
      query: "",
      profile,
      noteProfile: afterDeletion,
      localSignals: null,
    });

    expect(withNote[0]).toBe("misty observatories");
    expect(withoutDeletedNote).not.toContain("misty observatories");
  });
});
