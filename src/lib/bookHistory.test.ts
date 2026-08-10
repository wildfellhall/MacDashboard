import { describe, expect, it } from "vitest";
import {
  bookHistoryAffinity,
  bookHistoryForTitle,
  parseBookHistory,
} from "./bookHistory";

describe("reading-history imports", () => {
  it("parses Goodreads-style quoted CSV without exposing review prose as affinity", () => {
    const entries = parseBookHistory(
      [
        "Title,Author,My Rating,Date Read,Bookshelves,My Review,Time Spent",
        '"The Memory Police","Yoko Ogawa",5,2024-02-03,"literary fiction, speculative fiction","Quiet and exact.",240',
      ].join("\n"),
      "goodreads_library_export.csv",
    );

    expect(bookHistoryForTitle("The Memory Police", entries)).toMatchObject({
      author: "Yoko Ogawa",
      rating: 5,
      readAt: "2024-02-03T00:00:00.000Z",
      minutes: 240,
      shelves: ["literary fiction", "speculative fiction"],
      review: "Quiet and exact.",
    });
    expect(bookHistoryAffinity(entries)).toEqual([
      "yoko ogawa",
      "literary fiction",
      "speculative fiction",
    ]);
    expect(bookHistoryAffinity(entries)).not.toContain("Quiet and exact.");
  });

  it("rejects malformed and out-of-range metadata safely", () => {
    const entries = parseBookHistory(
      JSON.stringify([
        {
          title: "A Book",
          rating: 9,
          readAt: "not a date",
          shelves: ["Mystery"],
        },
      ]),
      "books.json",
    );

    expect(entries[0]).toEqual({
      title: "A Book",
      shelves: ["mystery"],
    });
  });
});
