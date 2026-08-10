// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  analyzePhotoMetadata,
  localPhotoAffinity,
} from "./localPhotoSignals";

describe("local photo signals", () => {
  it("stores aggregate thematic tokens and formats without filenames or bytes", () => {
    const first = new File(["a"], "misty-coastal-architecture.jpg", {
      type: "image/jpeg",
    });
    const second = new File(["b"], "coastal-museum-morning.png", {
      type: "image/png",
    });

    const signals = analyzePhotoMetadata([first, second]);
    expect(signals.fileCount).toBe(2);
    expect(signals.tags).toContainEqual({ label: "coastal", count: 2 });
    expect(signals.tags).toContainEqual({ label: "architecture", count: 1 });
    expect(signals.formats).toEqual([
      { label: "jpeg", count: 1 },
      { label: "png", count: 1 },
    ]);
    expect(JSON.stringify(signals)).not.toContain(first.name);
    expect(localPhotoAffinity(signals)).toContain("coastal");
  });

  it("rejects non-image selections", () => {
    const text = new File(["private"], "messages.txt", {
      type: "text/plain",
    });
    expect(() => analyzePhotoMetadata([text])).toThrow(/Choose JPEG/);
  });
});
