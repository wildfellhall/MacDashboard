import {
  BookMarked,
  Check,
  ChevronRight,
  ExternalLink,
  FileUp,
  Library,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { usePersistentState } from "../hooks/usePersistentState";
import {
  bookHistoryForTitle,
  parseBookHistory,
  type BookHistoryState,
} from "../lib/bookHistory";
import { recommendationReason, scoreBook } from "../lib/profile";
import { diversifyBooks } from "../lib/recommendationPortfolio";
import { reviewForTitle } from "../lib/reviewHistory";
import {
  matchTasteDossier,
  type TasteDossier,
} from "../lib/tasteDossier";
import type {
  AppCommand,
  Book,
  FeedbackHandler,
  Profile,
  ReviewRecord,
} from "../types";

type Props = {
  profile: Profile;
  onFeedback?: FeedbackHandler;
  command?: AppCommand;
  reviews: ReviewRecord[];
  onSelectItem?: (itemId: string) => void;
  history: BookHistoryState | null;
  onChangeHistory: (history: BookHistoryState | null) => void;
  books: Book[];
  onDiscover: (query: string) => Promise<{
    added: number;
    found: number;
    aiPowered: boolean;
    summary: string;
  }>;
  tasteDossier: TasteDossier;
};

type View = "discover" | "reread" | "saved";
type Sort = "match" | "title";

export function BooksApp({
  profile,
  onFeedback,
  command,
  reviews,
  onSelectItem,
  history,
  onChangeHistory,
  books: catalog,
  onDiscover,
  tasteDossier,
}: Props) {
  const [view, setView] = useState<View>(() =>
    command?.view && ["discover", "reread", "saved"].includes(command.view)
      ? (command.view as View)
      : "discover",
  );
  const [saved, setSaved] = usePersistentState<string[]>(
    "macdashboard.books.saved.v1",
    [],
  );
  const [query, setQuery] = useState(command?.query ?? "");
  const [sort, setSort] = useState<Sort>("match");
  const [activeId, setActiveId] = useState(command?.itemId ?? null);
  const [feedback, setFeedback] = usePersistentState<
    Record<string, "more" | "less">
  >("macdashboard.books.feedback.v1", {});
  const [importStatus, setImportStatus] = useState("");
  const [discoveryStatus, setDiscoveryStatus] = useState("");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const books = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const scored = catalog.map((book) => {
      const review = reviewForTitle(book.title, reviews);
      const imported = bookHistoryForTitle(
        book.title,
        history?.entries ?? [],
      );
      return review || imported
        ? {
            ...book,
            kind: "reread" as const,
            rating: imported?.rating ?? review?.rating ?? book.rating,
            minutes: imported?.minutes ?? review?.minutes ?? book.minutes,
            lastRead:
              imported?.readAt?.slice(0, 10) ??
              review?.reviewedAt.slice(0, 10),
          }
        : book;
    })
      .filter((book) =>
      view === "saved" ? saved.includes(book.id) : book.kind === view,
    )
      .filter((book) =>
        normalizedQuery
          ? [
              book.title,
              book.author,
              book.description,
              ...book.genres,
              ...book.themes,
              ...(book.discoveryPrompt ? [book.discoveryPrompt] : []),
            ]
              .join(" ")
              .toLowerCase()
              .includes(normalizedQuery)
          : true,
      )
      .map((book) => ({
        ...book,
        tasteMatch: matchTasteDossier(
          [
            book.title,
            book.author,
            book.description,
            ...book.genres,
            ...book.themes,
          ],
          tasteDossier,
          "books",
        ),
        score: Math.min(
          99,
          Math.max(
          1,
          scoreBook(book, profile, tasteDossier) +
            (feedback[book.id] === "more"
              ? 3
              : feedback[book.id] === "less"
                ? -12
                : 0),
          ),
        ),
      }));
    return sort === "title"
      ? scored.sort((left, right) => left.title.localeCompare(right.title))
      : diversifyBooks(scored.sort((left, right) => right.score - left.score));
  }, [
    catalog,
    feedback,
    history,
    profile,
    query,
    reviews,
    saved,
    sort,
    tasteDossier,
    view,
  ]);

  const hero = books.find((book) => book.id === activeId) ?? books[0];
  const shelfBooks = books.filter((book) => book.id !== hero?.id);
  const title =
    view === "discover"
      ? "A good next book"
      : view === "reread"
        ? "Worth returning to"
        : "Want to Read";
  const shelfTitle =
    view === "discover"
      ? "More connections"
      : view === "reread"
        ? "Reread timing"
        : "Your saved recommendations";

  const toggleSaved = (id: string) => {
    setSaved((items) => {
      const book = catalog.find((item) => item.id === id);
      if (items.includes(id)) {
        if (book) {
          onFeedback?.(
            {
              appId: "books",
              targetId: book.id,
              targetTitle: book.title,
              tags: [...book.genres, ...book.themes],
              kind: "saved",
            },
            false,
          );
        }
        return items.filter((savedId) => savedId !== id);
      }
      if (book) {
        onFeedback?.({
          appId: "books",
          targetId: book.id,
          targetTitle: book.title,
          tags: [...book.genres, ...book.themes],
          kind: "saved",
        });
      }
      return [...items, id];
    });
  };

  const toggleFeedback = (id: string, value: "more" | "less") => {
    const book = catalog.find((item) => item.id === id);
    if (!book) return;

    const eventFor = (choice: "more" | "less") => ({
      appId: "books" as const,
      targetId: book.id,
      targetTitle: book.title,
      tags: [...book.genres, ...book.themes],
      kind: choice === "more" ? ("liked" as const) : ("dismissed" as const),
    });
    const previous = feedback[id];

    if (previous === value) {
      onFeedback?.(eventFor(value), false);
    } else {
      if (previous) onFeedback?.(eventFor(previous), false);
      onFeedback?.(eventFor(value), true);
    }

    setFeedback((items) => {
      if (items[id] !== value) return { ...items, [id]: value };
      const next = { ...items };
      delete next[id];
      return next;
    });
  };

  const importHistory = async (file?: File) => {
    if (!file) return;
    setImportStatus(`Reading ${file.name} locally…`);
    try {
      const entries = parseBookHistory(await file.text(), file.name);
      onChangeHistory({
        fileName: file.name,
        entries,
        importedAt: new Date().toISOString(),
      });
      setImportStatus(
        `Imported ${entries.length} private reading ${
          entries.length === 1 ? "entry" : "entries"
        }. Review prose stays local.`,
      );
    } catch (error) {
      setImportStatus(
        error instanceof Error ? error.message : "Reading history import failed.",
      );
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const discoverBooks = async () => {
    setIsDiscovering(true);
    setDiscoveryStatus(
      "AI is synthesizing your full taste dossier, then verifying real books in Open Library…",
    );
    try {
      const result = await onDiscover(query.trim());
      setView("discover");
      setDiscoveryStatus(
        result.added > 0
          ? `Added ${result.added} verified ${
              result.added === 1 ? "recommendation" : "recommendations"
            }. AI synthesis: ${result.summary}`
          : result.found > 0
            ? `The verified matches are already in your dashboard. ${result.summary}`
            : `No verified catalog matches were found. ${result.summary}`,
      );
    } catch (error) {
      setDiscoveryStatus(
        error instanceof Error
          ? error.message
          : "Open Library discovery is unavailable right now.",
      );
    } finally {
      setIsDiscovering(false);
    }
  };

  return (
    <div className="media-app books-app">
      <aside className="media-sidebar">
        <h2>Books</h2>
        <label className="search-field">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isDiscovering) {
                event.preventDefault();
                void discoverBooks();
              }
            }}
            placeholder="Search Books"
            aria-label="Search book recommendations"
          />
        </label>
        <nav aria-label="Books navigation">
          <div className="app-sidebar-title">Read Now</div>
          <button
            type="button"
            className={view === "discover" ? "is-selected" : ""}
            onClick={() => setView("discover")}
          >
            <Sparkles size={17} />
            Top Picks
          </button>
          <button
            type="button"
            className={view === "reread" ? "is-selected" : ""}
            onClick={() => setView("reread")}
          >
            <BookMarked size={17} />
            Return To
          </button>
          <div className="app-sidebar-title" style={{ marginTop: 13 }}>
            Library
          </div>
          <button
            type="button"
            className={view === "saved" ? "is-selected" : ""}
            onClick={() => setView("saved")}
          >
            <Library size={17} />
            Want to Read
            <em style={{ marginLeft: "auto", fontStyle: "normal" }}>
              {saved.length}
            </em>
          </button>
        </nav>
        <div className="signal-card">
          <span>Whole-Notes taste dossier</span>
          <strong>{tasteDossier.evidenceCount}</strong>
          <p>
            evidence passages from {tasteDossier.evidenceNoteCount} of{" "}
            {tasteDossier.currentNoteCount} current Notes. Every Note is
            rescanned after edits or deletion.
          </p>
        </div>
        <div className="book-import-card">
          <strong>Reading history</strong>
          <p>
            {history
              ? `${history.fileName} · ${history.entries.length} local ${
                  history.entries.length === 1 ? "entry" : "entries"
                }.`
              : "Import a Goodreads or Apple Books-style CSV/JSON export."}
          </p>
          {importStatus && <p role="status">{importStatus}</p>}
          <input
            ref={importRef}
            type="file"
            accept=".csv,.json"
            hidden
            aria-label="Choose a reading history export"
            onChange={(event) =>
              void importHistory(event.target.files?.[0])
            }
          />
          <button type="button" onClick={() => importRef.current?.click()}>
            <FileUp size={13} />
            {history ? "Replace history" : "Choose export file"}
          </button>
          {history && (
            <button
              type="button"
              onClick={() => {
                onChangeHistory(null);
                setImportStatus(
                  "Reading history removed from this dashboard.",
                );
              }}
            >
              Forget history
            </button>
          )}
        </div>
      </aside>

      <main className="media-main">
        <header className="media-heading">
          <div>
            <span className="eyebrow">
              {view === "saved" ? "Your library" : "Curated for you"}
            </span>
            <h1>{title}</h1>
          </div>
          <div className="media-heading-actions">
            <button
              type="button"
              className="discovery-button"
              onClick={() => void discoverBooks()}
              disabled={isDiscovering}
              aria-label="Find new books on Open Library"
            >
              <RefreshCw
                size={13}
                className={isDiscovering ? "is-spinning" : ""}
              />
              {isDiscovering ? "Searching…" : "Find New Books"}
            </button>
            <label
              aria-label="Sort books"
              style={{
                alignItems: "center",
                display: "flex",
                gap: 6,
                color: "#77716b",
                fontSize: 9,
              }}
            >
              Sort
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
                style={{
                  border: "1px solid rgba(0,0,0,.08)",
                  borderRadius: 7,
                  background: "rgba(255,255,255,.58)",
                  padding: "5px 7px",
                  color: "inherit",
                  font: "inherit",
                }}
              >
                <option value="match">Best Match</option>
                <option value="title">Title</option>
              </select>
            </label>
          </div>
        </header>
        {discoveryStatus && (
          <p className="discovery-status" role="status">
            {discoveryStatus}
          </p>
        )}

        {!hero ? (
          <section className="signal-card" style={{ marginTop: 22 }}>
            <strong style={{ fontSize: 18 }}>
              {query ? "No books found" : "Nothing saved yet"}
            </strong>
            <p>
              {query
                ? "Try another title, author, genre, or theme."
                : "Choose Top Picks, then add a recommendation to Want to Read."}
            </p>
          </section>
        ) : (
          <>
            <section className="book-hero">
              <img src={hero.cover} alt={`Cover of ${hero.title}`} />
              <div className="book-hero-copy">
                <span className="match-pill">{hero.score}% match</span>
                <h2>{hero.title}</h2>
                <p className="creator-line">
                  {hero.author} · {hero.year}
                  {hero.lastRead && ` · Last read ${hero.lastRead.slice(0, 4)}`}
                </p>
                {hero.sourceUrl && (
                  <a
                    className="recommendation-source"
                    href={hero.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {hero.sourceLabel ?? "Open source"}
                    <ExternalLink size={11} />
                  </a>
                )}
                <p>{hero.description}</p>
                <div className="tag-row">
                  {[...hero.genres, ...hero.themes].slice(0, 4).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <div className="why-row">
                  <Sparkles size={15} />
                  <div>
                    <p>
                      {hero.aiReason ||
                        hero.tasteMatch.summary ||
                        recommendationReason(
                          [
                            hero.title,
                            hero.author,
                            ...hero.genres,
                            ...hero.themes,
                          ],
                          profile,
                          "A high-quality bridge from your saved literary interests.",
                        )}
                    </p>
                    {hero.aiEvidenceNotes?.length ? (
                      <p className="taste-evidence-quote">
                        AI synthesis across{" "}
                        {hero.aiEvidenceNotes
                          .map((noteTitle) => `“${noteTitle}”`)
                          .join(", ")}
                        .
                      </p>
                    ) : null}
                    {hero.tasteMatch.positive[0] && (
                      <p className="taste-evidence-quote">
                        “{hero.tasteMatch.positive[0].passage}” —{" "}
                        {hero.tasteMatch.positive[0].noteTitle}
                      </p>
                    )}
                    <p style={{ marginTop: "4px" }}>
                      {view === "reread" && hero.rating
                        ? `Your ${hero.rating}/5 rating and the time since your ${hero.lastRead?.slice(0, 4)} read make this a timely return.`
                        : "Match combines theme, genre, quality, and enough novelty to feel distinct."}
                    </p>
                  </div>
                </div>
                <div
                  style={{ display: "flex", flexWrap: "wrap", gap: 7 }}
                  aria-label={`Feedback for ${hero.title}`}
                >
                  <button
                    className={`primary-button ${
                      saved.includes(hero.id) ? "is-saved" : ""
                    }`}
                    type="button"
                    onClick={() => toggleSaved(hero.id)}
                  >
                    {saved.includes(hero.id) && <Check size={14} />}
                    {saved.includes(hero.id)
                      ? "In Want to Read"
                      : "Want to Read"}
                  </button>
                  <button
                    type="button"
                    className="primary-button is-saved"
                    aria-pressed={feedback[hero.id] === "more"}
                    onClick={() => toggleFeedback(hero.id, "more")}
                  >
                    <ThumbsUp size={14} />
                    More like this
                  </button>
                  <button
                    type="button"
                    className="primary-button is-saved"
                    aria-pressed={feedback[hero.id] === "less"}
                    onClick={() => toggleFeedback(hero.id, "less")}
                  >
                    <ThumbsDown size={14} />
                    Not for me
                  </button>
                </div>
              </div>
            </section>

            <section className="recommendation-section">
              <div className="section-title-row">
                <div>
                  <span className="eyebrow">Knowledge graph</span>
                  <h2>{shelfTitle}</h2>
                </div>
                <button type="button" onClick={() => setSort("title")}>
                  Browse by title <ChevronRight size={14} />
                </button>
              </div>
              {shelfBooks.length === 0 ? (
                <div className="signal-card" style={{ marginTop: 0 }}>
                  <span>Up to date</span>
                  <p>
                    This is the only strong match in this collection right now.
                    Add more reviews or taste notes to reveal new connections.
                  </p>
                </div>
              ) : (
                <div className="book-grid">
                  {shelfBooks.map((book) => (
                    <article className="book-card" key={book.id}>
                      <button
                        type="button"
                        className="book-cover-wrap"
                        onClick={() => {
                          setActiveId(book.id);
                          onSelectItem?.(book.id);
                          onFeedback?.({
                            appId: "books",
                            targetId: book.id,
                            targetTitle: book.title,
                            tags: [...book.genres, ...book.themes],
                            kind: "opened",
                          });
                        }}
                        aria-label={`Open ${book.title}`}
                        style={{
                          display: "block",
                          padding: 0,
                          border: 0,
                          background: "transparent",
                          textAlign: "left",
                        }}
                      >
                        <img src={book.cover} alt={`Cover of ${book.title}`} />
                        <span>{book.score}%</span>
                      </button>
                      <h3>{book.title}</h3>
                      <p>{book.author}</p>
                      <div className="rating-row">
                        {book.rating && (
                          <>
                            <Star size={12} fill="currentColor" />
                            {book.rating}
                          </>
                        )}
                        {saved.includes(book.id) && (
                          <span>
                            <Check size={10} /> Saved
                          </span>
                        )}
                        {!saved.includes(book.id) && book.lastRead && (
                          <span>Last read {book.lastRead.slice(0, 4)}</span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
