// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { Note } from "../types";
import {
  findMentionedRecommendationTerms,
  retrieveRelevantNotes,
} from "./noteRetrieval";

const makeNote = (overrides: Partial<Note>): Note => ({
  id: "note",
  title: "Untitled",
  folder: "Ideas",
  content: "<h1>Untitled</h1><p>Nothing here.</p>",
  updatedAt: "2026-07-30T12:00:00.000Z",
  ...overrides,
});

describe("local note retrieval", () => {
  const notes: Note[] = [
    makeNote({
      id: "shows",
      title: "Favorite Shows",
      folder: "Personal",
      content:
        "<h1>Favorite Shows</h1><ul><li>Severance</li><li>Fleabag</li><li>Detectorists</li></ul>",
    }),
    makeNote({
      id: "photos",
      title: "Visual inspiration",
      content:
        "<h1>Visual inspiration</h1><p>I love muted coastal photography and brutalist interiors.</p>",
    }),
    makeNote({
      id: "project",
      title: "Garden project",
      content:
        "<h1>Garden project</h1><p>Order cedar planters and call the landscaper.</p>",
    }),
  ];

  it("finds a favorite-shows list for a natural recommendation query", () => {
    const results = retrieveRelevantNotes(
      "What television series should I watch next?",
      notes,
    );

    expect(results[0]).toMatchObject({
      id: "shows",
      title: "Favorite Shows",
    });
    expect(results[0].excerpt).toContain("Severance");
    expect(results[0].excerpt).toContain("Fleabag");
  });

  it("finds visual preferences through domain synonym expansion", () => {
    const results = retrieveRelevantNotes(
      "Find photos that fit my aesthetic",
      notes,
    );

    expect(results.map((result) => result.id)).toContain("photos");
    expect(
      results.find((result) => result.id === "photos")?.excerpt,
    ).toContain("muted coastal photography");
  });

  it("retrieves an ordinary project note when the query matches its content", () => {
    const results = retrieveRelevantNotes(
      "What did I write about cedar planters?",
      notes,
    );

    expect(results[0]).toMatchObject({
      id: "project",
      title: "Garden project",
    });
  });

  it("does not attach unrelated note text to an unmatched query", () => {
    expect(
      retrieveRelevantNotes("Explain quantum error correction", notes),
    ).toEqual([]);
  });

  it("keeps excerpts and result counts bounded", () => {
    const results = retrieveRelevantNotes("recommend something I like", notes, {
      limit: 2,
    });

    expect(results.length).toBeLessThanOrEqual(2);
    expect(results.every((result) => result.excerpt.length <= 520)).toBe(true);
  });

  it("searches relevant passages for catalog terms with sentiment", () => {
    const terms = findMentionedRecommendationTerms(
      [
        ...notes,
        makeNote({
          id: "avoid",
          title: "Things I avoid",
          content:
            "<h1>Things I avoid</h1><p>gratuitous violence and cynical endings</p>",
        }),
      ],
      [
        "Severance",
        "muted coastal photography",
        "gratuitous violence",
        "unmentioned genre",
      ],
    );

    expect(terms.positive).toEqual([
      "severance",
      "muted coastal photography",
    ]);
    expect(terms.negative).toEqual(["gratuitous violence"]);
  });
});
