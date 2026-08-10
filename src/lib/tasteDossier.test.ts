// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { Book, Note } from "../types";
import {
  buildTasteDiscoverySeeds,
  buildTasteDossier,
  matchTasteDossier,
} from "./tasteDossier";

const note = (
  id: string,
  title: string,
  content: string,
  folder: Note["folder"] = "Personal",
): Note => ({
  id,
  title,
  folder,
  content,
  updatedAt: "2026-07-30T12:00:00.000Z",
});

const candidateValues = (book: Book) => [
  book.title,
  book.author,
  book.description,
  ...book.genres,
  ...book.themes,
];

describe("whole-note taste dossier", () => {
  it("keeps nuanced positive and negative clauses as separate evidence", () => {
    const dossier = buildTasteDossier([
      note(
        "fiction",
        "What I value in books",
        "<p>I love dreamlike architecture and compassionate solitude, but dislike cynical grimness.</p>",
      ),
    ]);

    expect(dossier).toMatchObject({
      currentNoteCount: 1,
      evidenceNoteCount: 1,
      evidenceCount: 2,
    });
    expect(dossier.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          polarity: "positive",
          passage: expect.stringMatching(/dreamlike architecture/i),
          domains: expect.arrayContaining(["books"]),
        }),
        expect.objectContaining({
          polarity: "negative",
          passage: expect.stringMatching(/cynical grimness/i),
          domains: expect.arrayContaining(["books"]),
        }),
      ]),
    );
  });

  it("understands a desired quality and a negated trait in the same clause", () => {
    const dossier = buildTasteDossier([
      note(
        "mysteries",
        "Books I love",
        "<p>I love intricate mysteries without cynicism.</p>",
      ),
    ]);

    expect(dossier.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          polarity: "positive",
          passage: expect.stringMatching(/intricate mysteries/i),
        }),
        expect.objectContaining({
          polarity: "negative",
          passage: expect.stringMatching(/avoid cynicism/i),
          concepts: expect.arrayContaining(["cynicism"]),
        }),
      ]),
    );
  });

  it("uses descriptions, multiple Notes, and negative constraints in ranking", () => {
    const dossier = buildTasteDossier([
      note(
        "fiction",
        "Books I love",
        "<p>I love dreamlike architecture and compassionate solitude.</p>",
      ),
      note(
        "pacing",
        "Reading preferences",
        "<p>I prefer quiet, contemplative stories with humane characters.</p><p>I avoid bleak and cynical endings.</p>",
      ),
    ]);
    const fitting: Book = {
      id: "fit",
      title: "The House of Echoes",
      author: "A. Writer",
      year: "2026",
      cover: "",
      genres: ["Literary fiction"],
      themes: ["Architecture"],
      description:
        "A dreamlike, quiet novel about a compassionate solitary keeper in an impossible house.",
      kind: "discover",
    };
    const conflicting: Book = {
      ...fitting,
      id: "conflict",
      title: "The Iron City",
      description:
        "A bleak, cynical and nihilistic architectural fable with a cruel ending.",
    };

    const fittingMatch = matchTasteDossier(
      candidateValues(fitting),
      dossier,
      "books",
    );
    const conflictingMatch = matchTasteDossier(
      candidateValues(conflicting),
      dossier,
      "books",
    );

    expect(fittingMatch.adjustment).toBeGreaterThan(10);
    expect(fittingMatch.sourceNoteTitles).toEqual(
      expect.arrayContaining(["Books I love", "Reading preferences"]),
    );
    expect(fittingMatch.summary).toMatch(/Evidence match/);
    expect(conflictingMatch.adjustment).toBeLessThan(fittingMatch.adjustment);
    expect(conflictingMatch.negative.length).toBeGreaterThan(0);
  });

  it("rescans current Notes so editing and deletion retract old evidence", () => {
    const visual = note(
      "visual",
      "Visual inspiration",
      "<p>I love misty observatories at blue hour.</p>",
    );
    const before = buildTasteDossier([visual]);
    const afterEdit = buildTasteDossier([
      { ...visual, content: "<p>I love sunlit botanical courtyards.</p>" },
    ]);
    const afterDelete = buildTasteDossier([]);

    expect(buildTasteDiscoverySeeds(before, "photos")).toEqual(
      expect.arrayContaining([expect.stringMatching(/misty observatory/)]),
    );
    expect(buildTasteDiscoverySeeds(afterEdit, "photos").join(" ")).not.toMatch(
      /misty|observatory/,
    );
    expect(afterDelete).toEqual({
      currentNoteCount: 0,
      evidenceNoteCount: 0,
      evidenceCount: 0,
      evidence: [],
    });
  });

  it("scans every current Note while excluding prose with no taste evidence", () => {
    const dossier = buildTasteDossier([
      note("taste", "Favorite films", "<ul><li>Quiet character studies</li></ul>"),
      note("errand", "Errands", "<p>Pick up printer paper on Tuesday.</p>"),
      note(
        "travel",
        "Travel thought",
        "<p>I loved the weathered coastal houses and muted colors.</p>",
      ),
    ]);

    expect(dossier.currentNoteCount).toBe(3);
    expect(dossier.evidenceNoteCount).toBe(2);
    expect(dossier.evidence.some((item) => item.noteId === "errand")).toBe(false);
    expect(dossier.evidence.some((item) => item.noteId === "travel")).toBe(true);
  });
});
