// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { parseReviewNotes, reviewForTitle } from "./reviewHistory";
import type { Note } from "../types";

describe("review-note history", () => {
  it("extracts ratings, engagement time, and review metadata", () => {
    const note: Note = {
      id: "reviews",
      title: "Reviews",
      folder: "Reviews",
      updatedAt: "2026-07-20T12:00:00.000Z",
      content:
        "<h1>Reviews</h1><h2>Piranesi — 5/5</h2><p>Read: 2023-02-12. Dreamlike. Time spent: 286 minutes.</p><h2>Arrival — 4.5/5</h2><p>Patient and humane.</p>",
    };
    const reviews = parseReviewNotes([note]);

    expect(reviewForTitle("Piranesi", reviews)).toMatchObject({
      rating: 5,
      minutes: 286,
      reviewedAt: "2023-02-12T12:00:00.000Z",
    });
    expect(reviewForTitle("Arrival", reviews)?.rating).toBe(4.5);
  });

  it("ignores out-of-range ratings without poisoning assistant metadata", () => {
    const note: Note = {
      id: "reviews",
      title: "Reviews",
      folder: "Reviews",
      updatedAt: "2026-07-20T12:00:00.000Z",
      content:
        "<h1>Reviews</h1><h2>Impossible Score — 8/5</h2><p>Read: 2024-01-09.</p>",
    };

    expect(parseReviewNotes([note])[0]).toMatchObject({
      title: "Impossible Score",
      reviewedAt: "2024-01-09T12:00:00.000Z",
    });
    expect(parseReviewNotes([note])[0]).not.toHaveProperty("rating");
  });
});
