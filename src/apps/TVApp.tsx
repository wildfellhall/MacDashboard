import {
  Check,
  Clock3,
  ExternalLink,
  History,
  ListPlus,
  MonitorPlay,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { usePersistentState } from "../hooks/usePersistentState";
import {
  recommendationReason,
  scoreWatchItem,
} from "../lib/profile";
import { diversifyWatchItems } from "../lib/recommendationPortfolio";
import {
  latestWatchFor,
  parseViewingHistory,
  wasWatched,
  type ViewingHistoryState,
} from "../lib/viewingHistory";
import { reviewForTitle } from "../lib/reviewHistory";
import {
  matchTasteDossier,
  type TasteDossier,
} from "../lib/tasteDossier";
import type {
  AppCommand,
  FeedbackHandler,
  Profile,
  ReviewRecord,
  WatchItem,
} from "../types";

type Props = {
  profile: Profile;
  onFeedback?: FeedbackHandler;
  command?: AppCommand;
  reviews: ReviewRecord[];
  history: ViewingHistoryState | null;
  onChangeHistory: (history: ViewingHistoryState | null) => void;
  onSelectItem?: (itemId: string) => void;
  catalogItems: WatchItem[];
  onDiscover: (query: string) => Promise<{
    added: number;
    found: number;
    sources: string[];
    region: string;
    tmdbConfigured: boolean;
    aiPowered: boolean;
    summary: string;
  }>;
  tasteDossier: TasteDossier;
};

type View = "discover" | "rewatch" | "upNext";

export function TVApp({
  profile,
  onFeedback,
  command,
  reviews,
  history,
  onChangeHistory,
  onSelectItem,
  catalogItems,
  onDiscover,
  tasteDossier,
}: Props) {
  const [view, setView] = useState<View>(() =>
    command?.view && ["discover", "rewatch", "upNext"].includes(command.view)
      ? (command.view as View)
      : "discover",
  );
  const [watchlist, setWatchlist] = usePersistentState<string[]>(
    "macdashboard.tv.watchlist.v1",
    [],
  );
  const [query, setQuery] = useState(command?.query ?? "");
  const [activeId, setActiveId] = useState<string | null>(
    command?.itemId ?? null,
  );
  const [showDetails, setShowDetails] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [discoveryStatus, setDiscoveryStatus] = useState("");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [platformFilter, setPlatformFilter] = useState("all");
  const importRef = useRef<HTMLInputElement>(null);

  const catalog = useMemo(
    () =>
      catalogItems.map((item) => {
        const review = reviewForTitle(item.title, reviews);
        const importedDate = latestWatchFor(
          item.title,
          history?.entries ?? [],
        );
        const imported = wasWatched(
          item.title,
          history?.entries ?? [],
        );
        return imported || review
          ? {
              ...item,
              kind: "rewatch" as const,
              lastWatched:
                importedDate ?? review?.reviewedAt.slice(0, 10),
              rating: review?.rating ?? item.rating,
            }
          : item;
      }),
    [catalogItems, history, reviews],
  );

  const availablePlatforms = useMemo(
    () =>
      [...new Set(catalog.flatMap((item) => item.platforms ?? []))].sort(
        (left, right) => left.localeCompare(right),
      ),
    [catalog],
  );
  const hasTmdbData = useMemo(
    () =>
      catalog.some((item) =>
        item.providerAttribution?.includes("TMDB"),
      ),
    [catalog],
  );

  const items = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const scored = catalog.filter((item) =>
      view === "upNext"
        ? watchlist.includes(item.id)
        : item.kind === view,
    )
      .filter((item) =>
        normalizedQuery
          ? [
              item.title,
              item.description,
              item.runtime,
              ...item.genres,
              ...item.moods,
              ...(item.platforms ?? []),
              ...(item.providers ?? []).flatMap((provider) => [
                provider.name,
                provider.type,
              ]),
              ...(item.mediaType ? [item.mediaType] : []),
              ...(item.discoveryPrompt ? [item.discoveryPrompt] : []),
            ]
              .join(" ")
              .toLowerCase()
              .includes(normalizedQuery)
          : true,
      )
      .filter((item) =>
        platformFilter === "all"
          ? true
          : item.platforms?.includes(platformFilter),
      )
      .map((item) => ({
        ...item,
        score: scoreWatchItem(item, profile, tasteDossier),
        tasteMatch: matchTasteDossier(
          [
            item.title,
            item.description,
            ...item.genres,
            ...item.moods,
            ...(item.platforms ?? []),
          ],
          tasteDossier,
          "tv",
        ),
      }));
    return diversifyWatchItems(
      scored.sort((left, right) => right.score - left.score),
    );
  }, [
    catalog,
    platformFilter,
    profile,
    query,
    tasteDossier,
    view,
    watchlist,
  ]);

  const hero = items.find((item) => item.id === activeId) ?? items[0];
  const shelfTitle =
    view === "discover"
      ? "More to explore"
      : view === "rewatch"
        ? "Rewatch window"
        : "Your Up Next queue";

  const selectView = (nextView: View) => {
    setView(nextView);
    setActiveId(null);
    setShowDetails(false);
  };

  const toggleWatchlist = (id: string) => {
    setWatchlist((items) => {
      const item = catalog.find((candidate) => candidate.id === id);
      if (items.includes(id)) {
        if (item) {
          onFeedback?.(
            {
              appId: "tv",
              targetId: item.id,
              targetTitle: item.title,
              tags: [
                ...item.genres,
                ...item.moods,
                ...(item.platforms ?? []),
              ],
              kind: "saved",
            },
            false,
          );
        }
        return items.filter((watchId) => watchId !== id);
      }
      if (item) {
        onFeedback?.({
          appId: "tv",
          targetId: item.id,
          targetTitle: item.title,
          tags: [
            ...item.genres,
            ...item.moods,
            ...(item.platforms ?? []),
          ],
          kind: "saved",
        });
      }
      return [...items, id];
    });
  };

  const importHistory = async (file?: File) => {
    if (!file) return;
    setImportStatus(`Reading ${file.name} locally…`);
    try {
      const entries = parseViewingHistory(await file.text(), file.name);
      onChangeHistory({
        fileName: file.name,
        entries,
        importedAt: new Date().toISOString(),
      });
      setImportStatus(
        `Imported ${entries.length} private history ${
          entries.length === 1 ? "entry" : "entries"
        }. Nothing was uploaded.`,
      );
    } catch (error) {
      setImportStatus(
        error instanceof Error ? error.message : "History import failed.",
      );
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const discoverTitles = async () => {
    const recentHistoryTitle = [...(history?.entries ?? [])]
      .sort((left, right) =>
        (right.watchedAt ?? "").localeCompare(left.watchedAt ?? ""),
      )[0]?.title.split(":")[0].trim();
    const usesRecentHistory = Boolean(!query.trim() && recentHistoryTitle);
    const discoveryQuery = query.trim() || recentHistoryTitle || "";
    setIsDiscovering(true);
    setDiscoveryStatus(
      "AI is building a varied slate from your full profile, then verifying titles and providers…",
    );
    try {
      const result = await onDiscover(discoveryQuery);
      if (usesRecentHistory && recentHistoryTitle) {
        setQuery(recentHistoryTitle);
      }
      selectView(usesRecentHistory ? "rewatch" : "discover");
      setPlatformFilter("all");
      const sourceSummary =
        result.sources.length > 0
          ? result.sources.join(", ")
          : "the web catalogs";
      setDiscoveryStatus(
        result.added > 0
          ? `Added ${result.added} fresh ${
              result.added === 1 ? "title" : "titles"
            } from ${sourceSummary}. AI synthesis: ${result.summary} Availability region: ${result.region}.`
          : result.found > 0
            ? `These ${sourceSummary} matches are already in your dashboard. ${result.summary}`
            : `No verified ${sourceSummary} matches were found. ${result.summary}`,
      );
    } catch (error) {
      setDiscoveryStatus(
        error instanceof Error
          ? error.message
          : "Fresh TV discovery is unavailable.",
      );
    } finally {
      setIsDiscovering(false);
    }
  };

  return (
    <div className="tv-app">
      <aside className="tv-sidebar">
        <div className="tv-wordmark">
          <span>▶</span> tv
        </div>
        <div className="search-field search-field--dark">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isDiscovering) {
                event.preventDefault();
                void discoverTitles();
              }
            }}
            placeholder="Search TV"
            aria-label="Search TV recommendations"
          />
          <button
            type="button"
            className="inline-search-button"
            onClick={() => void discoverTitles()}
            disabled={isDiscovering}
            aria-label="Search TV across web providers"
          >
            Search
          </button>
        </div>
        <nav aria-label="TV navigation">
          <div
            className="app-sidebar-title"
            style={{ color: "#77777d", marginTop: 3 }}
          >
            Watch Now
          </div>
          <button
            type="button"
            className={view === "discover" ? "is-selected" : ""}
            onClick={() => selectView("discover")}
          >
            <Sparkles size={17} />
            Top Picks
          </button>
          <button
            type="button"
            className={view === "rewatch" ? "is-selected" : ""}
            onClick={() => selectView("rewatch")}
          >
            <History size={17} />
            Rewatch
          </button>
          <div
            className="app-sidebar-title"
            style={{ color: "#77777d", marginTop: 13 }}
          >
            Library
          </div>
          <button
            type="button"
            className={view === "upNext" ? "is-selected" : ""}
            onClick={() => selectView("upNext")}
          >
            <ListPlus size={17} />
            Up Next
            <em style={{ marginLeft: "auto", fontStyle: "normal" }}>
              {watchlist.length}
            </em>
          </button>
        </nav>
        {availablePlatforms.length > 0 && (
          <label className="tv-platform-filter">
            <span>
              <MonitorPlay size={13} />
              Watch on
            </span>
            <select
              value={platformFilter}
              onChange={(event) => {
                setPlatformFilter(event.target.value);
                setActiveId(null);
              }}
              aria-label="Filter recommendations by platform"
            >
              <option value="all">All platforms</option>
              {availablePlatforms.map((platform) => (
                <option value={platform} key={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="import-card tv-discovery-card">
          <strong>Fresh recommendations</strong>
          <p>
            Search Apple and TVmaze using {tasteDossier.evidenceCount} nuanced
            passages from {tasteDossier.evidenceNoteCount} of{" "}
            {tasteDossier.currentNoteCount} current Notes.
            A TMDB token adds region-aware movie and series services.
          </p>
          {discoveryStatus && <p role="status">{discoveryStatus}</p>}
          <button
            type="button"
            onClick={() => void discoverTitles()}
            disabled={isDiscovering}
            aria-label="Find new movies and shows across streaming platforms"
          >
            <RefreshCw
              size={13}
              className={isDiscovering ? "is-spinning" : ""}
            />
            {isDiscovering ? "Searching…" : "Find Across Platforms"}
          </button>
        </div>
        <div className="import-card">
          <strong>Viewing history</strong>
          <p>
            {history
              ? `${history.fileName} · ${history.entries.length} local ${
                  history.entries.length === 1 ? "entry" : "entries"
                }.`
              : "Netflix and Prime history imports are opt-in and stay local."}
          </p>
          {importStatus && <p role="status">{importStatus}</p>}
          <input
            ref={importRef}
            type="file"
            accept=".csv,.json"
            hidden
            aria-label="Choose a viewing history export"
            onChange={(event) =>
              void importHistory(event.target.files?.[0])
            }
          />
          <button type="button" onClick={() => importRef.current?.click()}>
            {history ? "Replace history" : "Choose export file"}
          </button>
          {history && (
            <button
              type="button"
              onClick={() => {
                onChangeHistory(null);
                setImportStatus("Viewing history removed from this dashboard.");
              }}
            >
              Forget history
            </button>
          )}
        </div>
        <div className="tv-data-credits" aria-label="TV data credits">
          <strong>Data credits</strong>
          <p>
            Cross-platform series data from{" "}
            <a href="https://www.tvmaze.com" target="_blank" rel="noreferrer">
              TVmaze
            </a>{" "}
            under CC BY-SA.
          </p>
          {hasTmdbData && (
            <>
              <a
                className="tmdb-credit"
                href="https://www.themoviedb.org"
                target="_blank"
                rel="noreferrer"
                aria-label="The Movie Database"
              >
                <img
                  src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
                  alt="TMDB"
                />
              </a>
              <p>
                This product uses the TMDB API but is not endorsed or
                certified by TMDB. Availability by JustWatch.
              </p>
            </>
          )}
        </div>
      </aside>

      <main className="tv-main">
        {!hero ? (
          <div
            style={{
              minHeight: "100%",
              display: "grid",
              placeItems: "center",
              padding: 30,
              color: "#8f8f95",
              textAlign: "center",
            }}
          >
            <div>
              <ListPlus size={27} style={{ margin: "0 auto 10px" }} />
              <strong style={{ display: "block", color: "#f5f5f7" }}>
                {query ? "No titles found" : "Your Up Next is empty"}
              </strong>
              <p style={{ maxWidth: 280, fontSize: 10, lineHeight: 1.5 }}>
                {query
                  ? "Try another title, genre, mood, or runtime."
                  : "Add a discovery or rewatch recommendation and it will appear here."}
              </p>
            </div>
          </div>
        ) : (
          <>
            <section
              className="tv-hero"
              style={{
                backgroundImage: `linear-gradient(90deg, rgba(8,8,12,.96) 0%, rgba(8,8,12,.72) 44%, rgba(8,8,12,.12) 100%), url(${hero.artwork})`,
              }}
            >
              <div className="tv-hero-copy">
                <span className="match-pill match-pill--dark">
                  {hero.score}% match
                </span>
                <span className="eyebrow">
                  {view === "discover"
                    ? "Tonight’s best fit"
                    : view === "rewatch"
                      ? "Time for a return"
                      : "Saved for later"}
                </span>
                <h1>{hero.title}</h1>
                <div className="tv-meta">
                  <span>{hero.year}</span>
                  <span>{hero.runtime}</span>
                  {hero.mediaType && (
                    <span className="tv-media-kind">
                      {hero.mediaType === "series" ? "Series" : "Movie"}
                    </span>
                  )}
                  {hero.rating && (
                    <span>
                      <Star size={13} fill="currentColor" /> {hero.rating}
                    </span>
                  )}
                </div>
                {(hero.providers?.length ?? 0) > 0 && (
                  <div
                    className="tv-provider-row"
                    aria-label={`Available from ${hero.platforms?.join(", ")}`}
                  >
                    {hero.providers?.slice(0, 6).map((provider) => (
                      <span key={`${provider.name}-${provider.type}`}>
                        {provider.name}
                        <em>{provider.type}</em>
                      </span>
                    ))}
                  </div>
                )}
                <div className="tv-source-links">
                  {(hero.sourceLinks?.length
                    ? hero.sourceLinks
                    : hero.sourceUrl
                      ? [
                          {
                            label: hero.sourceLabel ?? "Open source",
                            url: hero.sourceUrl,
                          },
                        ]
                      : []
                  ).map((link) => (
                    <a
                      className="tv-source-link"
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      key={`${link.label}-${link.url}`}
                    >
                      {link.label}
                      <ExternalLink size={12} />
                    </a>
                  ))}
                </div>
                {hero.providerAttribution && (
                  <span className="tv-provider-attribution">
                    {hero.providerAttribution}
                  </span>
                )}
                <p>{hero.description}</p>
                <div className="why-row why-row--dark">
                  <Sparkles size={15} />
                  <div>
                    <p>
                      {hero.aiReason ||
                        hero.tasteMatch.summary ||
                        recommendationReason(
                          [
                            hero.title,
                            ...hero.genres,
                            ...hero.moods,
                            ...(hero.platforms ?? []),
                          ],
                          profile,
                          "A strong tonal bridge from your saved viewing preferences.",
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
                    {showDetails && (
                      <p style={{ marginTop: 4 }}>
                        {view === "rewatch" && hero.lastWatched
                          ? `Your ${hero.rating ?? "positive"} rating, ${hero.runtime} runtime, and time since ${hero.lastWatched.slice(0, 4)} raise its rewatch score.`
                          : `The score balances ${hero.moods.slice(0, 2).join(", ")}, ${hero.runtime}, quality, and novelty.`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="tv-actions">
                  <button
                    type="button"
                    className="tv-primary"
                    onClick={() => toggleWatchlist(hero.id)}
                  >
                    {watchlist.includes(hero.id) ? (
                      <Check size={15} />
                    ) : (
                      <Play size={15} fill="currentColor" />
                    )}
                    {watchlist.includes(hero.id)
                      ? "In Up Next"
                      : "Add to Up Next"}
                  </button>
                  <button
                    type="button"
                    className="tv-secondary"
                    aria-expanded={showDetails}
                    onClick={() => setShowDetails((open) => !open)}
                  >
                    {showDetails ? "Hide details" : "Why this?"}
                  </button>
                </div>
              </div>
            </section>

            <section className="tv-shelf">
              <div className="section-title-row section-title-row--dark">
                <div>
                  <span className="eyebrow">Your graph, in motion</span>
                  <h2>{shelfTitle}</h2>
                </div>
              </div>
              <div className="watch-grid">
                {items.map((item) => (
                  <button
                    type="button"
                    className="watch-card"
                    key={item.id}
                    aria-pressed={item.id === hero.id}
                    onClick={() => {
                      setActiveId(item.id);
                      onSelectItem?.(item.id);
                      onFeedback?.({
                        appId: "tv",
                        targetId: item.id,
                        targetTitle: item.title,
                        tags: [
                          ...item.genres,
                          ...item.moods,
                          ...(item.platforms ?? []),
                        ],
                        kind: "opened",
                      });
                      setShowDetails(false);
                    }}
                    style={{
                      padding: 0,
                      border: 0,
                      background: "transparent",
                      color: "inherit",
                      textAlign: "left",
                    }}
                  >
                    <img src={item.artwork} alt="" />
                    <span className="watch-score">{item.score}%</span>
                    {item.platforms?.[0] && (
                      <span className="watch-platform">
                        {item.platforms[0]}
                      </span>
                    )}
                    <h3>{item.title}</h3>
                    <p>
                      <Clock3 size={13} /> {item.runtime}
                      {watchlist.includes(item.id) && (
                        <span style={{ marginLeft: "auto", color: "#a9bcff" }}>
                          <Check size={11} /> Up Next
                        </span>
                      )}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
