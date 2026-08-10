export type AppId = "books" | "photos" | "notes" | "tv" | "messages";

export type AppMeta = {
  id: AppId;
  name: string;
  subtitle: string;
  color: string;
};

export type AppCommand = {
  id: number;
  view?: string;
  query?: string;
  itemId?: string;
};

export type WindowState = {
  appId: AppId;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  restore?: Pick<WindowState, "x" | "y" | "width" | "height">;
};

export type NoteSketchPoint = {
  x: number;
  y: number;
};

export type NoteSketchStroke = {
  id: string;
  color: string;
  width: number;
  points: NoteSketchPoint[];
};

export type NoteSketch = {
  version: 1;
  strokes: NoteSketchStroke[];
};

export type Note = {
  id: string;
  title: string;
  folder: "Personal" | "Ideas" | "Reviews";
  content: string;
  updatedAt: string;
  pinned?: boolean;
  sketch?: NoteSketch;
};

export type Profile = {
  interests: string[];
  moods: string[];
  favorites: string[];
  avoid: string[];
};

export type FeedbackKind =
  | "opened"
  | "saved"
  | "liked"
  | "downloaded"
  | "dismissed";

export type FeedbackEvent = {
  id: string;
  appId: AppId;
  targetId: string;
  targetTitle: string;
  tags: string[];
  kind: FeedbackKind;
  timestamp: string;
};

export type FeedbackInput = Omit<FeedbackEvent, "id" | "timestamp">;

export type FeedbackHandler = (
  event: FeedbackInput,
  active?: boolean,
) => void;

export type PersonalizationSnapshot = {
  explicit: Profile;
  learnedLikes: string[];
  learnedAvoids: string[];
  eventCount: number;
};

export type ReviewRecord = {
  title: string;
  rating?: number;
  minutes?: number;
  reviewedAt: string;
  summary: string;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  year: string;
  cover: string;
  genres: string[];
  themes: string[];
  description: string;
  rating?: number;
  lastRead?: string;
  minutes?: number;
  kind: "discover" | "reread";
  sourceUrl?: string;
  sourceLabel?: string;
  discoveryPrompt?: string;
  aiFitScore?: number;
  aiReason?: string;
  aiEvidenceNotes?: string[];
  aiFacets?: string[];
};

export type WatchItem = {
  id: string;
  title: string;
  year: string;
  artwork: string;
  genres: string[];
  moods: string[];
  runtime: string;
  description: string;
  kind: "discover" | "rewatch";
  lastWatched?: string;
  rating?: number;
  mediaType?: "movie" | "series";
  platforms?: string[];
  providers?: {
    name: string;
    type:
      | "subscription"
      | "free"
      | "with ads"
      | "rent"
      | "buy"
      | "rent/buy"
      | "network";
  }[];
  sourceUrl?: string;
  sourceLabel?: string;
  sourceLinks?: {
    label: string;
    url: string;
  }[];
  providerAttribution?: string;
  discoveryPrompt?: string;
  aiFitScore?: number;
  aiReason?: string;
  aiEvidenceNotes?: string[];
  aiFacets?: string[];
};

export type PhotoItem = {
  id: string;
  title: string;
  url: string;
  sourceUrl: string;
  creator: string;
  tags: string[];
  reason: string;
  license?: string;
  licenseUrl?: string;
};

export type Message = {
  id: string;
  sender: "user" | "assistant";
  body: string;
  timestamp: string;
  reaction?: string;
  provider?: "openai" | "codex" | "local";
  model?: string;
  fallbackReason?: string;
  noteContext?: {
    noteId: string;
    title: string;
  }[];
  attachment?: {
    id: string;
    name: string;
    mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    size: number;
    dataUrl?: string;
  };
  preferenceSuggestion?: {
    text: string;
    reason: string;
    status?: "pending" | "accepted" | "rejected";
  };
  noteSuggestion?: {
    noteId: string;
    mode: "append" | "replace";
    content: string;
    reason: string;
    status?: "pending" | "accepted" | "rejected";
  };
  noteCreationSuggestion?: {
    title: string;
    folder: Note["folder"];
    content: string;
    reason: string;
    status?: "pending" | "accepted" | "rejected";
  };
  noteAccessSuggestion?: {
    noteId: string;
    noteTitle: string;
    request: string;
    hasSketch?: boolean;
    status?: "pending" | "accepted" | "rejected";
  };
  librarySuggestion?: {
    app: "books" | "photos" | "tv";
    itemId: string;
    title: string;
    operation: "add" | "remove";
    reason: string;
    status?: "pending" | "accepted" | "rejected" | "failed";
  };
};
