import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESKTOP_COLOR,
  desktopColorTone,
  normalizeDesktopColor,
} from "./desktopAppearance";

describe("desktop appearance", () => {
  it("normalizes valid colors and rejects malformed persisted values", () => {
    expect(normalizeDesktopColor(" #AABBCC ")).toBe("#aabbcc");
    expect(normalizeDesktopColor("blue")).toBe(DEFAULT_DESKTOP_COLOR);
    expect(normalizeDesktopColor(null)).toBe(DEFAULT_DESKTOP_COLOR);
  });

  it("classifies colors for contrast-aware desktop details", () => {
    expect(desktopColorTone("#ffffff")).toBe("light");
    expect(desktopColorTone("#142536")).toBe("dark");
  });
});
