import type { Note, Profile } from "../types";
import type { TasteDossier } from "./tasteDossier";

export type RecommendationPlanCandidate = {
  title: string;
  creator: string;
  mediaType: "book" | "movie" | "series";
  searchQuery: string;
  fitScore: number;
  rationale: string;
  evidenceNotes: string[];
  facets: string[];
};

export type RecommendationPlan = {
  summary: string;
  candidates: RecommendationPlanCandidate[];
  provider: "codex" | "openai";
  model?: string;
  aiPowered: boolean;
  fallbackReason?: string;
};

export type RecommendationPlanRequest = {
  domain: "books" | "tv";
  profile: Profile;
  notes: Pick<
    Note,
    "id" | "title" | "folder" | "updatedAt" | "pinned"
  >[];
  tasteDossier: TasteDossier;
  userQuery?: string;
  anchorTitles?: string[];
  knownTitles?: string[];
  dismissedTitles?: string[];
  historyTitles?: string[];
};

const isStringArray = (value: unknown, maximum: number) =>
  Array.isArray(value) &&
  value.length <= maximum &&
  value.every((item) => typeof item === "string");

const parseCandidate = (
  value: unknown,
): RecommendationPlanCandidate | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.title !== "string" ||
    typeof item.creator !== "string" ||
    !["book", "movie", "series"].includes(String(item.mediaType)) ||
    typeof item.searchQuery !== "string" ||
    typeof item.fitScore !== "number" ||
    !Number.isInteger(item.fitScore) ||
    item.fitScore < 1 ||
    item.fitScore > 100 ||
    typeof item.rationale !== "string" ||
    !isStringArray(item.evidenceNotes, 4) ||
    !isStringArray(item.facets, 6)
  ) {
    return null;
  }
  return {
    title: item.title.slice(0, 240),
    creator: item.creator.slice(0, 180),
    mediaType: item.mediaType as "book" | "movie" | "series",
    searchQuery: item.searchQuery.slice(0, 260),
    fitScore: item.fitScore,
    rationale: item.rationale.slice(0, 700),
    evidenceNotes: (item.evidenceNotes as string[]).slice(0, 4),
    facets: (item.facets as string[]).slice(0, 6),
  };
};

export const requestRecommendationPlan = async (
  request: RecommendationPlanRequest,
  signal?: AbortSignal,
): Promise<RecommendationPlan> => {
  const response = await fetch("/api/recommendations/plan", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      typeof (payload as Record<string, unknown>).error === "string"
        ? String((payload as Record<string, unknown>).error)
        : "AI recommendation planning is unavailable.";
    throw new Error(message);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("AI recommendation planning returned an invalid response.");
  }
  const result = payload as Record<string, unknown>;
  const candidates = Array.isArray(result.candidates)
    ? result.candidates
        .map(parseCandidate)
        .filter(
          (candidate): candidate is RecommendationPlanCandidate =>
            Boolean(candidate),
        )
    : [];
  if (typeof result.summary !== "string" || candidates.length === 0) {
    throw new Error("AI recommendation planning returned no usable searches.");
  }
  if (
    (result.provider !== "codex" && result.provider !== "openai") ||
    result.aiPowered !== true
  ) {
    throw new Error(
      "AI recommendation planning did not complete. No local fallback was used.",
    );
  }
  return {
    summary: result.summary.slice(0, 600),
    candidates,
    provider: result.provider,
    aiPowered: true,
    ...(typeof result.model === "string"
      ? { model: result.model.slice(0, 120) }
      : {}),
    ...(typeof result.fallbackReason === "string"
      ? { fallbackReason: result.fallbackReason.slice(0, 120) }
      : {}),
  };
};
