// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { Note } from "../types";
import {
  extractNoteRecommendationInsights,
  noteInsightsToProfile,
  titleAppearsInSignals,
} from "./noteInsights";

const note = (overrides: Partial<Note>): Note => ({
  id: "note-1",
  title: "New Note",
  folder: "Ideas",
  content: "<h1>New Note</h1><p><br></p>",
  updatedAt: "2026-07-30T12:00:00.000Z",
  ...overrides,
});

describe("note recommendation insights", () => {
  it("uses a created Favorite Shows list as exact viewing affinities", () => {
    const insights = extractNoteRecommendationInsights([
      note({
        title: "Favorite Shows",
        content:
          "<h1>Favorite Shows</h1><ul><li>Severance</li><li>Fleabag — dry, character-driven comedy</li></ul>",
      }),
    ]);

    expect(insights.watchTitles).toEqual(["severance", "fleabag"]);
    expect(insights.favorites).toEqual(["severance", "fleabag"]);
    expect(insights.interests).toContain("dry");
    expect(insights.interests).toContain("character-driven comedy");
    expect(insights.sources).toEqual([
      {
        noteId: "note-1",
        title: "Favorite Shows",
        signalCount: 4,
      },
    ]);
    expect(noteInsightsToProfile(insights).favorites).toContain("severance");
  });

  it("understands explicit likes and dislikes inside a media note", () => {
    const insights = extractNoteRecommendationInsights([
      note({
        title: "Films",
        content:
          "<h1>Films</h1><p>I love In the Mood for Love, Arrival</p><p>I dislike gratuitous violence</p>",
      }),
    ]);

    expect(insights.watchTitles).toEqual([
      "in the mood for love",
      "arrival",
    ]);
    expect(insights.avoid).toEqual(["gratuitous violence"]);
  });

  it("uses a created streaming-services note as platform affinity, not a title query", () => {
    const insights = extractNoteRecommendationInsights([
      note({
        title: "Favorite streaming services",
        content:
          "<h1>Favorite streaming services</h1><ul><li>Netflix</li><li>MUBI</li></ul>",
      }),
    ]);

    expect(insights.watchPlatforms).toEqual(["netflix", "mubi"]);
    expect(insights.watchTitles).toEqual([]);
    expect(noteInsightsToProfile(insights).interests).toEqual([
      "netflix",
      "mubi",
    ]);
  });

  it("keeps media-list items in their heading domain when descriptors mention design", () => {
    const insights = extractNoteRecommendationInsights([
      note({
        title: "Favorite Shows",
        content:
          "<h1>Favorite Shows</h1><ul><li>Severance — exacting writing, gorgeous production design</li></ul>",
      }),
    ]);

    expect(insights.watchTitles).toEqual(["severance"]);
    expect(insights.photoTerms).toEqual([]);
    expect(insights.interests).toEqual([
      "exacting writing",
      "gorgeous production design",
    ]);
  });

  it("extracts visual aesthetic lists for photo discovery", () => {
    const insights = extractNoteRecommendationInsights([
      note({
        title: "Visual inspiration",
        content:
          "<h1>Visual inspiration</h1><ul><li>brutalist architecture</li><li>stormy coastlines</li></ul>",
      }),
    ]);

    expect(insights.photoTerms).toEqual([
      "brutalist architecture",
      "stormy coastlines",
    ]);
    expect(noteInsightsToProfile(insights).interests).toContain(
      "brutalist architecture",
    );
  });

  it("uses favorite-author lists as Books affinities and discovery seeds", () => {
    const insights = extractNoteRecommendationInsights([
      note({
        title: "Authors I love",
        content:
          "<h1>Authors I love</h1><ul><li>Yoko Ogawa</li><li>Ursula K. Le Guin</li></ul>",
      }),
    ]);

    expect(insights.bookTitles).toEqual([
      "yoko ogawa",
      "ursula k. le guin",
    ]);
    expect(noteInsightsToProfile(insights).favorites).toContain("yoko ogawa");
  });

  it("does not mistake descriptive preference prose for a named book anchor", () => {
    const insights = extractNoteRecommendationInsights([
      note({
        title: "Favorite books",
        content:
          "<h1>Favorite books</h1><ul><li>Little Women</li></ul><p>I also love philosophical mysteries and experimental structure.</p>",
      }),
    ]);

    expect(insights.bookTitles).toEqual(["little women"]);
    expect(insights.favorites).toContain(
      "i also love philosophical mysteries and experimental structure",
    );
  });

  it("does not turn unrelated drafts into recommendation signals", () => {
    const insights = extractNoteRecommendationInsights([
      note({
        title: "Meeting draft",
        content:
          "<h1>Meeting draft</h1><p>The dashboard should feel less like a feed and more like a room.</p>",
      }),
    ]);

    expect(insights.sources).toEqual([]);
    expect(insights.interests).toEqual([]);
    expect(insights.favorites).toEqual([]);
  });

  it("leaves Preferences and Reviews to their structured parsers", () => {
    const insights = extractNoteRecommendationInsights([
      note({
        id: "preferences",
        title: "Preferences",
        content: "<h1>Preferences</h1><p>Favorites: Arrival</p>",
      }),
      note({
        id: "reviews",
        title: "Reviews",
        folder: "Reviews",
        content: "<h1>Reviews</h1><h2>Arrival — 5/5</h2>",
      }),
    ]);

    expect(insights.sources).toEqual([]);
  });

  it("matches titles without depending on punctuation or case", () => {
    expect(
      titleAppearsInSignals("The Bear", ["the bear", "Severance"]),
    ).toBe(true);
    expect(titleAppearsInSignals("Arrival", ["After Yang"])).toBe(false);
  });
});
