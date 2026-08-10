// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  parseProfile,
  scoreBook,
  scorePhoto,
  scoreWatchItem,
} from "./profile";
import type { Book, PhotoItem, WatchItem } from "../types";
import { buildTasteDossier } from "./tasteDossier";

describe("preference profile", () => {
  it("extracts the four editable preference fields", () => {
    const profile = parseProfile(
      "<h1>Preferences</h1><p><strong>Interests:</strong> architecture, science fiction</p><p><strong>Moods:</strong> warm, contemplative</p><p><strong>Favorites:</strong> precise prose</p><p><strong>Avoid:</strong> cynicism</p>",
    );

    expect(profile.interests).toEqual(["architecture", "science fiction"]);
    expect(profile.moods).toEqual(["warm", "contemplative"]);
    expect(profile.favorites).toEqual(["precise prose"]);
    expect(profile.avoid).toEqual(["cynicism"]);
  });
});

describe("recommendation scoring", () => {
  const profile = {
    interests: ["science fiction", "architecture"],
    moods: ["contemplative"],
    favorites: ["precise prose"],
    avoid: [],
  };

  it("gives a thematically aligned book a strong score", () => {
    const book: Book = {
      id: "test-book",
      title: "Test Book",
      author: "A. Writer",
      year: "2026",
      cover: "",
      genres: ["science fiction"],
      themes: ["architecture"],
      description: "",
      kind: "discover",
    };

    expect(scoreBook(book, profile)).toBeGreaterThanOrEqual(80);
  });

  it("gives a mood-aligned watch item a strong score", () => {
    const item: WatchItem = {
      id: "test-film",
      title: "Test Film",
      year: "2026",
      artwork: "",
      genres: ["science fiction"],
      moods: ["contemplative"],
      runtime: "90 min",
      description: "",
      kind: "discover",
    };

    expect(scoreWatchItem(item, profile)).toBeGreaterThanOrEqual(75);
  });

  it("penalizes recommendations that match explicit or learned exclusions", () => {
    const book: Book = {
      id: "neon-book",
      title: "Neon Book",
      author: "A. Writer",
      year: "2026",
      cover: "",
      genres: ["science fiction"],
      themes: ["neon"],
      description: "",
      kind: "discover",
    };
    const allowed = scoreBook(book, profile);
    const excluded = scoreBook(book, {
      ...profile,
      avoid: ["neon"],
    });

    expect(excluded).toBeLessThan(allowed);
  });

  it("lets a title named in a note raise that exact recommendation", () => {
    const item: WatchItem = {
      id: "arrival",
      title: "Arrival",
      year: "2016",
      artwork: "",
      genres: ["science fiction"],
      moods: ["contemplative"],
      runtime: "116 min",
      description: "",
      kind: "discover",
    };
    const baseline = scoreWatchItem(item, {
      interests: [],
      moods: [],
      favorites: [],
      avoid: [],
    });
    const favored = scoreWatchItem(item, {
      interests: [],
      moods: [],
      favorites: ["arrival"],
      avoid: [],
    });

    expect(favored).toBeGreaterThan(baseline);
  });

  it("uses a platform named in recommendation notes as a TV affinity", () => {
    const item: WatchItem = {
      id: "platform-show",
      title: "Platform Show",
      year: "2026",
      artwork: "",
      genres: ["drama"],
      moods: ["patient"],
      runtime: "45 min episodes",
      description: "",
      kind: "discover",
      mediaType: "series",
      platforms: ["Netflix"],
    };
    const baseline = scoreWatchItem(item, {
      interests: [],
      moods: [],
      favorites: [],
      avoid: [],
    });
    const preferred = scoreWatchItem(item, {
      interests: ["netflix"],
      moods: [],
      favorites: [],
      avoid: [],
    });

    expect(preferred).toBeGreaterThan(baseline);
  });

  it("adds and retracts the current-Note bonus for photo scoring", () => {
    const photo: PhotoItem = {
      id: "observatory",
      title: "Clouds over the dome",
      url: "https://example.com/observatory.jpg",
      sourceUrl: "https://example.com/source",
      creator: "Ada",
      tags: ["misty observatories", "night sky"],
      reason: "A visual match.",
    };
    const baseProfile = {
      interests: ["quiet architecture"],
      moods: [],
      favorites: [],
      avoid: [],
    };
    const currentNotes = {
      interests: ["misty observatories"],
      moods: [],
      favorites: [],
      avoid: [],
    };

    expect(scorePhoto(photo, baseProfile, currentNotes)).toBeGreaterThan(
      scorePhoto(photo, baseProfile, {
        interests: [],
        moods: [],
        favorites: [],
        avoid: [],
      }),
    );
  });

  it("uses nuanced whole-Note evidence and descriptions to change book order", () => {
    const dossier = buildTasteDossier([
      {
        id: "fiction-values",
        title: "What I value in books",
        folder: "Personal",
        content:
          "<p>I love dreamlike architecture and compassionate solitude.</p><p>I avoid bleak, cynical endings.</p>",
        updatedAt: "2026-07-30T12:00:00.000Z",
      },
    ]);
    const fitting: Book = {
      id: "fitting",
      title: "An Impossible House",
      author: "A. Writer",
      year: "2026",
      cover: "",
      genres: ["literary fiction"],
      themes: ["architecture"],
      description:
        "A dreamlike, compassionate story of a solitary keeper inside an architectural labyrinth.",
      kind: "discover",
    };
    const conflicting: Book = {
      ...fitting,
      id: "conflicting",
      title: "Ash City",
      description:
        "A bleak and cynical architectural story with a nihilistic ending.",
    };

    expect(scoreBook(fitting, profile, dossier)).toBeGreaterThan(
      scoreBook(conflicting, profile, dossier),
    );
  });
});
