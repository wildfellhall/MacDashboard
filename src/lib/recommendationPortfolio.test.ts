import { describe, expect, it } from "vitest";
import type { Book } from "../types";
import {
  diversifyBooks,
  plannedCandidateFor,
} from "./recommendationPortfolio";

const book = (
  title: string,
  author: string,
  score: number,
  genres: string[],
  themes: string[],
): Book & { score: number } => ({
  id: title.toLowerCase().replace(/\s+/g, "-"),
  title,
  author,
  year: "2020",
  cover: "https://example.com/cover.jpg",
  genres,
  themes,
  description: `${title} description`,
  kind: "discover",
  score,
});

describe("recommendation portfolio diversity", () => {
  it("does not allow one author or one Little Women-like cluster to fill the top slate", () => {
    const ranked = diversifyBooks([
      book("Little Women", "Louisa May Alcott", 99, ["classic"], ["sisters"]),
      book("Little Men", "Louisa May Alcott", 97, ["classic"], ["family"]),
      book("Jo's Boys", "Louisa May Alcott", 96, ["classic"], ["family"]),
      book("The Summer Book", "Tove Jansson", 92, ["literary fiction"], [
        "family intimacy",
        "island",
      ]),
      book("Piranesi", "Susanna Clarke", 91, ["speculative fiction"], [
        "architecture",
        "solitude",
      ]),
    ]);

    expect(ranked[0].title).toBe("Little Women");
    expect(ranked.slice(0, 3).map((item) => item.author)).toEqual(
      expect.arrayContaining(["Tove Jansson", "Susanna Clarke"]),
    );
    expect(
      ranked.slice(0, 3).filter((item) => item.author === "Louisa May Alcott"),
    ).toHaveLength(1);
  });

  it("matches an AI title plan to verified catalog metadata", () => {
    const item = book(
      "The Summer Book",
      "Tove Jansson",
      90,
      ["literary fiction"],
      ["island"],
    );
    expect(
      plannedCandidateFor(item, [
        {
          title: "The Summer Book",
          creator: "Tove Jansson",
          mediaType: "book",
          searchQuery: "The Summer Book Tove Jansson",
          fitScore: 92,
          rationale: "A varied fit.",
          evidenceNotes: ["Favorite books"],
          facets: ["quiet", "family"],
        },
      ])?.fitScore,
    ).toBe(92);
  });
});
