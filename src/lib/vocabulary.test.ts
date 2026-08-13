import { describe, expect, it } from "vitest";
import {
  INITIAL_VOCABULARY_PROGRESS,
  buildVocabularyJournalNote,
  diagnosticResult,
  nextPracticeWord,
  recordVocabularyEncounter,
  wordOfTheDay,
} from "./vocabulary";

describe("vocabulary learning model", () => {
  it("places learners in a useful diagnostic band", () => {
    expect(diagnosticResult(0, 8)).toMatchObject({
      band: 1,
      label: "Word Curious",
    });
    expect(diagnosticResult(5, 8)).toMatchObject({
      band: 3,
      label: "Lexical Explorer",
    });
    expect(diagnosticResult(8, 8)).toMatchObject({
      band: 5,
      label: "Rare-Word Savant",
    });
  });

  it("keeps one deterministic, level-aware word for a calendar day", () => {
    const progress = {
      ...INITIAL_VOCABULARY_PROGRESS,
      diagnostic: {
        ...diagnosticResult(5, 8),
        completedAt: "2026-08-13T12:00:00.000Z",
      },
    };
    const date = new Date(2026, 7, 13);
    expect(wordOfTheDay(date, progress)).toEqual(wordOfTheDay(date, progress));
    expect(wordOfTheDay(date, progress).difficulty).toBeGreaterThanOrEqual(2);
    expect(wordOfTheDay(date, progress).difficulty).toBeLessThanOrEqual(4);
  });

  it("records encounters and produces a readable Notes journal", () => {
    const progress = recordVocabularyEncounter(
      INITIAL_VOCABULARY_PROGRESS,
      "pellucid",
      "practice",
      {
        correct: true,
        at: "2026-08-13T12:00:00.000Z",
      },
    );
    const note = buildVocabularyJournalNote(progress);
    expect(note.id).toBe("vocabulary-journal");
    expect(note.title).toBe("Vocabulary Journal");
    expect(note.content).toContain("pellucid");
    expect(note.content).toContain("Translucently clear");
    expect(note.content).toContain("Practice");
  });

  it("teaches a diagnostic miss before introducing an unseen neighbor", () => {
    const missed = recordVocabularyEncounter(
      {
        ...INITIAL_VOCABULARY_PROGRESS,
        diagnostic: {
          ...diagnosticResult(2, 8),
          completedAt: "2026-08-13T12:00:00.000Z",
        },
      },
      "quotidian",
      "diagnostic",
      { correct: false, at: "2026-08-13T12:00:00.000Z" },
    );
    expect(nextPracticeWord(missed).id).toBe("quotidian");
  });
});
