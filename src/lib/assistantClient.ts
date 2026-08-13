import type { AppId, Profile } from "../types";
import type { TasteDossier } from "./tasteDossier";

export type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
  image?: {
    name: string;
    mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    dataUrl: string;
  };
};

export type AssistantNoteMetadata = {
  id: string;
  title: string;
  folder?: string;
  updatedAt?: string;
  pinned?: boolean;
  hasSketch?: boolean;
};

export type AssistantRelevantNote = {
  id: string;
  title: string;
  folder: string;
  excerpt: string;
  matchedTerms: string[];
};

export type AssistantTasteSignal = {
  appId: AppId;
  targetTitle: string;
  tags: string[];
  kind: "opened" | "saved" | "liked" | "downloaded" | "dismissed";
  timestamp: string;
};

export type AssistantReview = {
  title: string;
  rating?: number;
  minutes?: number;
  reviewedAt: string;
};

export type AssistantBookHistory = {
  title: string;
  author?: string;
  rating?: number;
  readAt?: string;
  minutes?: number;
  shelves: string[];
};

export type AssistantLocalPhotoSignals = {
  fileCount: number;
  tags: string[];
  palette: string[];
  importedAt: string;
};

export type AssistantLocalChatSignals = {
  messageCount: number;
  topics: string[];
  importedAt: string;
};

export type AssistantRecommendation = {
  appId: "books" | "photos" | "tv";
  itemId: string;
  title: string;
  kind: string;
  score: number;
  tags: string[];
  description?: string;
  evidenceSummary?: string;
  sourceNotes?: string[];
};

export type AssistantActiveSelection = {
  appId: "books" | "photos" | "tv";
  itemId: string;
  title: string;
};

export type AssistantRequest = {
  messages: AssistantMessage[];
  profile: Profile;
  activeApp?: AppId;
  notes?: AssistantNoteMetadata[];
  relevantNotes?: AssistantRelevantNote[];
  tasteDossier?: TasteDossier;
  tasteSignals?: AssistantTasteSignal[];
  reviews?: AssistantReview[];
  bookHistory?: AssistantBookHistory[];
  localPhotoSignals?: AssistantLocalPhotoSignals;
  localChatSignals?: AssistantLocalChatSignals;
  recommendations?: AssistantRecommendation[];
  activeSelection?: AssistantActiveSelection;
};

export type DashboardAction =
  | { type: "open_app"; app: AppId }
  | { type: "select_note"; noteId: string }
  | {
      type: "set_app_view";
      app: "books" | "photos" | "tv";
      view: string;
    }
  | {
      type: "search_app";
      app: "books" | "photos" | "notes" | "tv";
      query: string;
    }
  | {
      type: "select_item";
      app: "books" | "photos" | "tv";
      itemId: string;
    }
  | {
      type: "propose_note_edit";
      noteId: string;
      mode: "append" | "replace";
      content: string;
      reason: string;
    }
  | {
      type: "propose_note_create";
      title: string;
      folder: "Personal" | "Ideas" | "Reviews";
      content: string;
      reason: string;
    }
  | {
      type: "update_preferences";
      suggestion: string;
      reason: string;
    }
  | {
      type: "update_library";
      app: "books" | "photos" | "tv";
      itemId: string;
      operation: "add" | "remove";
      reason: string;
    };

export type AssistantResult = {
  message: string;
  actions: DashboardAction[];
  provider: "openai" | "codex" | "local";
  model?: string;
  threadId?: string;
  configured: boolean;
  fallbackReason?: AssistantFallbackReason;
  retryable?: boolean;
};

export type AssistantRequestOptions = {
  signal?: AbortSignal;
  configured?: boolean;
  provider?: "openai" | "codex" | "local";
};

export type AssistantConfig = {
  configured: boolean;
  provider: "openai" | "codex" | "local";
  model?: string;
  localOnly: boolean;
  openAIStore?: boolean;
  status: "local" | "configured" | "connected" | "fallback";
  fallbackReason?: AssistantFallbackReason;
  codexAuthenticated?: boolean;
  codexThreadPersistent?: boolean;
  codexSandbox?: "read-only" | "workspace-write";
  codexThreadId?: string;
};

export type AssistantFallbackReason =
  | "not_configured"
  | "service_unavailable"
  | "authentication_failed"
  | "rate_limited"
  | "timeout"
  | "refused"
  | "incomplete"
  | "invalid_response"
  | "provider_failed"
  | "provider_unavailable"
  | "invalid_request"
  | "request_rejected";

const FALLBACK_REASONS = new Set<AssistantFallbackReason>([
  "not_configured",
  "service_unavailable",
  "authentication_failed",
  "rate_limited",
  "timeout",
  "refused",
  "incomplete",
  "invalid_response",
  "provider_failed",
  "provider_unavailable",
  "invalid_request",
  "request_rejected",
]);

const APP_IDS = new Set<AppId>([
  "books",
  "photos",
  "notes",
  "tv",
  "messages",
  "dictionary",
]);
const APP_VIEWS: Record<"books" | "photos" | "tv", Set<string>> = {
  books: new Set(["discover", "reread", "saved"]),
  photos: new Set(["recommended", "all", "liked", "disliked"]),
  tv: new Set(["discover", "rewatch", "upNext"]),
};
const SEARCHABLE_APPS = new Set(["books", "photos", "notes", "tv"]);
const PREFERENCE_SUGGESTION_LINE_PATTERN =
  /^(?:Interests|Moods|Favorites|Avoid)\s*:\s*\S(?:.*\S)?$/i;

const isValidPreferenceSuggestion = (value: string) => {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines.length > 0 &&
    lines.every((line) => PREFERENCE_SUGGESTION_LINE_PATTERN.test(line))
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const cleanText = (value: unknown, maximum: number) =>
  typeof value === "string" ? value.trim().slice(0, maximum) : "";

const cleanTextArray = (
  value: unknown,
  maximumItems: number,
  maximumCharacters: number,
) =>
  Array.isArray(value)
    ? [
        ...new Set(
          value
            .map((item) => cleanText(item, maximumCharacters))
            .filter(Boolean),
        ),
      ].slice(0, maximumItems)
    : [];

const cleanOptionalNumber = (
  value: unknown,
  minimum: number,
  maximum: number,
  integer = false,
) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= minimum &&
  value <= maximum &&
  (!integer || Number.isInteger(value))
    ? value
    : undefined;

const validDateText = (value: unknown) => {
  const text = cleanText(value, 80);
  return text && !Number.isNaN(new Date(text).getTime()) ? text : "";
};

const MESSAGE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MESSAGE_IMAGE_SIGNATURES: Record<string, RegExp> = {
  "image/jpeg": /^\/9j\//,
  "image/png": /^iVBORw0KGgo/,
  "image/webp": /^UklGR/,
  "image/gif": /^R0lGOD/,
};
const ASSISTANT_APPS = new Set<AppId>([
  "books",
  "photos",
  "notes",
  "tv",
  "messages",
  "dictionary",
]);
const FEEDBACK_KINDS = new Set([
  "opened",
  "saved",
  "liked",
  "downloaded",
  "dismissed",
]);
const TASTE_POLARITIES = new Set(["positive", "negative", "curious"]);
const TASTE_DOMAINS = new Set(["general", "books", "tv", "photos"]);
const RECOMMENDATION_APPS = new Set(["books", "photos", "tv"]);

const prepareMessages = (value: unknown): AssistantMessage[] => {
  if (!Array.isArray(value)) return [];
  let remainingCharacters = 20_000;
  const messages: AssistantMessage[] = [];
  for (const candidate of [...value].slice(-12).reverse()) {
    if (!isRecord(candidate) || remainingCharacters < 1) continue;
    if (candidate.role !== "user" && candidate.role !== "assistant") continue;
    const content = cleanText(
      candidate.content,
      Math.min(4_000, remainingCharacters),
    );
    if (!content) continue;
    remainingCharacters -= content.length;
    const image = candidate.image;
    const mimeType = isRecord(image) ? cleanText(image.mimeType, 32) : "";
    const dataUrl = isRecord(image) && typeof image.dataUrl === "string"
      ? image.dataUrl.trim()
      : "";
    const name = isRecord(image) ? cleanText(image.name, 160) : "";
    const imagePrefix = mimeType ? `data:${mimeType};base64,` : "";
    const encoded = imagePrefix && dataUrl.startsWith(imagePrefix)
      ? dataUrl.slice(imagePrefix.length)
      : "";
    const hasBoundedImage =
      candidate.role === "user" &&
      MESSAGE_IMAGE_TYPES.has(mimeType) &&
      Boolean(name && encoded) &&
      dataUrl.length <= 2_700_000 &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(encoded) &&
      MESSAGE_IMAGE_SIGNATURES[mimeType]?.test(encoded) === true &&
      Math.floor((encoded.length * 3) / 4) <= 2_000_000;
    messages.unshift({
      role: candidate.role,
      content,
      ...(hasBoundedImage
        ? {
            image: {
              name,
              mimeType: mimeType as NonNullable<
                AssistantMessage["image"]
              >["mimeType"],
              dataUrl,
            },
          }
        : {}),
    });
  }
  return messages;
};

export const prepareAssistantRequest = (
  payload: AssistantRequest,
): AssistantRequest => {
  const notes: AssistantNoteMetadata[] = [];
  const notesByOriginalId = new Map<string, AssistantNoteMetadata>();
  const cleanNoteIds = new Set<string>();
  if (Array.isArray(payload.notes)) {
    for (const candidate of payload.notes) {
      if (notes.length >= 50) break;
      if (!isRecord(candidate)) continue;
      const originalId = cleanText(candidate.id, 10_000);
      const id = cleanText(candidate.id, 120);
      const title = cleanText(candidate.title, 240);
      if (!originalId || !id || !title || cleanNoteIds.has(id)) continue;
      const note: AssistantNoteMetadata = {
        id,
        title,
        folder: cleanText(candidate.folder, 120),
        ...(cleanText(candidate.updatedAt, 80)
          ? { updatedAt: cleanText(candidate.updatedAt, 80) }
          : {}),
        ...(typeof candidate.pinned === "boolean"
          ? { pinned: candidate.pinned }
          : {}),
        ...(typeof candidate.hasSketch === "boolean"
          ? { hasSketch: candidate.hasSketch }
          : {}),
      };
      notes.push(note);
      cleanNoteIds.add(id);
      notesByOriginalId.set(originalId, note);
    }
  }

  const relevantNotes: AssistantRelevantNote[] = [];
  const relevantIds = new Set<string>();
  if (Array.isArray(payload.relevantNotes)) {
    for (const candidate of payload.relevantNotes) {
      if (relevantNotes.length >= 4) break;
      if (!isRecord(candidate)) continue;
      const note = notesByOriginalId.get(cleanText(candidate.id, 10_000));
      const excerpt = cleanText(candidate.excerpt, 600);
      if (!note || !excerpt || relevantIds.has(note.id)) continue;
      relevantIds.add(note.id);
      relevantNotes.push({
        id: note.id,
        title: note.title,
        folder: note.folder ?? "",
        excerpt,
        matchedTerms: cleanTextArray(candidate.matchedTerms, 10, 80),
      });
    }
  }

  const evidence: TasteDossier["evidence"] = [];
  const rawEvidence = isRecord(payload.tasteDossier) &&
    Array.isArray(payload.tasteDossier.evidence)
    ? payload.tasteDossier.evidence
    : [];
  for (const candidate of rawEvidence) {
    if (evidence.length >= 80) break;
    if (!isRecord(candidate)) continue;
    const note = notesByOriginalId.get(cleanText(candidate.noteId, 10_000));
    const passage = cleanText(candidate.passage, 360);
    const concepts = cleanTextArray(candidate.concepts, 20, 80);
    const domains = cleanTextArray(candidate.domains, 4, 16).filter((domain) =>
      TASTE_DOMAINS.has(domain),
    ) as TasteDossier["evidence"][number]["domains"];
    if (
      !note ||
      !passage ||
      !concepts.length ||
      !domains.length ||
      !TASTE_POLARITIES.has(String(candidate.polarity)) ||
      !Number.isInteger(candidate.strength) ||
      Number(candidate.strength) < 1 ||
      Number(candidate.strength) > 5
    ) {
      continue;
    }
    evidence.push({
      noteId: note.id,
      noteTitle: note.title,
      folder: (note.folder ?? "") as TasteDossier["evidence"][number]["folder"],
      passage,
      polarity: candidate.polarity as TasteDossier["evidence"][number]["polarity"],
      strength: Number(candidate.strength),
      domains,
      concepts,
      updatedAt: cleanText(candidate.updatedAt, 80),
    });
  }
  const tasteDossier: TasteDossier = {
    currentNoteCount: notes.length,
    evidenceNoteCount: new Set(evidence.map((item) => item.noteId)).size,
    evidenceCount: evidence.length,
    evidence,
  };

  const tasteSignals: AssistantTasteSignal[] = Array.isArray(payload.tasteSignals)
    ? payload.tasteSignals.flatMap((candidate) => {
        if (!isRecord(candidate)) return [];
        const targetTitle = cleanText(candidate.targetTitle, 240);
        const timestamp = cleanText(candidate.timestamp, 80);
        if (
          !ASSISTANT_APPS.has(candidate.appId as AppId) ||
          !FEEDBACK_KINDS.has(String(candidate.kind)) ||
          !targetTitle ||
          !timestamp
        ) {
          return [];
        }
        return [{
          appId: candidate.appId as AppId,
          targetTitle,
          tags: cleanTextArray(candidate.tags, 16, 120),
          kind: candidate.kind as AssistantTasteSignal["kind"],
          timestamp,
        }];
      }).slice(-30)
    : [];

  const reviews: AssistantReview[] = Array.isArray(payload.reviews)
    ? payload.reviews.flatMap((candidate) => {
        if (!isRecord(candidate)) return [];
        const title = cleanText(candidate.title, 240);
        const reviewedAt = cleanText(candidate.reviewedAt, 80);
        if (!title || !reviewedAt) return [];
        const rating = cleanOptionalNumber(candidate.rating, 0, 5);
        const minutes = cleanOptionalNumber(candidate.minutes, 0, 1_000_000, true);
        return [{
          title,
          reviewedAt,
          ...(rating !== undefined ? { rating } : {}),
          ...(minutes !== undefined ? { minutes } : {}),
        }];
      }).slice(0, 30)
    : [];

  const bookHistory: AssistantBookHistory[] = Array.isArray(payload.bookHistory)
    ? payload.bookHistory.flatMap((candidate) => {
        if (!isRecord(candidate)) return [];
        const title = cleanText(candidate.title, 240);
        if (!title) return [];
        const author = cleanText(candidate.author, 180);
        const rating = cleanOptionalNumber(candidate.rating, 0, 5);
        const minutes = cleanOptionalNumber(candidate.minutes, 0, 1_000_000, true);
        const readAt = validDateText(candidate.readAt);
        return [{
          title,
          shelves: cleanTextArray(candidate.shelves, 16, 120),
          ...(author ? { author } : {}),
          ...(rating !== undefined ? { rating } : {}),
          ...(minutes !== undefined ? { minutes } : {}),
          ...(readAt ? { readAt } : {}),
        }];
      }).slice(0, 100)
    : [];

  const recommendations: AssistantRecommendation[] = [];
  const recommendationIds = new Set<string>();
  if (Array.isArray(payload.recommendations)) {
    for (const candidate of payload.recommendations) {
      if (recommendations.length >= 30) break;
      if (!isRecord(candidate)) continue;
      const appId = cleanText(candidate.appId, 16);
      const itemId = cleanText(candidate.itemId, 120);
      const title = cleanText(candidate.title, 240);
      const kind = cleanText(candidate.kind, 80);
      const score = cleanOptionalNumber(candidate.score, 0, 100);
      const key = `${appId}:${itemId}`;
      if (
        !RECOMMENDATION_APPS.has(appId) ||
        !itemId ||
        !title ||
        !kind ||
        score === undefined ||
        recommendationIds.has(key)
      ) {
        continue;
      }
      recommendationIds.add(key);
      const description = cleanText(candidate.description, 700);
      const evidenceSummary = cleanText(candidate.evidenceSummary, 600);
      const sourceNotes = cleanTextArray(candidate.sourceNotes, 5, 240);
      recommendations.push({
        appId: appId as AssistantRecommendation["appId"],
        itemId,
        title,
        kind,
        score,
        tags: cleanTextArray(candidate.tags, 16, 120),
        ...(description ? { description } : {}),
        ...(evidenceSummary ? { evidenceSummary } : {}),
        ...(sourceNotes.length ? { sourceNotes } : {}),
      });
    }
  }

  const activeApp = ASSISTANT_APPS.has(payload.activeApp as AppId)
    ? payload.activeApp
    : undefined;
  const activeSelectionApp = cleanText(payload.activeSelection?.appId, 16);
  const activeSelectionId = cleanText(payload.activeSelection?.itemId, 120);
  const selectedRecommendation = recommendations.find(
    (item) =>
      item.appId === activeSelectionApp && item.itemId === activeSelectionId,
  );

  const localPhoto = isRecord(payload.localPhotoSignals)
    ? payload.localPhotoSignals
    : null;
  const photoFileCount = cleanOptionalNumber(localPhoto?.fileCount, 1, 120, true);
  const photoImportedAt = validDateText(localPhoto?.importedAt);
  const photoTags = cleanTextArray(localPhoto?.tags, 16, 120);
  const photoPalette = cleanTextArray(
    localPhoto?.palette,
    Math.max(0, 16 - photoTags.length),
    120,
  );

  const localChat = isRecord(payload.localChatSignals)
    ? payload.localChatSignals
    : null;
  const chatMessageCount = cleanOptionalNumber(
    localChat?.messageCount,
    1,
    5_000,
    true,
  );
  const chatImportedAt = validDateText(localChat?.importedAt);
  const chatTopics = cleanTextArray(localChat?.topics, 12, 120);

  return {
    messages: prepareMessages(payload.messages),
    profile: {
      interests: cleanTextArray(payload.profile?.interests, 30, 200),
      moods: cleanTextArray(payload.profile?.moods, 30, 200),
      favorites: cleanTextArray(payload.profile?.favorites, 30, 200),
      avoid: cleanTextArray(payload.profile?.avoid, 30, 200),
    },
    ...(activeApp ? { activeApp } : {}),
    notes,
    relevantNotes,
    tasteDossier,
    tasteSignals,
    reviews,
    bookHistory,
    ...(photoFileCount !== undefined && photoImportedAt
      ? {
          localPhotoSignals: {
            fileCount: photoFileCount,
            tags: photoTags,
            palette: photoPalette,
            importedAt: photoImportedAt,
          },
        }
      : {}),
    ...(chatMessageCount !== undefined && chatImportedAt && chatTopics.length
      ? {
          localChatSignals: {
            messageCount: chatMessageCount,
            topics: chatTopics,
            importedAt: chatImportedAt,
          },
        }
      : {}),
    recommendations,
    ...(selectedRecommendation
      ? {
          activeSelection: {
            appId: selectedRecommendation.appId,
            itemId: selectedRecommendation.itemId,
            title: selectedRecommendation.title,
          },
        }
      : {}),
  };
};

const parseActions = (value: unknown): DashboardAction[] => {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 3).flatMap((action): DashboardAction[] => {
    if (!isRecord(action) || typeof action.type !== "string") return [];

    if (
      action.type === "open_app" &&
      typeof action.app === "string" &&
      APP_IDS.has(action.app as AppId)
    ) {
      return [{ type: "open_app", app: action.app as AppId }];
    }
    if (
      action.type === "select_note" &&
      typeof action.noteId === "string" &&
      action.noteId.length > 0
    ) {
      return [{ type: "select_note", noteId: action.noteId }];
    }
    if (
      action.type === "set_app_view" &&
      typeof action.app === "string" &&
      action.app in APP_VIEWS &&
      typeof action.view === "string" &&
      APP_VIEWS[action.app as keyof typeof APP_VIEWS].has(action.view)
    ) {
      return [
        {
          type: "set_app_view",
          app: action.app as keyof typeof APP_VIEWS,
          view: action.view,
        },
      ];
    }
    if (
      action.type === "search_app" &&
      typeof action.app === "string" &&
      SEARCHABLE_APPS.has(action.app) &&
      typeof action.query === "string" &&
      action.query.trim().length > 0 &&
      action.query.length <= 160
    ) {
      return [
        {
          type: "search_app",
          app: action.app as "books" | "photos" | "notes" | "tv",
          query: action.query.trim(),
        },
      ];
    }
    if (
      action.type === "select_item" &&
      typeof action.app === "string" &&
      action.app in APP_VIEWS &&
      typeof action.itemId === "string" &&
      action.itemId.trim().length > 0 &&
      action.itemId.length <= 120
    ) {
      return [
        {
          type: "select_item",
          app: action.app as keyof typeof APP_VIEWS,
          itemId: action.itemId.trim(),
        },
      ];
    }
    if (
      action.type === "update_library" &&
      typeof action.app === "string" &&
      action.app in APP_VIEWS &&
      typeof action.itemId === "string" &&
      action.itemId.trim().length > 0 &&
      action.itemId.length <= 120 &&
      (action.operation === "add" || action.operation === "remove") &&
      typeof action.reason === "string" &&
      action.reason.trim().length > 0 &&
      action.reason.length <= 300
    ) {
      return [
        {
          type: "update_library",
          app: action.app as keyof typeof APP_VIEWS,
          itemId: action.itemId.trim(),
          operation: action.operation,
          reason: action.reason.trim(),
        },
      ];
    }
    if (
      action.type === "propose_note_edit" &&
      typeof action.noteId === "string" &&
      action.noteId.trim().length > 0 &&
      action.noteId.trim() !== "preferences" &&
      action.noteId.length <= 120 &&
      (action.mode === "append" || action.mode === "replace") &&
      typeof action.content === "string" &&
      action.content.trim().length > 0 &&
      action.content.length <= 5_000 &&
      typeof action.reason === "string" &&
      action.reason.trim().length > 0 &&
      action.reason.length <= 300
    ) {
      return [
        {
          type: "propose_note_edit",
          noteId: action.noteId.trim(),
          mode: action.mode,
          content: action.content.trim(),
          reason: action.reason.trim(),
        },
      ];
    }
    if (
      action.type === "propose_note_create" &&
      typeof action.title === "string" &&
      action.title.trim().length > 0 &&
      action.title.length <= 120 &&
      (action.folder === "Personal" ||
        action.folder === "Ideas" ||
        action.folder === "Reviews") &&
      typeof action.content === "string" &&
      action.content.trim().length > 0 &&
      action.content.length <= 5_000 &&
      typeof action.reason === "string" &&
      action.reason.trim().length > 0 &&
      action.reason.length <= 300
    ) {
      return [
        {
          type: "propose_note_create",
          title: action.title.trim(),
          folder: action.folder,
          content: action.content.trim(),
          reason: action.reason.trim(),
        },
      ];
    }
    if (
      action.type === "update_preferences" &&
      typeof action.suggestion === "string" &&
      action.suggestion.length > 0 &&
      action.suggestion.length <= 500 &&
      isValidPreferenceSuggestion(action.suggestion) &&
      typeof action.reason === "string" &&
      action.reason.length > 0 &&
      action.reason.length <= 300
    ) {
      return [
        {
          type: "update_preferences",
          suggestion: action.suggestion,
          reason: action.reason,
        },
      ];
    }
    return [];
  });
};

const parseResult = (value: unknown): AssistantResult => {
  if (
    !isRecord(value) ||
    typeof value.message !== "string" ||
    !value.message.trim() ||
    (value.provider !== "openai" &&
      value.provider !== "codex" &&
      value.provider !== "local")
  ) {
    throw new Error("The assistant service returned an invalid response.");
  }

  return {
    message: value.message,
    actions: parseActions(value.actions),
    provider: value.provider,
    configured: value.configured === true,
    ...(typeof value.model === "string" ? { model: value.model } : {}),
    ...(typeof value.threadId === "string"
      ? { threadId: value.threadId }
      : {}),
    ...(typeof value.fallbackReason === "string" &&
    FALLBACK_REASONS.has(value.fallbackReason as AssistantFallbackReason)
      ? { fallbackReason: value.fallbackReason as AssistantFallbackReason }
      : {}),
    ...(typeof value.retryable === "boolean"
      ? { retryable: value.retryable }
      : {}),
  };
};

const clientFailureResult = (
  reason: AssistantFallbackReason,
  configured: boolean,
  retryable: boolean,
  provider: "openai" | "codex" | "local" = "local",
): AssistantResult => {
  const providerName =
    provider === "codex"
      ? "Codex"
      : provider === "openai"
        ? "OpenAI"
        : "local assistant";
  const message =
    reason === "rate_limited"
      ? `${providerName} is rate-limited right now. No local fallback was used; please try again shortly.`
      : reason === "timeout"
        ? `${providerName} did not finish in time. No local fallback was used and nothing was changed; please try again.`
      : reason === "request_rejected"
        ? `${providerName} rejected this request. No local fallback was used and nothing was changed.`
        : reason === "invalid_request"
          ? `The dashboard could not send this message because its local context was invalid. The request did not reach ${providerName}; reload and try again.`
        : reason === "invalid_response"
          ? `${providerName} returned an invalid response. No local fallback was used and nothing was changed.`
          : `${providerName} is unavailable. No local fallback was used and nothing was changed.`;
  return {
    message,
    actions: [],
    provider: configured && provider !== "local" ? provider : "local",
    configured,
    fallbackReason: reason,
    retryable,
  };
};

export const sendAssistantRequest = async (
  payload: AssistantRequest,
  {
    signal,
    configured = false,
    provider = "local",
  }: AssistantRequestOptions = {},
): Promise<AssistantResult> => {
  let response: Response;
  try {
    response = await fetch("/api/assistant", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(prepareAssistantRequest(payload)),
      signal,
    });
  } catch (error) {
    if (
      signal?.aborted ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      throw error;
    }
    return clientFailureResult(
      "service_unavailable",
      configured,
      true,
      provider,
    );
  }

  if (!response.ok) {
    const failureBody: unknown = await response.json().catch(() => null);
    const serverReason =
      isRecord(failureBody) &&
      typeof failureBody.reason === "string" &&
      FALLBACK_REASONS.has(failureBody.reason as AssistantFallbackReason)
        ? (failureBody.reason as AssistantFallbackReason)
        : null;
    const serverRetryable =
      isRecord(failureBody) && typeof failureBody.retryable === "boolean"
        ? failureBody.retryable
        : null;
    if (response.status === 429) {
      return clientFailureResult(
        serverReason ?? "rate_limited",
        configured,
        serverRetryable ?? true,
        provider,
      );
    }
    if (response.status >= 500) {
      return clientFailureResult(
        serverReason ?? "service_unavailable",
        configured,
        serverRetryable ?? true,
        provider,
      );
    }
    if ([400, 403, 413].includes(response.status)) {
      return clientFailureResult(
        serverReason ?? "invalid_request",
        configured,
        serverRetryable ?? false,
        provider,
      );
    }
    return clientFailureResult(
      serverReason ?? "request_rejected",
      configured,
      serverRetryable ?? false,
      provider,
    );
  }

  try {
    return parseResult(await response.json());
  } catch {
    return clientFailureResult(
      "invalid_response",
      configured,
      true,
      provider,
    );
  }
};

export const getAssistantConfig = async (
  signal?: AbortSignal,
): Promise<AssistantConfig> => {
  try {
    const response = await fetch("/api/config", {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) throw new Error("Assistant config is unavailable.");
    const value: unknown = await response.json();
    if (!isRecord(value) || !isRecord(value.assistant)) {
      throw new Error("Assistant config is invalid.");
    }
    const assistant = value.assistant;
    return {
      configured: assistant.configured === true,
      provider:
        assistant.provider === "openai" ||
        assistant.provider === "codex"
          ? assistant.provider
          : "local",
      ...(typeof assistant.model === "string"
        ? { model: assistant.model }
        : {}),
      localOnly: assistant.localOnly !== false,
      ...(assistant.openAIStore === false ? { openAIStore: false } : {}),
      status:
        assistant.status === "configured" ||
        assistant.status === "connected" ||
        assistant.status === "fallback"
          ? assistant.status
          : "local",
      ...(assistant.codexAuthenticated === true
        ? { codexAuthenticated: true }
        : {}),
      ...(assistant.codexThreadPersistent === true
        ? { codexThreadPersistent: true }
        : {}),
      ...(assistant.codexSandbox === "read-only" ||
      assistant.codexSandbox === "workspace-write"
        ? { codexSandbox: assistant.codexSandbox }
        : {}),
      ...(typeof assistant.codexThreadId === "string"
        ? { codexThreadId: assistant.codexThreadId }
        : {}),
    };
  } catch {
    return {
      configured: false,
      provider: "local",
      localOnly: true,
      status: "local",
      fallbackReason: "service_unavailable",
    };
  }
};

export const resetCodexThread = async () => {
  const response = await fetch("/api/codex/thread/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) {
    throw new Error("Could not start a new Codex conversation.");
  }
};
