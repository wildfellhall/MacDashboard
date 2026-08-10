// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { mergePreferenceSuggestion } from "./preferenceMerge";
import { parseProfile } from "./profile";

describe("reviewed preference suggestions", () => {
  it("merges recognized fields without duplicating existing values", () => {
    const original =
      "<h1>Preferences</h1><p><strong>Interests:</strong> architecture</p><p><strong>Moods:</strong> warm</p><p><strong>Favorites:</strong> precise prose</p><p><strong>Avoid:</strong> cynicism</p>";
    const merged = mergePreferenceSuggestion(
      original,
      "Interests: architecture, courtyard houses",
    );

    expect(merged?.appliedFields).toEqual(["Interests"]);
    expect(parseProfile(merged?.html ?? "").interests).toEqual([
      "architecture",
      "courtyard houses",
    ]);
  });

  it("rejects free-form or unknown preference patches", () => {
    expect(
      mergePreferenceSuggestion("<p>Preferences</p>", "<script>bad</script>"),
    ).toBeNull();
    expect(
      mergePreferenceSuggestion("<p>Preferences</p>", "Secret: value"),
    ).toBeNull();
  });
});
