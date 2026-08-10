import { afterEach, describe, expect, it, vi } from "vitest";
import { requestRecommendationPlan } from "./recommendationPlanner";

const request = {
  domain: "books" as const,
  profile: {
    interests: ["literary fiction"],
    moods: ["contemplative"],
    favorites: ["precise prose"],
    avoid: [],
  },
  notes: [],
  tasteDossier: {
    currentNoteCount: 0,
    evidenceNoteCount: 0,
    evidenceCount: 0,
    evidence: [],
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("recommendation planner client", () => {
  it("rejects a legacy local plan instead of using it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            summary: "Local keyword fallback.",
            provider: "local",
            aiPowered: false,
            candidates: [
              {
                title: "literary fiction",
                creator: "",
                mediaType: "book",
                searchQuery: "literary fiction",
                fitScore: 60,
                rationale: "Local keyword lookup.",
                evidenceNotes: [],
                facets: ["literary fiction", "books"],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(requestRecommendationPlan(request)).rejects.toThrow(
      /No local fallback was used/i,
    );
  });

  it("accepts a completed Codex plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            summary: "A varied AI slate.",
            provider: "codex",
            aiPowered: true,
            candidates: [
              {
                title: "Middlemarch",
                creator: "George Eliot",
                mediaType: "book",
                searchQuery: "Middlemarch George Eliot",
                fitScore: 95,
                rationale: "A whole-profile bridge.",
                evidenceNotes: [],
                facets: ["social observation", "moral ambiguity"],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(requestRecommendationPlan(request)).resolves.toMatchObject({
      provider: "codex",
      aiPowered: true,
      candidates: [expect.objectContaining({ title: "Middlemarch" })],
    });
  });
});
