import {
  Eraser,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  NOTE_SKETCH_COLORS,
  NOTE_SKETCH_HEIGHT,
  NOTE_SKETCH_MAX_POINTS,
  NOTE_SKETCH_MAX_STROKES,
  NOTE_SKETCH_WIDTH,
  noteSketchPath,
  normalizeNoteSketch,
} from "../lib/noteSketch";
import type {
  NoteSketch as NoteSketchValue,
  NoteSketchPoint,
  NoteSketchStroke,
} from "../types";

type Props = {
  sketch?: NoteSketchValue;
  onChange: (sketch: NoteSketchValue | undefined) => void;
};

type Tool = "pencil" | "eraser";

const pointFromPointer = (
  event: React.PointerEvent<SVGSVGElement>,
): NoteSketchPoint => {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) *
      NOTE_SKETCH_WIDTH,
    y: ((event.clientY - bounds.top) / Math.max(bounds.height, 1)) *
      NOTE_SKETCH_HEIGHT,
  };
};

const distance = (left: NoteSketchPoint, right: NoteSketchPoint) =>
  Math.hypot(left.x - right.x, left.y - right.y);

export function NoteSketch({ sketch, onChange }: Props) {
  const normalized = normalizeNoteSketch(sketch);
  const strokes = normalized?.strokes ?? [];
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState<string>(NOTE_SKETCH_COLORS[0]);
  const [width, setWidth] = useState(4);
  const [draft, setDraft] = useState<NoteSketchStroke | null>(null);
  const activePointer = useRef<number | null>(null);
  const draftRef = useRef<NoteSketchStroke | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const commit = () => {
    const current = draftRef.current;
    if (!current) return;
    const next = [...strokes, current].slice(-NOTE_SKETCH_MAX_STROKES);
    onChange({ version: 1, strokes: next });
    draftRef.current = null;
    setDraft(null);
  };

  const eraseTarget = (target: EventTarget | null) => {
    const element = target instanceof Element
      ? target.closest<SVGPathElement>("[data-stroke-id]")
      : null;
    const strokeId = element?.dataset.strokeId;
    if (!strokeId) return;
    const next = strokes.filter((stroke) => stroke.id !== strokeId);
    onChange(next.length > 0 ? { version: 1, strokes: next } : undefined);
  };

  return (
    <section className="note-sketch" aria-label="Note sketch">
      <div className="note-sketch-toolbar">
        <div className="note-sketch-tools" role="group" aria-label="Drawing tool">
          <button
            type="button"
            className={tool === "pencil" ? "is-selected" : ""}
            aria-pressed={tool === "pencil"}
            onClick={() => setTool("pencil")}
            title="Pencil"
          >
            <Pencil size={15} />
            <span>Pencil</span>
          </button>
          <button
            type="button"
            className={tool === "eraser" ? "is-selected" : ""}
            aria-pressed={tool === "eraser"}
            onClick={() => setTool("eraser")}
            title="Erase whole strokes"
          >
            <Eraser size={15} />
            <span>Eraser</span>
          </button>
        </div>
        <div className="note-sketch-palette" role="group" aria-label="Ink color">
          {NOTE_SKETCH_COLORS.map((ink) => (
            <button
              key={ink}
              type="button"
              className={color === ink ? "is-selected" : ""}
              aria-label={`Use ${ink} ink`}
              aria-pressed={color === ink}
              onClick={() => {
                setColor(ink);
                setTool("pencil");
              }}
            >
              <span style={{ background: ink }} />
            </button>
          ))}
        </div>
        <label className="note-sketch-width">
          <span>Size</span>
          <input
            type="range"
            min="2"
            max="12"
            step="2"
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
            aria-label="Ink size"
          />
        </label>
        <div className="note-sketch-history">
          <button
            type="button"
            disabled={strokes.length === 0}
            onClick={() => {
              const next = strokes.slice(0, -1);
              onChange(
                next.length > 0 ? { version: 1, strokes: next } : undefined,
              );
            }}
            aria-label="Undo last stroke"
            title="Undo"
          >
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            disabled={strokes.length === 0}
            onClick={() => {
              if (window.confirm("Clear every stroke from this note?")) {
                onChange(undefined);
              }
            }}
            aria-label="Clear sketch"
            title="Clear Sketch"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <svg
        className={`note-sketch-canvas tool-${tool}`}
        viewBox={`0 0 ${NOTE_SKETCH_WIDTH} ${NOTE_SKETCH_HEIGHT}`}
        role="img"
        aria-label={`Editable sketch with ${strokes.length} ${
          strokes.length === 1 ? "stroke" : "strokes"
        }`}
        onPointerDown={(event) => {
          if (tool === "eraser") {
            eraseTarget(event.target);
            return;
          }
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          activePointer.current = event.pointerId;
          const stroke: NoteSketchStroke = {
            id: crypto.randomUUID(),
            color,
            width,
            points: [pointFromPointer(event)],
          };
          draftRef.current = stroke;
          setDraft(stroke);
        }}
        onPointerMove={(event) => {
          if (tool === "eraser") {
            if (event.buttons > 0) {
              eraseTarget(document.elementFromPoint(event.clientX, event.clientY));
            }
            return;
          }
          if (activePointer.current !== event.pointerId || !draftRef.current) {
            return;
          }
          const point = pointFromPointer(event);
          const current = draftRef.current;
          const previous = current.points[current.points.length - 1];
          if (
            current.points.length >= NOTE_SKETCH_MAX_POINTS ||
            distance(previous, point) < 1.5
          ) {
            return;
          }
          const next = { ...current, points: [...current.points, point] };
          draftRef.current = next;
          setDraft(next);
        }}
        onPointerUp={(event) => {
          if (activePointer.current !== event.pointerId) return;
          activePointer.current = null;
          commit();
        }}
        onPointerCancel={() => {
          activePointer.current = null;
          draftRef.current = null;
          setDraft(null);
        }}
      >
        <defs>
          <pattern
            id="note-sketch-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d8d8dc" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="#fdfdfd" />
        <rect width="100%" height="100%" fill="url(#note-sketch-grid)" opacity=".42" />
        {[...strokes, ...(draft ? [draft] : [])].map((stroke) => (
          <path
            key={stroke.id}
            data-stroke-id={stroke.id}
            d={noteSketchPath(stroke.points)}
            fill="none"
            stroke={stroke.color}
            strokeWidth={stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <p className="note-sketch-caption">
        {strokes.length === 0
          ? "Draw with a mouse, trackpad, stylus, or touch."
          : `${strokes.length} ${strokes.length === 1 ? "stroke" : "strokes"} · saved with this note`}
      </p>
    </section>
  );
}
