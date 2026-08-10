import {
  ArrowDownAZ,
  Bold,
  CheckSquare,
  Clock3,
  Download,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  MessageCircleQuestion,
  PencilLine,
  Pin,
  Plus,
  Search,
  Trash2,
  Underline,
} from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NoteSketch } from "../components/NoteSketch";
import {
  NOTE_SKETCH_HEIGHT,
  NOTE_SKETCH_WIDTH,
  noteSketchPath,
  normalizeNoteSketch,
} from "../lib/noteSketch";
import {
  plainTextToNoteHtml,
  sanitizeNoteHtml,
} from "../lib/noteSanitizer";
import type { AppCommand, Note } from "../types";

type Props = {
  notes: Note[];
  selectedNoteId: string;
  onSelectNote: (id: string) => void;
  onChangeNotes: (notes: Note[]) => void;
  onAskForHelp: (note: Note) => void;
  command?: AppCommand;
  recommendationSignalCounts?: Record<string, number>;
};

type Folder = "All Notes" | Note["folder"];
type Sort = "recent" | "title";

const FOLDERS: Folder[] = ["All Notes", "Personal", "Ideas", "Reviews"];

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

const plainText = (html: string) =>
  html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

export function NotesApp({
  notes,
  selectedNoteId,
  onSelectNote,
  onChangeNotes,
  onAskForHelp,
  command: appCommand,
  recommendationSignalCounts = {},
}: Props) {
  const [query, setQuery] = useState(appCommand?.query ?? "");
  const [folder, setFolder] = useState<Folder>("All Notes");
  const [sort, setSort] = useState<Sort>("recent");
  const [saveState, setSaveState] = useState<"Saved" | "Saving…">("Saved");
  const [exportState, setExportState] = useState<
    "" | "Preparing PDF…" | "PDF downloaded" | "PDF export failed"
  >("");
  const [sketchVisibility, setSketchVisibility] = useState<
    Record<string, boolean>
  >({});
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(
    null,
  );
  const editorRef = useRef<HTMLDivElement>(null);
  const editorNoteIdRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = notes.find((note) => note.id === selectedNoteId) ?? notes[0];
  const sketchOpen = selected
    ? (sketchVisibility[selected.id] ??
      Boolean(normalizeNoteSketch(selected.sketch)))
    : false;

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  useEffect(() => {
    const sanitized = notes.map((note) => ({
      ...note,
      content: sanitizeNoteHtml(note.content),
      ...(note.sketch
        ? { sketch: normalizeNoteSketch(note.sketch) }
        : {}),
    }));
    if (
      sanitized.some(
        (note, index) =>
          note.content !== notes[index]?.content ||
          JSON.stringify(note.sketch) !== JSON.stringify(notes[index]?.sketch),
      )
    ) {
      onChangeNotes(sanitized);
    }
  }, [notes, onChangeNotes]);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor || !selected) return;

    const nextContent = sanitizeNoteHtml(selected.content);
    const noteChanged = editorNoteIdRef.current !== selected.id;

    // contentEditable owns its live DOM while focused. Replacing innerHTML on
    // every React state update collapses the browser selection to the start.
    if (
      (noteChanged || document.activeElement !== editor) &&
      editor.innerHTML !== nextContent
    ) {
      editor.innerHTML = nextContent;
    }
    editorNoteIdRef.current = selected.id;
  }, [selected]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return notes
      .filter((note) => folder === "All Notes" || note.folder === folder)
      .filter((note) =>
        normalizedQuery
          ? `${note.title} ${plainText(note.content)}`
              .toLowerCase()
              .includes(normalizedQuery)
          : true,
      )
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return sort === "title"
          ? a.title.localeCompare(b.title)
          : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [folder, notes, query, sort]);

  const updateSelected = (updates: Partial<Note>) => {
    if (!selected) return;
    onChangeNotes(
      notes.map((note) =>
        note.id === selected.id
          ? { ...note, ...updates, updatedAt: new Date().toISOString() }
          : note,
      ),
    );
    setSaveState("Saving…");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaveState("Saved"), 550);
  };

  const createNote = () => {
    const noteFolder: Note["folder"] =
      folder === "All Notes" ? "Ideas" : folder;
    const note: Note = {
      id: crypto.randomUUID(),
      title: "New Note",
      folder: noteFolder,
      content: "<h1>New Note</h1><p><br></p>",
      updatedAt: new Date().toISOString(),
    };
    onChangeNotes([note, ...notes]);
    onSelectNote(note.id);
    setQuery("");
  };

  const deleteSelectedNote = () => {
    if (!selected || selected.id === "preferences") return;
    const currentIndex = notes.findIndex((note) => note.id === selected.id);
    const remaining = notes.filter((note) => note.id !== selected.id);
    const nextNote =
      remaining[currentIndex] ??
      remaining[currentIndex - 1] ??
      remaining[0];

    onChangeNotes(remaining);
    if (nextNote) onSelectNote(nextNote.id);
    setConfirmDeleteNoteId(null);
  };

  const command = (name: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, value);
    if (editorRef.current && selected) {
      updateSelected({ content: editorRef.current.innerHTML });
    }
  };

  const exportPdf = async () => {
    if (!selected) return;
    setExportState("Preparing PDF…");
    const source = document.createElement("article");
    source.setAttribute("aria-hidden", "true");
    source.innerHTML = sanitizeNoteHtml(
      editorRef.current?.innerHTML ?? selected.content,
    );
    const sketch = normalizeNoteSketch(selected.sketch);
    if (sketch) {
      const heading = document.createElement("h2");
      heading.textContent = "Sketch";
      heading.style.marginTop = "28px";
      heading.style.pageBreakAfter = "avoid";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", `0 0 ${NOTE_SKETCH_WIDTH} ${NOTE_SKETCH_HEIGHT}`);
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "262");
      svg.setAttribute("aria-label", "Sketch attached to this note");
      svg.style.display = "block";
      svg.style.border = "1px solid #dddddf";
      svg.style.borderRadius = "10px";
      svg.style.background = "#ffffff";
      for (const stroke of sketch.strokes) {
        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        path.setAttribute("d", noteSketchPath(stroke.points));
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", stroke.color);
        path.setAttribute("stroke-width", String(stroke.width));
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        svg.append(path);
      }
      source.append(heading, svg);
    }
    Object.assign(source.style, {
      position: "fixed",
      left: "-100000px",
      top: "0",
      width: "672px",
      boxSizing: "border-box",
      padding: "72px",
      background: "#ffffff",
      color: "#242428",
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
      fontSize: "14px",
      lineHeight: "1.55",
    });
    document.body.append(source);

    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      await doc.html(source, {
        autoPaging: "text",
        margin: [54, 54, 54, 54],
        width: 504,
        windowWidth: 672,
        html2canvas: {
          backgroundColor: "#ffffff",
          logging: false,
          scale: 0.75,
          useCORS: true,
        },
      });
      doc.save(
        `${selected.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`,
      );
      setExportState("PDF downloaded");
    } catch (error) {
      console.warn("Could not export note as PDF.", error);
      setExportState("PDF export failed");
    } finally {
      source.remove();
    }
  };

  return (
    <div className="notes-app">
      <aside className="notes-folders">
        <div className="app-sidebar-title">iCloud</div>
        {FOLDERS.map((item) => {
          const count =
            item === "All Notes"
              ? notes.length
              : notes.filter((note) => note.folder === item).length;
          return (
            <button
              className={`folder-row ${folder === item ? "is-selected" : ""}`}
              type="button"
              key={item}
              onClick={() => {
                setFolder(item);
                setQuery("");
              }}
            >
              <span>▱</span>
              {item}
              <em>{count}</em>
            </button>
          );
        })}
        <div className="privacy-card">
          <span className="privacy-dot" />
          <div>
            <strong>Local & private</strong>
            <p>
              Relevant taste lists shape recommendations locally. Imports
              always require your action.
            </p>
          </div>
        </div>
      </aside>

      <section className="notes-list">
        <div className="notes-list-toolbar">
          <label className="search-field">
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              aria-label="Search notes"
            />
          </label>
          <button
            type="button"
            className="round-button"
            onClick={() =>
              setSort((current) => (current === "recent" ? "title" : "recent"))
            }
            aria-label={`Sort by ${sort === "recent" ? "title" : "most recent"}`}
            title={`Sorted by ${sort === "recent" ? "most recent" : "title"}`}
          >
            {sort === "recent" ? <Clock3 size={16} /> : <ArrowDownAZ size={16} />}
          </button>
          <button
            type="button"
            className="round-button"
            onClick={createNote}
            aria-label="Create a new note"
            title="New Note"
          >
            <Plus size={17} />
          </button>
        </div>
        <div className="note-count">
          {filtered.length} {filtered.length === 1 ? "note" : "notes"} ·{" "}
          {sort === "recent" ? "Most Recent" : "Title"}
        </div>
        <div className="note-rows">
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "28px 12px",
                color: "#909198",
                textAlign: "center",
                fontSize: 10,
                lineHeight: 1.5,
              }}
            >
              <strong style={{ display: "block", color: "#666970" }}>
                No Notes
              </strong>
              {query
                ? "No titles or note text match this search."
                : `Create a note in ${folder}.`}
            </div>
          ) : (
            filtered.map((note) => (
              <button
                type="button"
                key={note.id}
                className={`note-row ${
                  note.id === selected?.id ? "is-selected" : ""
                }`}
                onClick={() => onSelectNote(note.id)}
              >
                <span className="note-title">
                  {note.pinned && <span className="pin">●</span>}
                  {note.title}
                </span>
                <span className="note-preview">
                  {plainText(note.content) || "No additional text"}
                </span>
                <time>
                  {formatTime(note.updatedAt)} · {note.folder}
                </time>
              </button>
            ))
          )}
        </div>
      </section>

      <main className="note-editor-panel">
        {selected ? (
          <>
            <div className="editor-toolbar">
              <div
                className="format-group"
                onMouseDown={(event) => {
                  // Keep the editor selection alive while clicking a format
                  // control so commands apply to the selected text.
                  event.preventDefault();
                }}
              >
                <button
                  type="button"
                  aria-label="Heading 1"
                  title="Title"
                  onClick={() => command("formatBlock", "h1")}
                >
                  <Heading1 size={17} />
                </button>
                <button
                  type="button"
                  aria-label="Heading 2"
                  title="Heading"
                  onClick={() => command("formatBlock", "h2")}
                >
                  <Heading2 size={17} />
                </button>
                <button
                  type="button"
                  aria-label="Bold"
                  title="Bold"
                  onClick={() => command("bold")}
                >
                  <Bold size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Italic"
                  title="Italic"
                  onClick={() => command("italic")}
                >
                  <Italic size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Underline"
                  title="Underline"
                  onClick={() => command("underline")}
                >
                  <Underline size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Highlight"
                  title="Highlight"
                  onClick={() => command("hiliteColor", "#ffe477")}
                >
                  <Highlighter size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Bulleted list"
                  title="Bulleted List"
                  onClick={() => command("insertUnorderedList")}
                >
                  <List size={17} />
                </button>
                <button
                  type="button"
                  aria-label="Numbered list"
                  title="Numbered List"
                  onClick={() => command("insertOrderedList")}
                >
                  <ListOrdered size={17} />
                </button>
                <button
                  type="button"
                  aria-label="Checklist"
                  title="Checklist"
                  onClick={() =>
                    command("insertHTML", '<p>☐ <span>New item</span></p>')
                  }
                >
                  <CheckSquare size={16} />
                </button>
                <button
                  type="button"
                  className={sketchOpen ? "is-selected" : ""}
                  aria-label={sketchOpen ? "Hide sketch tools" : "Show sketch tools"}
                  aria-pressed={sketchOpen}
                  title="Sketch"
                  onClick={() => {
                    if (!selected) return;
                    setSketchVisibility((current) => ({
                      ...current,
                      [selected.id]: !sketchOpen,
                    }));
                  }}
                >
                  <PencilLine size={16} />
                </button>
              </div>
              <div className="editor-actions">
                <div className="note-delete-control">
                  <button
                    type="button"
                    className="editor-delete-button"
                    aria-label={
                      selected.id === "preferences"
                        ? "Preferences note cannot be deleted"
                        : `Delete ${selected.title}`
                    }
                    title={
                      selected.id === "preferences"
                        ? "Preferences is required for personalization"
                        : "Delete Note"
                    }
                    disabled={selected.id === "preferences"}
                    onClick={() => setConfirmDeleteNoteId(selected.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                  {confirmDeleteNoteId === selected.id && (
                    <div
                      className="note-delete-confirmation"
                      role="alertdialog"
                      aria-label={`Delete ${selected.title}?`}
                    >
                      <strong>Delete this note?</strong>
                      <span>“{selected.title}” will be removed permanently.</span>
                      <div className="note-delete-actions">
                        <button
                          type="button"
                          className="is-destructive"
                          onClick={deleteSelectedNote}
                        >
                          Delete Note
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteNoteId(null)}
                        >
                          Keep Note
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={selected.pinned ? "Unpin note" : "Pin note"}
                  aria-pressed={Boolean(selected.pinned)}
                  title={selected.pinned ? "Unpin Note" : "Pin Note"}
                  onClick={() => updateSelected({ pinned: !selected.pinned })}
                >
                  <Pin
                    size={16}
                    fill={selected.pinned ? "currentColor" : "none"}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => onAskForHelp(selected)}
                  aria-label="Ask for help with this note"
                  title="Ask the dashboard about this note"
                >
                  <MessageCircleQuestion size={17} />
                  <span>Ask</span>
                </button>
                <button
                  type="button"
                  onClick={exportPdf}
                  aria-label="Export as PDF"
                  title="Export as PDF"
                  disabled={exportState === "Preparing PDF…"}
                >
                  <Download size={17} />
                  <span>PDF</span>
                </button>
              </div>
            </div>
            <div className="note-editor-body">
              <div className="editor-date" aria-live="polite">
                {formatTime(selected.updatedAt)} · {saveState}
                {exportState && ` · ${exportState}`}
                {recommendationSignalCounts[selected.id]
                  ? ` · ${recommendationSignalCounts[selected.id]} recommendation ${
                      recommendationSignalCounts[selected.id] === 1
                        ? "signal"
                        : "signals"
                    }`
                  : ""}
              </div>
              <div
                key={selected.id}
                ref={editorRef}
                className="rich-editor"
                contentEditable
                suppressContentEditableWarning
                aria-label={`Edit ${selected.title}`}
                onPaste={(event) => {
                  event.preventDefault();
                  const rich = event.clipboardData.getData("text/html");
                  const plain = event.clipboardData.getData("text/plain");
                  command(
                    "insertHTML",
                    rich
                      ? sanitizeNoteHtml(rich)
                      : plainTextToNoteHtml(plain),
                  );
                }}
                onBlur={(event) => {
                  const sanitized = sanitizeNoteHtml(
                    event.currentTarget.innerHTML,
                  );
                  if (sanitized !== event.currentTarget.innerHTML) {
                    event.currentTarget.innerHTML = sanitized;
                    updateSelected({ content: sanitized });
                  }
                  setSaveState("Saved");
                }}
                onInput={(event) => {
                  const content = sanitizeNoteHtml(
                    event.currentTarget.innerHTML,
                  );
                  const heading =
                    event.currentTarget.querySelector("h1")?.textContent?.trim();
                  updateSelected({
                    content,
                    title: heading || selected.title,
                  });
                }}
              />
              {sketchOpen && (
                <NoteSketch
                  sketch={selected.sketch}
                  onChange={(sketch) => updateSelected({ sketch })}
                />
              )}
            </div>
          </>
        ) : (
          <div
            style={{
              display: "grid",
              height: "100%",
              placeItems: "center",
              color: "#909198",
              fontSize: 11,
            }}
          >
            Create a note to begin writing.
          </div>
        )}
      </main>
    </div>
  );
}
