import { describe, expect, it } from "vitest";
import {
  buildRecommendationPlanPrompt,
  validateRecommendationPlanRequest,
  validateRecommendationPlanResult,
} from "./recommendationPlanner.js";

const request = {
  domain: "books",
  profile: {
    interests: ["literary fiction", "art history"],
    moods: ["contemplative", "warm"],
    favorites: ["precise prose"],
    avoid: ["cynical endings"],
  },
  notes: [
    {
      id: "preferences",
      title: "Preferences",
      folder: "Personal",
      updatedAt: "2026-07-30T12:00:00.000Z",
    },
    {
      id: "favorite-books",
      title: "Favorite books",
      folder: "Personal",
      updatedAt: "2026-07-29T12:00:00.000Z",
    },
  ],
  tasteDossier: {
    currentNoteCount: 2,
    evidenceNoteCount: 2,
    evidenceCount: 2,
    evidence: [
      {
        noteId: "preferences",
        noteTitle: "Preferences",
        folder: "Personal",
        passage:
          "I love philosophical mysteries and quiet architecture, but dislike cynical endings.",
        polarity: "positive",
        strength: 5,
        domains: ["books"],
        concepts: ["philosophical mystery", "quiet architecture"],
        updatedAt: "2026-07-30T12:00:00.000Z",
      },
      {
        noteId: "favorite-books",
        noteTitle: "Favorite books",
        folder: "Personal",
        passage:
          "Little Women is a favorite for its moral seriousness and affectionate family dynamics.",
        polarity: "positive",
        strength: 5,
        domains: ["books"],
        concepts: ["little women", "moral seriousness", "family dynamics"],
        updatedAt: "2026-07-29T12:00:00.000Z",
      },
    ],
  },
  anchorTitles: ["Little Women"],
  knownTitles: ["Little Women", "Piranesi"],
  dismissedTitles: ["The Alchemist"],
  historyTitles: ["Little Women"],
};

describe("AI recommendation planning", () => {
  it("validates current-note evidence and explicitly prevents anchor fixation", () => {
    const validated = validateRecommendationPlanRequest(request);
    const prompt = buildRecommendationPlanPrompt(validated);

    expect(prompt).toContain("$curate-deep-recommendations");
    expect(prompt).toContain("trajectory, saturation, and portfolio-audit");
    expect(prompt).toContain('"anchorTitles":["Little Women"]');
    expect(prompt).toMatch(/one piece\s+of evidence, not the center/);
    expect(prompt).toContain("At most two candidates");
    expect(prompt).toContain("different Notes");
    expect(prompt).toContain("Exclude dismissedTitles");
  });

  it("accepts a diverse, evidence-grounded structured slate", () => {
    const validated = validateRecommendationPlanRequest(request);
    expect(
      validateRecommendationPlanResult(
        {
          summary:
            "The slate rotates architecture, moral seriousness, warmth, and mystery.",
          candidates: [
            {
              title: "The Summer Book",
              creator: "Tove Jansson",
              mediaType: "book",
              searchQuery: "The Summer Book Tove Jansson",
              fitScore: 91,
              rationale:
                "It preserves affectionate intimacy while shifting era, setting, and structure.",
              evidenceNotes: ["Favorite books", "Preferences"],
              facets: ["family intimacy", "quiet", "precise prose"],
            },
            {
              title: "The Name of the Rose",
              creator: "Umberto Eco",
              mediaType: "book",
              searchQuery: "The Name of the Rose Umberto Eco",
              fitScore: 87,
              rationale:
                "It uses philosophical mystery and architectural space without repeating the family anchor.",
              evidenceNotes: ["Preferences"],
              facets: ["mystery", "architecture", "philosophy"],
            },
          ],
        },
        validated,
      ).candidates,
    ).toHaveLength(2);
  });

  it("rejects stale Note citations from model output", () => {
    const validated = validateRecommendationPlanRequest(request);
    expect(() =>
      validateRecommendationPlanResult(
        {
          summary: "A slate.",
          candidates: [
            {
              title: "The Summer Book",
              creator: "Tove Jansson",
              mediaType: "book",
              searchQuery: "The Summer Book Tove Jansson",
              fitScore: 90,
              rationale: "A reason.",
              evidenceNotes: ["Deleted Note"],
              facets: ["quiet", "family"],
            },
          ],
        },
        validated,
      ),
    ).toThrow(/no usable candidates/i);
  });
});
