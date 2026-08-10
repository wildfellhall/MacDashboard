import { describe, expect, it } from "vitest";
import {
  NOTE_SKETCH_HEIGHT,
  NOTE_SKETCH_MAX_POINTS,
  NOTE_SKETCH_MAX_STROKES,
  NOTE_SKETCH_WIDTH,
  noteSketchPath,
  normalizeNoteSketch,
} from "./noteSketch";

describe("note sketch normalization", () => {
  it("bounds untrusted persisted strokes, coordinates, colors, and widths", () => {
    const sketch = normalizeNoteSketch({
      version: 999,
      strokes: Array.from({ length: NOTE_SKETCH_MAX_STROKES + 5 }, (_, index) => ({
        id: `stroke ${index}<script>`,
        color: index === 0 ? "javascript:alert(1)" : "#0A84FF",
        width: 900,
        points: Array.from(
          { length: NOTE_SKETCH_MAX_POINTS + 3 },
          () => ({ x: -100, y: 9_000 }),
        ),
      })),
    });

    expect(sketch?.version).toBe(1);
    expect(sketch?.strokes).toHaveLength(NOTE_SKETCH_MAX_STROKES);
    expect(sketch?.strokes[0].id).not.toContain("<");
    expect(sketch?.strokes[0].color).toBe("#0a84ff");
    expect(sketch?.strokes[0].width).toBe(24);
    expect(sketch?.strokes[0].points).toHaveLength(NOTE_SKETCH_MAX_POINTS);
    expect(sketch?.strokes[0].points[0]).toEqual({
      x: 0,
      y: NOTE_SKETCH_HEIGHT,
    });
  });

  it("returns no sketch for empty or malformed data", () => {
    expect(normalizeNoteSketch(undefined)).toBeUndefined();
    expect(normalizeNoteSketch({ strokes: [] })).toBeUndefined();
    expect(normalizeNoteSketch({ strokes: [{ points: "not-points" }] }))
      .toBeUndefined();
  });
});

describe("note sketch paths", () => {
  it("creates a bounded visible path for one or many points", () => {
    expect(noteSketchPath([{ x: 4, y: 8 }])).toContain("l 0.01 0");
    const path = noteSketchPath([
      { x: 0, y: 0 },
      { x: NOTE_SKETCH_WIDTH / 2, y: NOTE_SKETCH_HEIGHT / 2 },
      { x: NOTE_SKETCH_WIDTH, y: NOTE_SKETCH_HEIGHT },
    ]);
    expect(path).toMatch(/^M /);
    expect(path).toContain("Q ");
    expect(path).toContain("L ");
    expect(path).not.toContain("NaN");
  });
});
