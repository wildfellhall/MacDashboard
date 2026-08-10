import { describe, expect, it } from "vitest";
import {
  addFeedbackEvent,
  buildPersonalizationSnapshot,
  removeFeedbackEvent,
} from "./personalization";
import type { FeedbackEvent, Profile } from "../types";

const explicit: Profile = {
  interests: ["architecture"],
  moods: ["warm"],
  favorites: [],
  avoid: [],
};

const event = (
  kind: FeedbackEvent["kind"],
  tags: string[],
): FeedbackEvent => ({
  id: crypto.randomUUID(),
  appId: "photos",
  targetId: crypto.randomUUID(),
  targetTitle: "Test",
  tags,
  kind,
  timestamp: new Date().toISOString(),
});

describe("behavioral personalization", () => {
  it("learns repeated positive and negative taste signals", () => {
    const snapshot = buildPersonalizationSnapshot(explicit, [
      event("liked", ["coastal", "minimalism"]),
      event("saved", ["coastal"]),
      event("dismissed", ["neon"]),
    ]);

    expect(snapshot.learnedLikes).toContain("coastal");
    expect(snapshot.learnedLikes).toContain("minimalism");
    expect(snapshot.learnedAvoids).toContain("neon");
    expect(snapshot.eventCount).toBe(3);
  });

  it("retracts a signal when the matching UI choice is removed", () => {
    const input = {
      appId: "photos" as const,
      targetId: "coast",
      targetTitle: "Coast",
      tags: ["coastal"],
      kind: "liked" as const,
    };
    const withLike = addFeedbackEvent([], input);
    const withoutLike = removeFeedbackEvent(withLike, input);

    expect(buildPersonalizationSnapshot(explicit, withLike).learnedLikes).toContain(
      "coastal",
    );
    expect(withoutLike).toEqual([]);
  });
});
