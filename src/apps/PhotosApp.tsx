import {
  Check,
  Download,
  ExternalLink,
  FileUp,
  Grid3X3,
  Heart,
  Info,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePersistentState } from "../hooks/usePersistentState";
import {
  analyzeLocalPhotos,
  type LocalPhotoSignals,
} from "../lib/localPhotoSignals";
import { buildPhotoDiscoveryQueries } from "../lib/photoTaste";
import { scorePhoto } from "../lib/profile";
import {
  buildTasteDiscoverySeeds,
  matchTasteDossier,
  type TasteDossier,
} from "../lib/tasteDossier";
import type {
  AppCommand,
  FeedbackHandler,
  PhotoItem,
  Profile,
} from "../types";

type Props = {
  profile: Profile;
  currentNoteProfile?: Profile;
  photos: PhotoItem[];
  onFeedback?: FeedbackHandler;
  command?: AppCommand;
  onSelectItem?: (itemId: string) => void;
  onDiscover: (queries: string[]) => Promise<{
    added: number;
    found: number;
  }>;
  localSignals: LocalPhotoSignals | null;
  onChangeLocalSignals: (signals: LocalPhotoSignals | null) => void;
  tasteDossier: TasteDossier;
};

type View = "recommended" | "all" | "liked" | "disliked";
type Sort = "match" | "title";

const today = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(new Date());
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function PhotosApp({
  profile,
  currentNoteProfile = profile,
  photos,
  onFeedback,
  command,
  onSelectItem,
  onDiscover,
  localSignals,
  onChangeLocalSignals,
  tasteDossier,
}: Props) {
  const [selected, setSelected] = useState<PhotoItem | null>(() =>
    command?.itemId
      ? (photos.find((photo) => photo.id === command.itemId) ?? null)
      : null,
  );
  const [liked, setLiked] = usePersistentState<string[]>(
    "macdashboard.photos.liked.v1",
    [],
  );
  const [downloaded, setDownloaded] = usePersistentState<string[]>(
    "macdashboard.photos.downloaded.v1",
    [],
  );
  const [disliked, setDisliked] = usePersistentState<string[]>(
    "macdashboard.photos.disliked.v1",
    [],
  );
  const [view, setView] = useState<View>(() =>
    command?.view &&
    ["recommended", "all", "liked", "disliked"].includes(command.view)
      ? (command.view as View)
      : "recommended",
  );
  const [sort, setSort] = useState<Sort>("match");
  const [query, setQuery] = useState(command?.query ?? "");
  const [status, setStatus] = useState("");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusable = () => [
      ...(detailRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), a[href]',
      ) ?? []),
    ];
    window.requestAnimationFrame(() => focusable()[0]?.focus());
    const handleDialogKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelected(null);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleDialogKeyboard);
    return () => {
      window.removeEventListener("keydown", handleDialogKeyboard);
      previousFocus?.focus();
    };
  }, [selected]);

  const scored = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return photos.map((photo) => {
      return {
        ...photo,
        matchScore: scorePhoto(
          photo,
          profile,
          currentNoteProfile,
          tasteDossier,
        ),
      };
    })
      .filter(
        (photo) =>
          view !== "recommended" || !disliked.includes(photo.id),
      )
      .filter((photo) => view !== "liked" || liked.includes(photo.id))
      .filter(
        (photo) => view !== "disliked" || disliked.includes(photo.id),
      )
      .filter((photo) =>
        normalizedQuery
          ? [photo.title, photo.creator, photo.reason, ...photo.tags]
              .join(" ")
              .toLowerCase()
              .includes(normalizedQuery)
          : true,
      )
      .sort((a, b) =>
        sort === "title"
          ? a.title.localeCompare(b.title)
          : b.matchScore - a.matchScore,
      );
  }, [
    currentNoteProfile,
    disliked,
    liked,
    photos,
    profile,
    query,
    sort,
    tasteDossier,
    view,
  ]);
  const selectedTasteMatch = useMemo(
    () =>
      selected
        ? matchTasteDossier(
            [
              selected.title,
              selected.creator,
              selected.reason,
              ...selected.tags,
            ],
            tasteDossier,
            "photos",
          )
        : null,
    [selected, tasteDossier],
  );

  const toggleLiked = (id: string) => {
    setLiked((items) => {
      const photo = photos.find((item) => item.id === id);
      if (items.includes(id)) {
        if (photo) {
          onFeedback?.(
            {
              appId: "photos",
              targetId: photo.id,
              targetTitle: photo.title,
              tags: photo.tags,
              kind: "liked",
            },
            false,
          );
        }
        return items.filter((likedId) => likedId !== id);
      }
      if (photo) {
        if (disliked.includes(id)) {
          setDisliked((current) =>
            current.filter((dislikedId) => dislikedId !== id),
          );
          onFeedback?.(
            {
              appId: "photos",
              targetId: photo.id,
              targetTitle: photo.title,
              tags: photo.tags,
              kind: "dismissed",
            },
            false,
          );
        }
        onFeedback?.({
          appId: "photos",
          targetId: photo.id,
          targetTitle: photo.title,
          tags: photo.tags,
          kind: "liked",
        });
      }
      return [...items, id];
    });
  };

  const toggleDisliked = (id: string) => {
    const photo = photos.find((item) => item.id === id);
    if (!photo) return;
    const feedback = {
      appId: "photos" as const,
      targetId: photo.id,
      targetTitle: photo.title,
      tags: photo.tags,
      kind: "dismissed" as const,
    };
    if (disliked.includes(id)) {
      setDisliked((items) =>
        items.filter((dislikedId) => dislikedId !== id),
      );
      onFeedback?.(feedback, false);
      setStatus(`Restored “${photo.title}” to For You.`);
      return;
    }
    if (liked.includes(id)) {
      setLiked((items) => items.filter((likedId) => likedId !== id));
      onFeedback?.(
        {
          appId: "photos",
          targetId: photo.id,
          targetTitle: photo.title,
          tags: photo.tags,
          kind: "liked",
        },
        false,
      );
    }
    setDisliked((items) => [...new Set([...items, id])]);
    onFeedback?.(feedback);
    setStatus(
      `Showing fewer images like “${photo.title}”. Shared visual tags now rank lower.`,
    );
  };

  const discover = async () => {
    const discoveryQueries = buildPhotoDiscoveryQueries({
      query,
      profile,
      noteProfile: currentNoteProfile,
      localSignals,
      dossierSeeds: buildTasteDiscoverySeeds(tasteDossier, "photos"),
    });
    setIsDiscovering(true);
    setStatus(
      `Searching open image collections across ${discoveryQueries.length} ${
        discoveryQueries.length === 1 ? "aesthetic direction" : "aesthetic directions"
      }…`,
    );
    try {
      const result = await onDiscover(discoveryQueries);
      setView("recommended");
      setStatus(
        result.added
          ? `Added ${result.added} attributed ${
              result.added === 1 ? "image" : "images"
            } matched to ${discoveryQueries
              .slice(0, 2)
              .map((item) => `“${item}”`)
              .join(" and ")}.`
          : result.found
            ? "The strongest matches are already in your discoveries."
            : "No open-license images matched those directions. Try a subject, style, or mood.",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Fresh photo discovery is unavailable.",
      );
    } finally {
      setIsDiscovering(false);
    }
  };

  const importLocalSignals = async (files?: FileList | null) => {
    if (!files?.length) return;
    setIsAnalyzing(true);
    setStatus(
      `Analyzing ${Math.min(files.length, 120)} selected photos on this device…`,
    );
    try {
      const signals = await analyzeLocalPhotos(Array.from(files));
      onChangeLocalSignals(signals);
      const signalCount = signals.tags.length + signals.palette.length;
      setStatus(
        `Learned ${signalCount} aggregate visual ${
          signalCount === 1 ? "signal" : "signals"
        } from ${signals.fileCount} local ${
          signals.fileCount === 1 ? "photo" : "photos"
        }. No image or filename was stored or uploaded.`,
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Local photo analysis failed.",
      );
    } finally {
      setIsAnalyzing(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  const download = async (photo: PhotoItem) => {
    setStatus(`Preparing “${photo.title}”…`);
    try {
      const response = await fetch(photo.url);
      if (!response.ok) throw new Error("Photo download failed");
      const blob = await response.blob();
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      const extension = IMAGE_EXTENSIONS[blob.type] ?? "jpg";
      anchor.download = `${photo.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.${extension}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(anchor.href), 0);
      setDownloaded((items) =>
        items.includes(photo.id) ? items : [...items, photo.id],
      );
      onFeedback?.({
        appId: "photos",
        targetId: photo.id,
        targetTitle: photo.title,
        tags: photo.tags,
        kind: "downloaded",
      });
      setStatus(`Downloaded “${photo.title}”.`);
    } catch {
      window.open(photo.sourceUrl, "_blank", "noopener,noreferrer");
      setStatus(
        "The attributed source page opened so you can review and save the original.",
      );
    }
  };

  const heading =
    view === "recommended"
      ? "A visual album, found for you"
      : view === "liked"
        ? "Favorites"
        : view === "disliked"
          ? "Less Like This"
          : "All Discoveries";

  return (
    <div className="photos-app">
      <aside className="photos-sidebar">
        <h2>Photos</h2>
        <label className="search-field">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Photos"
            aria-label="Search photo recommendations"
          />
        </label>
        <nav aria-label="Photos navigation">
          <div className="app-sidebar-title">Photos</div>
          <button
            className={view === "recommended" ? "is-selected" : ""}
            type="button"
            onClick={() => setView("recommended")}
          >
            <Sparkles size={17} />
            For You
          </button>
          <button
            className={view === "all" ? "is-selected" : ""}
            type="button"
            onClick={() => setView("all")}
          >
            <Grid3X3 size={17} />
            All Discoveries
          </button>
          <div className="app-sidebar-title" style={{ marginTop: 13 }}>
            Albums
          </div>
          <button
            className={view === "liked" ? "is-selected" : ""}
            type="button"
            onClick={() => setView("liked")}
          >
            <Heart size={17} />
            Favorites
            <em>{liked.length}</em>
          </button>
          <button
            className={view === "disliked" ? "is-selected" : ""}
            type="button"
            onClick={() => setView("disliked")}
          >
            <ThumbsDown size={17} />
            Disliked
            <em>{disliked.length}</em>
          </button>
        </nav>
        <div className="source-note">
          <Info size={16} />
          <p>
            Web-sourced images from Openverse, Wikimedia Commons, the Art
            Institute of Chicago, and The Met—never AI-generated. Every
            discovery keeps its creator, license, and original source attached.
          </p>
        </div>
        <div className="photo-signal-card">
          <strong>Whole-Notes taste dossier</strong>
          <p>
            {tasteDossier.evidenceCount} nuanced passages from{" "}
            {tasteDossier.evidenceNoteCount} of {tasteDossier.currentNoteCount}{" "}
            current Notes. Rebuilt whenever Notes change.
          </p>
          {tasteDossier.evidenceNoteCount > 0 && (
            <p>
              Current evidence sources:{" "}
              {[
                ...new Set(
                  tasteDossier.evidence.map((item) => item.noteTitle),
                ),
              ]
                .slice(0, 4)
                .join(", ")}
              .
            </p>
          )}
        </div>
        <div className="photo-signal-card">
          <strong>Local photo signals</strong>
          <p>
            {localSignals
              ? `${localSignals.fileCount} photos · ${[
                  ...localSignals.tags,
                  ...localSignals.palette,
                ]
                  .slice(0, 3)
                  .map((signal) => signal.label)
                  .join(", ")}`
              : "Select photos from Photos or Downloads. Analysis stays on-device."}
          </p>
          <input
            ref={importRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
            multiple
            hidden
            aria-label="Choose local photos to analyze privately"
            onChange={(event) =>
              void importLocalSignals(event.target.files)
            }
          />
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            disabled={isAnalyzing}
          >
            <FileUp size={13} />
            {isAnalyzing
              ? "Analyzing…"
              : localSignals
                ? "Replace Signals"
                : "Choose Photos"}
          </button>
          {localSignals && (
            <button
              type="button"
              onClick={() => {
                onChangeLocalSignals(null);
                setStatus("Local photo signals were forgotten.");
              }}
            >
              Forget Signals
            </button>
          )}
        </div>
      </aside>

      <main className="photos-main">
        <header className="photos-heading">
          <div>
            <span className="eyebrow">{today}</span>
            <h1>{heading}</h1>
            <p>
              {view === "recommended"
                ? `Ranked from ${tasteDossier.evidenceCount} nuanced passages across ${tasteDossier.evidenceNoteCount} of ${tasteDossier.currentNoteCount} current Notes. Open an image to inspect its evidence.`
                : view === "liked"
                  ? "The discoveries you marked as favorites."
                  : view === "disliked"
                    ? "Hidden from For You; restore any image to undo its influence."
                    : "Traceable photographs collected from the web for you."}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <button
              type="button"
              className="photo-count"
              onClick={() => void discover()}
              disabled={isDiscovering}
              aria-label="Find new attributed images for your aesthetic"
              style={{ border: 0 }}
            >
              <RefreshCw
                size={11}
                className={isDiscovering ? "is-spinning" : ""}
                style={{ marginRight: 4 }}
              />
              {isDiscovering ? "Searching…" : "Find New Photos"}
            </button>
            <button
              type="button"
              className="photo-count"
              onClick={() =>
                setSort((current) => (current === "match" ? "title" : "match"))
              }
              aria-label={`Sort photos by ${sort === "match" ? "title" : "best match"}`}
              title={`Sorted by ${sort === "match" ? "Best Match" : "Title"}`}
              style={{ border: 0 }}
            >
              <SlidersHorizontal size={11} style={{ marginRight: 4 }} />
              {sort === "match" ? "Best Match" : "Title"}
            </button>
            <div className="photo-count">
              {scored.length} {scored.length === 1 ? "photo" : "photos"}
            </div>
          </div>
        </header>

        {status && (
          <div
            className="source-note"
            role="status"
            style={{ margin: "0 0 12px", alignItems: "center" }}
          >
            <Check size={14} />
            <p>{status}</p>
            <button
              type="button"
              onClick={() => setStatus("")}
              aria-label="Dismiss download status"
              style={{
                marginLeft: "auto",
                padding: 2,
                border: 0,
                background: "transparent",
                color: "inherit",
              }}
            >
              <X size={13} />
            </button>
          </div>
        )}

        {scored.length === 0 ? (
          <div
            className="source-note"
            style={{
              minHeight: 120,
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            <div>
              <Heart size={20} style={{ margin: "0 auto 8px" }} />
              <strong>
                {query
                  ? "No matching photos"
                  : view === "disliked"
                    ? "No Dislikes Yet"
                    : "No Favorites Yet"}
              </strong>
              <p style={{ marginTop: 5 }}>
                {query
                  ? "Try a subject, creator, mood, or visual style."
                  : view === "disliked"
                    ? "Use Dislike on an image to make related visual tags rank lower."
                    : "Open a discovery and tap Like to keep it here."}
              </p>
            </div>
          </div>
        ) : (
          <div className="photo-mosaic">
            {scored.map((photo, index) => (
              <button
                type="button"
                className={`photo-tile photo-tile--${(index % 5) + 1}`}
                key={photo.id}
                onClick={() => {
                  setSelected(photo);
                  onSelectItem?.(photo.id);
                  onFeedback?.({
                    appId: "photos",
                    targetId: photo.id,
                    targetTitle: photo.title,
                    tags: photo.tags,
                    kind: "opened",
                  });
                }}
                aria-label={`Open ${photo.title} by ${photo.creator}`}
              >
                <img src={photo.url} alt={photo.title} />
                <span className="photo-overlay">
                  <strong>{photo.title}</strong>
                  <small>
                    {photo.creator} · {photo.matchScore}% match
                  </small>
                </span>
                {liked.includes(photo.id) && (
                  <span className="liked-marker">
                    <Heart size={14} fill="currentColor" />
                  </span>
                )}
                {disliked.includes(photo.id) && (
                  <span className="disliked-marker">
                    <ThumbsDown size={14} fill="currentColor" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </main>

      {selected && (
        <div
          ref={detailRef}
          className="photo-detail"
          role="dialog"
          aria-modal="true"
          aria-label={selected.title}
        >
          <button
            type="button"
            className="detail-backdrop"
            onClick={() => setSelected(null)}
            aria-label="Close photo"
            tabIndex={-1}
          />
          <div className="photo-detail-card">
            <button
              type="button"
              className="photo-detail-close"
              onClick={() => setSelected(null)}
              aria-label="Close photo detail"
            >
              <X size={14} />
            </button>
            <img src={selected.url} alt={selected.title} />
            <div className="photo-detail-copy">
              <div>
                <span className="eyebrow">Recommended from the web</span>
                <h2>{selected.title}</h2>
                <a
                  href={selected.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {selected.creator} <ExternalLink size={13} />
                </a>
                {selected.license && (
                  <p className="photo-license">
                    {selected.licenseUrl ? (
                      <a
                        href={selected.licenseUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {selected.license}
                      </a>
                    ) : (
                      selected.license
                    )}
                  </p>
                )}
              </div>
              <div className="why-row" style={{ margin: 0 }}>
                <Sparkles size={15} />
                <div>
                  <p>{selected.reason}</p>
                  {selectedTasteMatch?.summary && (
                    <p style={{ marginTop: 4 }}>
                      {selectedTasteMatch.summary}
                    </p>
                  )}
                  {selectedTasteMatch?.positive[0] && (
                    <p className="taste-evidence-quote">
                      “{selectedTasteMatch.positive[0].passage}” —{" "}
                      {selectedTasteMatch.positive[0].noteTitle}
                    </p>
                  )}
                  <p style={{ marginTop: 4 }}>
                    Source, artist attribution, and the original link stay
                    attached to this recommendation.
                  </p>
                </div>
              </div>
              <div className="tag-row">
                {selected.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="photo-actions">
                <button
                  type="button"
                  aria-pressed={liked.includes(selected.id)}
                  onClick={() => toggleLiked(selected.id)}
                >
                  <Heart
                    size={17}
                    fill={liked.includes(selected.id) ? "currentColor" : "none"}
                  />
                  {liked.includes(selected.id) ? "Liked" : "Like"}
                </button>
                <button
                  type="button"
                  className="photo-dislike-button"
                  aria-pressed={disliked.includes(selected.id)}
                  onClick={() => toggleDisliked(selected.id)}
                >
                  <ThumbsDown
                    size={17}
                    fill={
                      disliked.includes(selected.id)
                        ? "currentColor"
                        : "none"
                    }
                  />
                  {disliked.includes(selected.id)
                    ? "Disliked"
                    : "Dislike"}
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => download(selected)}
                >
                  {downloaded.includes(selected.id) ? (
                    <Check size={16} />
                  ) : (
                    <Download size={16} />
                  )}
                  {downloaded.includes(selected.id) ? "Downloaded" : "Download"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
