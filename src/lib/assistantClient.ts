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
      body: JSON.stringify(payload),
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
