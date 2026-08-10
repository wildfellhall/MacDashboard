import type {
  FeedbackEvent,
  PersonalizationSnapshot,
  Profile,
} from "../types";

const FEEDBACK_WEIGHT = {
  opened: 0.25,
  saved: 1.5,
  liked: 2,
  downloaded: 2.25,
  dismissed: -2,
} as const;

export const buildPersonalizationSnapshot = (
  profile: Profile,
  events: FeedbackEvent[],
): PersonalizationSnapshot => {
  const scores = new Map<string, number>();

  for (const event of events) {
    for (const rawTag of event.tags) {
      const tag = rawTag.trim().toLowerCase();
      if (!tag) continue;
      scores.set(tag, (scores.get(tag) ?? 0) + FEEDBACK_WEIGHT[event.kind]);
    }
  }

  const ordered = [...scores.entries()].sort((a, b) => b[1] - a[1]);

  return {
    explicit: profile,
    learnedLikes: ordered
      .filter(([, score]) => score >= 1.5)
      .map(([tag]) => tag)
      .slice(0, 12),
    learnedAvoids: ordered
      .filter(([, score]) => score <= -1.5)
      .sort((a, b) => a[1] - b[1])
      .map(([tag]) => tag)
      .slice(0, 12),
    eventCount: events.length,
  };
};

export const addFeedbackEvent = (
  events: FeedbackEvent[],
  event: Omit<FeedbackEvent, "id" | "timestamp">,
) => {
  const next: FeedbackEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };

  const withoutDuplicate = events.filter(
    (item) =>
      !(
        item.appId === next.appId &&
        item.targetId === next.targetId &&
        item.kind === next.kind
      ),
  );

  return [...withoutDuplicate, next].slice(-500);
};

export const removeFeedbackEvent = (
  events: FeedbackEvent[],
  event: Omit<FeedbackEvent, "id" | "timestamp">,
) =>
  events.filter(
    (item) =>
      !(
        item.appId === event.appId &&
        item.targetId === event.targetId &&
        item.kind === event.kind
      ),
  );
