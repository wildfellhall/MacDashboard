import { expect, test } from "vitest";
import { prepareAssistantRequest } from "../src/lib/assistantClient.ts";
import { validateAssistantRequest } from "./validation.js";

test("prepared stale browser context satisfies the server boundary", () => {
  const noteId = `legacy-${"x".repeat(180)}`;
  const payload = {
    messages: [
      ...Array.from({ length: 15 }, (_, index) => ({
        role: index % 2 ? "assistant" : "user",
        content: `Message ${index} ${"m".repeat(4_500)}`,
      })),
      { role: "user", content: "What should I read next?" },
    ],
    profile: {
      interests: ["romantic classics", "", ...Array(40).fill("quiet")],
      moods: [],
      favorites: [],
      avoid: [],
    },
    notes: [
      {
        id: noteId,
        title: `Favorite books ${"t".repeat(300)}`,
      },
    ],
    relevantNotes: [
      {
        id: noteId,
        title: "stale title",
        folder: "stale folder",
        excerpt: `I love romantic classics. ${"e".repeat(700)}`,
        matchedTerms: Array(20).fill("romantic classics"),
      },
    ],
    tasteDossier: {
      currentNoteCount: 99,
      evidenceNoteCount: 99,
      evidenceCount: 99,
      evidence: [
        {
          noteId,
          noteTitle: "stale title",
          folder: "stale folder",
          passage: "I love romantic classics with perceptive heroines.",
          polarity: "positive",
          strength: 5,
          domains: ["books", "books", "unknown"],
          concepts: Array(25).fill("romantic classics"),
          updatedAt: "",
        },
      ],
    },
    tasteSignals: [
      {
        appId: "books",
        targetTitle: "Pride and Prejudice",
        tags: Array.from({ length: 30 }, (_, index) => `tag-${index}`),
        kind: "liked",
        timestamp: "2026-08-13T12:00:00.000Z",
      },
    ],
    reviews: [
      {
        title: "Emma",
        rating: 10,
        minutes: -1,
        reviewedAt: "2026-08-13T12:00:00.000Z",
      },
    ],
    bookHistory: [
      {
        title: "Persuasion",
        shelves: Array.from({ length: 30 }, (_, index) => `shelf-${index}`),
        readAt: "not-a-date",
      },
    ],
    localPhotoSignals: {
      fileCount: 10,
      tags: Array.from({ length: 12 }, (_, index) => `tag-${index}`),
      palette: Array.from({ length: 12 }, (_, index) => `tone-${index}`),
      importedAt: "2026-08-13T12:00:00.000Z",
    },
    localChatSignals: {
      messageCount: 0,
      topics: [],
      importedAt: "bad-date",
    },
    recommendations: [
      {
        appId: "books",
        itemId: "jane-eyre",
        title: "Jane Eyre",
        kind: "discover",
        score: 94.4,
        tags: Array.from({ length: 30 }, (_, index) => `tag-${index}`),
        description: "",
        evidenceSummary: "",
        sourceNotes: ["", "Favorite books", "Favorite books"],
      },
    ],
    activeSelection: {
      appId: "books",
      itemId: "jane-eyre",
      title: "stale title",
    },
  };

  const prepared = prepareAssistantRequest(payload);

  expect(() => validateAssistantRequest(prepared)).not.toThrow();
  const validated = validateAssistantRequest(prepared);
  expect(validated.relevantNotes[0].title).toBe(validated.notes[0].title);
  expect(validated.tasteDossier).toMatchObject({
    currentNoteCount: 1,
    evidenceNoteCount: 1,
    evidenceCount: 1,
  });
  expect(validated.tasteDossier.evidence[0].passage).toContain(
    "romantic classics",
  );
  expect(validated.activeSelection.title).toBe("Jane Eyre");
});
