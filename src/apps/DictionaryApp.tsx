import {
  BookOpen,
  Check,
  ChevronRight,
  GraduationCap,
  Library,
  Search,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePersistentState } from "../hooks/usePersistentState";
import {
  DIAGNOSTIC_WORD_IDS,
  INITIAL_VOCABULARY_PROGRESS,
  VOCABULARY_WORDS,
  definitionOptions,
  diagnosticResult,
  nextPracticeWord,
  recordVocabularyEncounter,
  vocabularyWord,
  wordOfTheDay,
  type VocabularyProgress,
  type VocabularyStatus,
  type VocabularyWord,
} from "../lib/vocabulary";

type DictionaryView = "today" | "learn" | "progress";

type Props = {
  onProgressChange: (progress: VocabularyProgress) => void;
  onOpenVocabularyJournal: () => void;
};

type DiagnosticAnswer = {
  wordId: string;
  correct: boolean;
};

const contextOptions = (word: VocabularyWord) => {
  const peers = VOCABULARY_WORDS.filter(
    (candidate) =>
      candidate.id !== word.id &&
      Math.abs(candidate.difficulty - word.difficulty) <= 1,
  )
    .slice(word.word.length % 3, word.word.length % 3 + 3)
    .map((candidate) => candidate.word);
  const options = [word.word, ...peers].slice(0, 4);
  const shift = word.id.length % options.length;
  return [...options.slice(shift), ...options.slice(0, shift)];
};

const statusLabel: Record<VocabularyStatus, string> = {
  learning: "Learning",
  familiar: "Familiar",
  mastered: "Mastered",
};

const progressCopy = (progress: VocabularyProgress) => {
  const mastered = progress.encounters.filter(
    (encounter) => encounter.status === "mastered",
  ).length;
  const familiar = progress.encounters.filter(
    (encounter) => encounter.status === "familiar",
  ).length;
  return { mastered, familiar, learning: progress.encounters.length - mastered - familiar };
};

export function DictionaryApp({
  onProgressChange,
  onOpenVocabularyJournal,
}: Props) {
  const [progress, setProgress] = usePersistentState<VocabularyProgress>(
    "macdashboard.dictionary.progress.v1",
    INITIAL_VOCABULARY_PROGRESS,
  );
  const [view, setView] = useState<DictionaryView>("today");
  const [query, setQuery] = useState("");
  const [lookupWordId, setLookupWordId] = useState<string | null>(null);
  const [diagnosticIndex, setDiagnosticIndex] = useState(0);
  const [diagnosticSelection, setDiagnosticSelection] = useState<string | null>(
    null,
  );
  const [diagnosticAnswers, setDiagnosticAnswers] = useState<
    DiagnosticAnswer[]
  >([]);
  const [practiceRound, setPracticeRound] = useState(0);
  const [practiceWordId, setPracticeWordId] = useState(
    () => nextPracticeWord(progress, 0).id,
  );
  const [practiceSelection, setPracticeSelection] = useState<string | null>(null);
  const [practiceAnswered, setPracticeAnswered] = useState(false);

  const diagnosticWord = vocabularyWord(
    DIAGNOSTIC_WORD_IDS[diagnosticIndex] ?? DIAGNOSTIC_WORD_IDS[0],
  )!;
  const dailyWord = wordOfTheDay(new Date(), progress);
  const displayedWord = vocabularyWord(lookupWordId ?? "") ?? dailyWord;
  const practiceWord = vocabularyWord(practiceWordId) ?? VOCABULARY_WORDS[0];
  const practiceKind = practiceRound % 2 === 0 ? "definition" : "context";
  const practiceChoices =
    practiceKind === "definition"
      ? definitionOptions(practiceWord)
      : contextOptions(practiceWord);
  const practiceCorrect =
    practiceKind === "definition" ? practiceWord.definition : practiceWord.word;

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return VOCABULARY_WORDS.filter(
      (word) =>
        word.word.toLowerCase().includes(normalized) ||
        word.definition.toLowerCase().includes(normalized),
    ).slice(0, 6);
  }, [query]);

  useEffect(() => {
    onProgressChange(progress);
  }, [onProgressChange, progress]);

  useEffect(() => {
    if (!progress.diagnostic) return;
    const encounter = progress.encounters.find(
      (item) => item.wordId === dailyWord.id,
    );
    if (encounter?.sources.includes("word-of-day")) return;
    setProgress((current) =>
      recordVocabularyEncounter(current, dailyWord.id, "word-of-day", {
        status: encounter?.status ?? "learning",
      }),
    );
  }, [dailyWord.id, progress.diagnostic, progress.encounters, setProgress]);

  const finishDiagnosticQuestion = () => {
    if (!diagnosticSelection) return;
    const answer = {
      wordId: diagnosticWord.id,
      correct: diagnosticSelection === diagnosticWord.definition,
    };
    const answers = [...diagnosticAnswers, answer];
    if (diagnosticIndex < DIAGNOSTIC_WORD_IDS.length - 1) {
      setDiagnosticAnswers(answers);
      setDiagnosticIndex((current) => current + 1);
      setDiagnosticSelection(null);
      return;
    }

    const now = new Date().toISOString();
    const correct = answers.filter((candidate) => candidate.correct).length;
    const result = diagnosticResult(correct, answers.length);
    let next: VocabularyProgress = {
      ...progress,
      diagnostic: { ...result, completedAt: now },
    };
    answers.forEach((candidate) => {
      next = recordVocabularyEncounter(next, candidate.wordId, "diagnostic", {
        correct: candidate.correct,
        status: candidate.correct ? "familiar" : "learning",
        at: now,
      });
    });
    setPracticeWordId(nextPracticeWord(next, 0).id);
    setProgress(next);
    setDiagnosticSelection(null);
    setDiagnosticAnswers([]);
    setView("today");
  };

  const updateDisplayedWord = (status: VocabularyStatus) => {
    setProgress((current) =>
      recordVocabularyEncounter(current, displayedWord.id, "lookup", { status }),
    );
  };

  const selectLookup = (word: VocabularyWord) => {
    setLookupWordId(word.id);
    setQuery("");
    setView("today");
    setProgress((current) =>
      recordVocabularyEncounter(current, word.id, "lookup", {
        status: "learning",
      }),
    );
  };

  const answerPractice = () => {
    if (!practiceSelection || practiceAnswered) return;
    const correct = practiceSelection === practiceCorrect;
    const today = new Date().toISOString().slice(0, 10);
    setProgress((current) => {
      const continued = current.lastPracticeAt?.slice(0, 10) === today;
      const recorded = recordVocabularyEncounter(
        current,
        practiceWord.id,
        "practice",
        { correct, status: correct ? "familiar" : "learning" },
      );
      return {
        ...recorded,
        practiceStreak: continued
          ? current.practiceStreak
          : current.practiceStreak + 1,
        lastPracticeAt: new Date().toISOString(),
      };
    });
    setPracticeAnswered(true);
  };

  const nextPractice = () => {
    const nextRound = practiceRound + 1;
    setPracticeRound(nextRound);
    setPracticeWordId(nextPracticeWord(progress, nextRound).id);
    setPracticeSelection(null);
    setPracticeAnswered(false);
  };

  if (!progress.diagnostic) {
    const options = definitionOptions(diagnosticWord);
    return (
      <main className="dictionary-diagnostic" aria-label="Vocabulary diagnostic">
        <section className="dictionary-diagnostic__intro">
          <span className="dictionary-seal" aria-hidden="true">
            <BookOpen />
          </span>
          <span className="eyebrow">First opening · one-time diagnostic</span>
          <h1>Find your word frontier.</h1>
          <p>
            Eight quick questions establish what is familiar, what is new, and
            where your lessons should begin. There is no penalty for “I don’t
            know”—that answer makes your practice more useful.
          </p>
          <div className="dictionary-diagnostic__meter" aria-hidden="true">
            <span
              style={{
                width: `${((diagnosticIndex + 1) / DIAGNOSTIC_WORD_IDS.length) * 100}%`,
              }}
            />
          </div>
          <small>
            Word {diagnosticIndex + 1} of {DIAGNOSTIC_WORD_IDS.length}
          </small>
        </section>
        <section className="dictionary-question-card">
          <span className="eyebrow">Which definition fits?</span>
          <h2>{diagnosticWord.word}</h2>
          <p className="dictionary-pronunciation">
            {diagnosticWord.pronunciation} · {diagnosticWord.partOfSpeech}
          </p>
          <div className="dictionary-answer-grid">
            {options.map((option) => (
              <button
                type="button"
                key={option}
                className={diagnosticSelection === option ? "is-selected" : ""}
                onClick={() => setDiagnosticSelection(option)}
              >
                {option}
              </button>
            ))}
            <button
              type="button"
              className={`dictionary-unknown ${
                diagnosticSelection === "unknown" ? "is-selected" : ""
              }`}
              onClick={() => setDiagnosticSelection("unknown")}
            >
              I don’t know this word yet
            </button>
          </div>
          <button
            type="button"
            className="dictionary-next-button"
            onClick={finishDiagnosticQuestion}
            disabled={!diagnosticSelection}
          >
            {diagnosticIndex === DIAGNOSTIC_WORD_IDS.length - 1
              ? "See my starting point"
              : "Next word"}
            <ChevronRight size={16} />
          </button>
        </section>
      </main>
    );
  }

  const counts = progressCopy(progress);

  return (
    <div className="dictionary-app">
      <aside className="dictionary-sidebar">
        <div className="dictionary-brand">
          <span className="dictionary-brand__mark" aria-hidden="true">
            <BookOpen />
          </span>
          <div>
            <strong>Dictionary</strong>
            <small>Words worth keeping</small>
          </div>
        </div>
        <div className="dictionary-search">
          <Search size={14} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search rare words"
            aria-label="Search rare words"
          />
        </div>
        {results.length > 0 && (
          <div className="dictionary-search-results">
            {results.map((word) => (
              <button type="button" key={word.id} onClick={() => selectLookup(word)}>
                <strong>{word.word}</strong>
                <span>{word.plainDefinition}</span>
              </button>
            ))}
          </div>
        )}
        <nav aria-label="Dictionary sections">
          <button
            type="button"
            className={view === "today" ? "is-selected" : ""}
            onClick={() => setView("today")}
          >
            <Sparkles size={15} /> Today
          </button>
          <button
            type="button"
            className={view === "learn" ? "is-selected" : ""}
            onClick={() => setView("learn")}
          >
            <GraduationCap size={15} /> Learn
          </button>
          <button
            type="button"
            className={view === "progress" ? "is-selected" : ""}
            onClick={() => setView("progress")}
          >
            <Library size={15} /> My Words
          </button>
        </nav>
        <div className="dictionary-level-card">
          <span>Starting point</span>
          <strong>{progress.diagnostic.label}</strong>
          <small>
            Band {progress.diagnostic.band} of 5 · {progress.diagnostic.correct}/
            {progress.diagnostic.total} known
          </small>
        </div>
        <button
          type="button"
          className="dictionary-journal-link"
          onClick={onOpenVocabularyJournal}
        >
          <Check size={14} /> Synced to Notes
        </button>
      </aside>

      <main className="dictionary-content">
        {view === "today" && (
          <article className="dictionary-entry">
            <header>
              <div>
                <span className="eyebrow">
                  {lookupWordId ? "Dictionary entry" : "Rare word of the day"}
                </span>
                <h1>{displayedWord.word}</h1>
                <p className="dictionary-pronunciation">
                  {displayedWord.pronunciation} · {displayedWord.partOfSpeech}
                </p>
              </div>
              <span className="dictionary-difficulty">
                Level {displayedWord.difficulty}
              </span>
            </header>
            <div className="dictionary-rule" />
            <section>
              <span className="dictionary-sense">1</span>
              <p className="dictionary-definition">{displayedWord.definition}</p>
              <p className="dictionary-example">“{displayedWord.example}”</p>
            </section>
            <section className="dictionary-etymology">
              <h2>ORIGIN</h2>
              <p>{displayedWord.etymology}</p>
            </section>
            <section className="dictionary-synonyms">
              <h2>SIMILAR WORDS</h2>
              <div>
                {displayedWord.synonyms.map((synonym) => (
                  <span key={synonym}>{synonym}</span>
                ))}
              </div>
            </section>
            <footer>
              <p>How well do you know this word?</p>
              <div>
                <button type="button" onClick={() => updateDisplayedWord("learning")}>
                  New to me
                </button>
                <button type="button" onClick={() => updateDisplayedWord("familiar")}>
                  Familiar
                </button>
                <button type="button" onClick={() => updateDisplayedWord("mastered")}>
                  I know it
                </button>
              </div>
            </footer>
          </article>
        )}

        {view === "learn" && (
          <section className="dictionary-learn">
            <header>
              <span className="eyebrow">Adaptive practice</span>
              <h1>Learn at the edge of what you know.</h1>
              <p>
                Practice prioritizes diagnostic misses, newer words, and the
                difficulty band just beyond your current vocabulary.
              </p>
            </header>
            <div className="dictionary-exercise-card">
              <div className="dictionary-exercise-meta">
                <span>Exercise {practiceRound + 1}</span>
                <span>{practiceKind === "definition" ? "Meaning" : "In context"}</span>
              </div>
              {practiceKind === "definition" ? (
                <>
                  <h2>What does “{practiceWord.word}” mean?</h2>
                  <p className="dictionary-pronunciation">
                    {practiceWord.pronunciation} · {practiceWord.partOfSpeech}
                  </p>
                </>
              ) : (
                <>
                  <h2>Choose the word that completes the sentence.</h2>
                  <blockquote>
                    {practiceWord.example.replace(
                      new RegExp(practiceWord.word, "i"),
                      "__________",
                    )}
                  </blockquote>
                </>
              )}
              <div className="dictionary-practice-options">
                {practiceChoices.map((choice) => {
                  const isCorrect = choice === practiceCorrect;
                  const selected = practiceSelection === choice;
                  return (
                    <button
                      type="button"
                      key={choice}
                      onClick={() => setPracticeSelection(choice)}
                      disabled={practiceAnswered}
                      className={`${selected ? "is-selected" : ""} ${
                        practiceAnswered && isCorrect ? "is-correct" : ""
                      } ${
                        practiceAnswered && selected && !isCorrect
                          ? "is-incorrect"
                          : ""
                      }`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
              {practiceAnswered && (
                <div className="dictionary-feedback" role="status">
                  <strong>
                    {practiceSelection === practiceCorrect
                      ? "Exactly right."
                      : `The answer is ${practiceCorrect}.`}
                  </strong>
                  <p>
                    {practiceWord.definition} {practiceWord.etymology}
                  </p>
                </div>
              )}
              <button
                type="button"
                className="dictionary-next-button"
                onClick={practiceAnswered ? nextPractice : answerPractice}
                disabled={!practiceSelection}
              >
                {practiceAnswered ? "Next exercise" : "Check answer"}
                <ChevronRight size={16} />
              </button>
            </div>
          </section>
        )}

        {view === "progress" && (
          <section className="dictionary-progress">
            <header>
              <span className="eyebrow">Your living lexicon</span>
              <h1>{progress.encounters.length} words encountered</h1>
              <p>Every entry below is also kept in your Vocabulary Journal in Notes.</p>
            </header>
            <div className="dictionary-stat-grid">
              <div><strong>{counts.learning}</strong><span>Learning</span></div>
              <div><strong>{counts.familiar}</strong><span>Familiar</span></div>
              <div><strong>{counts.mastered}</strong><span>Mastered</span></div>
              <div><strong>{progress.practiceStreak}</strong><span>Practice days</span></div>
            </div>
            <div className="dictionary-word-list">
              {progress.encounters.map((encounter) => {
                const word = vocabularyWord(encounter.wordId);
                if (!word) return null;
                return (
                  <button type="button" key={word.id} onClick={() => selectLookup(word)}>
                    <span>
                      <strong>{word.word}</strong>
                      <small>{word.plainDefinition}</small>
                    </span>
                    <em className={`is-${encounter.status}`}>
                      {statusLabel[encounter.status]}
                    </em>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
