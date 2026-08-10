// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { sanitizeNoteHtml } from "./noteSanitizer";

describe("note HTML sanitizer", () => {
  it("keeps supported rich text while removing executable markup", () => {
    const clean = sanitizeNoteHtml(
      '<h1 onclick="alert(1)">Draft</h1><script>alert(1)</script><img src=x onerror="alert(1)"><p><strong>Safe</strong></p>',
    );

    expect(clean).toContain("<h1>Draft</h1>");
    expect(clean).toContain("<strong>Safe</strong>");
    expect(clean).not.toMatch(/script|onclick|onerror|<img/i);
  });

  it("preserves highlight color but drops URL-bearing styles", () => {
    const clean = sanitizeNoteHtml(
      '<span style="background-color: rgb(255, 240, 169); background-image: url(https://example.com/track)">Marked</span>',
    );

    expect(clean).toContain("background-color");
    expect(clean).not.toContain("background-image");
    expect(clean).not.toContain("example.com");
  });
});
