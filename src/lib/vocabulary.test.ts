import { describe, expect, it } from "vitest";
import {
  INITIAL_VOCABULARY_PROGRESS,
  VOCABULARY_QUESTIONS,
  VOCABULARY_WORDS,
  buildVocabularyJournalNote,
  diagnosticResult,
  nextPracticeWord,
  nextVocabularyQuestion,
  practiceNeedsIntroduction,
  recordVocabularyEncounter,
  recordVocabularyQuestionAnswer,
  vocabularyQuestionsForWord,
  wordOfTheDay,
  type VocabularyProgress,
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
    expect(practiceNeedsIntroduction(missed, "quotidian")).toBe(true);
    const taught = recordVocabularyEncounter(missed, "quotidian", "practice", {
      taught: true,
      at: "2026-08-13T12:05:00.000Z",
    });
    expect(practiceNeedsIntroduction(taught, "quotidian")).toBe(false);
    const known = recordVocabularyEncounter(missed, "quotidian", "practice", {
      status: "familiar",
    });
    expect(practiceNeedsIntroduction(known, "quotidian")).toBe(false);
  });

  it("offers a much larger word and application bank", () => {
    expect(VOCABULARY_WORDS.length).toBeGreaterThanOrEqual(40);
    expect(VOCABULARY_QUESTIONS.length).toBe(VOCABULARY_WORDS.length * 4);
    expect(
      vocabularyQuestionsForWord(VOCABULARY_WORDS[0]).map(
        (question) => question.kind,
      ),
    ).toEqual(["definition", "context", "synonym", "usage"]);
    for (const question of VOCABULARY_QUESTIONS) {
      expect(question.choices).toHaveLength(4);
      expect(new Set(question.choices).size).toBe(4);
      expect(question.choices).toContain(question.correct);
    }
  });

  it("never selects a question that has already been answered", () => {
    let progress: VocabularyProgress = {
      ...INITIAL_VOCABULARY_PROGRESS,
      diagnostic: {
        ...diagnosticResult(4, 8),
        completedAt: "2026-08-13T12:00:00.000Z",
      },
    };
    const ids: string[] = [];
    for (let index = 0; index < VOCABULARY_QUESTIONS.length; index += 1) {
      const question = nextVocabularyQuestion(progress);
      expect(question).toBeTruthy();
      ids.push(question!.id);
      progress = recordVocabularyQuestionAnswer(progress, question!.id);
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(nextVocabularyQuestion(progress)).toBeUndefined();
  });

  it("migrates old progress attempts into retired question IDs", () => {
    const oldProgress = recordVocabularyEncounter(
      {
        ...INITIAL_VOCABULARY_PROGRESS,
        answeredQuestionIds: undefined,
      },
      "pellucid",
      "practice",
      { correct: true },
    );
    expect(nextVocabularyQuestion(oldProgress)?.id).not.toBe(
      "pellucid:definition",
    );
  });
});
