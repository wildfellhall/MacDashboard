import type {
  NoteSketch,
  NoteSketchPoint,
  NoteSketchStroke,
} from "../types";

export const NOTE_SKETCH_WIDTH = 1000;
export const NOTE_SKETCH_HEIGHT = 520;
export const NOTE_SKETCH_MAX_STROKES = 300;
export const NOTE_SKETCH_MAX_POINTS = 1_200;

export const NOTE_SKETCH_COLORS = [
  "#202124",
  "#0a84ff",
  "#ff453a",
  "#ff9f0a",
  "#34c759",
] as const;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const finiteNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const normalizePoint = (value: unknown): NoteSketchPoint | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const point = value as Record<string, unknown>;
  const x = finiteNumber(point.x);
  const y = finiteNumber(point.y);
  if (x === null || y === null) return null;
  return {
    x: clamp(x, 0, NOTE_SKETCH_WIDTH),
    y: clamp(y, 0, NOTE_SKETCH_HEIGHT),
  };
};

const normalizeStroke = (
  value: unknown,
  index: number,
): NoteSketchStroke | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const stroke = value as Record<string, unknown>;
  if (!Array.isArray(stroke.points)) return null;
  const points = stroke.points
    .slice(0, NOTE_SKETCH_MAX_POINTS)
    .map(normalizePoint)
    .filter((point): point is NoteSketchPoint => Boolean(point));
  if (points.length === 0) return null;

  const requestedColor =
    typeof stroke.color === "string" ? stroke.color.toLowerCase() : "";
  const color = NOTE_SKETCH_COLORS.includes(
    requestedColor as (typeof NOTE_SKETCH_COLORS)[number],
  )
    ? requestedColor
    : NOTE_SKETCH_COLORS[0];
  const requestedWidth = finiteNumber(stroke.width);
  const width = requestedWidth === null ? 4 : clamp(requestedWidth, 1, 24);
  const requestedId =
    typeof stroke.id === "string"
      ? stroke.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)
      : "";

  return {
    id: requestedId || `stroke-${index}`,
    color,
    width,
    points,
  };
};

export const normalizeNoteSketch = (value: unknown): NoteSketch | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const sketch = value as Record<string, unknown>;
  if (!Array.isArray(sketch.strokes)) return undefined;
  const strokes = sketch.strokes
    .slice(-NOTE_SKETCH_MAX_STROKES)
    .map(normalizeStroke)
    .filter((stroke): stroke is NoteSketchStroke => Boolean(stroke));
  return strokes.length > 0 ? { version: 1, strokes } : undefined;
};

export const noteSketchPath = (points: NoteSketchPoint[]) => {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const point = points[0];
    return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)} l 0.01 0`;
  }

  const commands = [
    `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`,
  ];
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    const midpointX = (point.x + next.x) / 2;
    const midpointY = (point.y + next.y) / 2;
    commands.push(
      `Q ${point.x.toFixed(2)} ${point.y.toFixed(2)} ${midpointX.toFixed(2)} ${midpointY.toFixed(2)}`,
    );
  }
  const last = points[points.length - 1];
  commands.push(`L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`);
  return commands.join(" ");
};

export const sketchToPngAttachment = (
  sketch: NoteSketch | undefined,
  title: string,
) => {
  const normalized = normalizeNoteSketch(sketch);
  if (!normalized || typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = NOTE_SKETCH_WIDTH;
  canvas.height = NOTE_SKETCH_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return undefined;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of normalized.strokes) {
    context.beginPath();
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    stroke.points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    if (stroke.points.length === 1) {
      const point = stroke.points[0];
      context.lineTo(point.x + 0.01, point.y);
    }
    context.stroke();
  }

  const dataUrl = canvas.toDataURL("image/png");
  const base64 = dataUrl.split(",")[1] ?? "";
  const safeTitle =
    title
      .trim()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "note";
  return {
    id: crypto.randomUUID(),
    name: `${safeTitle}-sketch.png`,
    mimeType: "image/png" as const,
    size: Math.floor((base64.length * 3) / 4),
    dataUrl,
  };
};
