import {
  ChevronRight,
  FileUp,
  ImagePlus,
  Info,
  Laugh,
  MessageCircle,
  NotebookTabs,
  Plus,
  Search,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AssistantConfig } from "../lib/assistantClient";
import {
  analyzeChatExport,
  type LocalChatSignals,
} from "../lib/localChatSignals";
import type { Message, PersonalizationSnapshot } from "../types";

type MessageAttachment = NonNullable<Message["attachment"]>;

type Props = {
  messages: Message[];
  assistantConfig: AssistantConfig;
  isResponding: boolean;
  onChangeMessages: (messages: Message[]) => void;
  onSendMessage: (
    body: string,
    attachment?: MessageAttachment,
  ) => Promise<void>;
  onOpenPreferences: () => void;
  onAcceptPreference: (messageId: string) => void;
  onRejectPreference: (messageId: string) => void;
  onAcceptNote: (messageId: string) => void;
  onRejectNote: (messageId: string) => void;
  onAcceptNoteCreation: (messageId: string) => void;
  onRejectNoteCreation: (messageId: string) => void;
  onAcceptNoteAccess: (messageId: string) => void;
  onRejectNoteAccess: (messageId: string) => void;
  onAcceptLibrary: (messageId: string) => void;
  onRejectLibrary: (messageId: string) => void;
  personalization: PersonalizationSnapshot;
  onResetPersonalization: () => void;
  localChatSignals: LocalChatSignals | null;
  onChangeLocalChatSignals: (signals: LocalChatSignals | null) => void;
  onResetCodexConversation: () => Promise<void>;
};

const time = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

const QUICK_PROMPTS = [
  "What should I read next?",
  "Find something to watch tonight",
  "Open my Preferences",
];
const TAPBACKS = [
  { value: "❤️", label: "heart" },
  { value: "👍", label: "thumbs up" },
  { value: "👎", label: "thumbs down" },
  { value: "😂", label: "laugh" },
  { value: "‼️", label: "emphasize" },
  { value: "❓", label: "question" },
] as const;
const EMOJIS = ["😊", "😂", "❤️", "✨", "👍", "🎉", "🤔", "📚", "🎬", "🌿"];
const ALLOWED_IMAGE_TYPES = new Set<MessageAttachment["mimeType"]>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_IMAGE_BYTES = 2_000_000;
const LIBRARY_NAMES = {
  books: "Want to Read",
  photos: "Favorites",
  tv: "Up Next",
} as const;

const readDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Image could not be read."));
    reader.onerror = () => reject(new Error("Image could not be read."));
    reader.readAsDataURL(file);
  });

const fallbackLabel = (reason?: string) => {
  switch (reason) {
    case "authentication_failed":
      return "The configured agent login was rejected";
    case "rate_limited":
      return "The configured agent is rate-limited";
    case "timeout":
      return "The configured agent timed out";
    case "refused":
      return "The request was declined";
    case "incomplete":
      return "The response was incomplete";
    case "invalid_response":
      return "OpenAI returned an invalid response";
    case "request_rejected":
      return "The request was rejected";
    case "service_unavailable":
      return "The local AI service is unavailable";
    case "provider_failed":
    case "provider_unavailable":
      return "The configured agent is temporarily unavailable";
    default:
      return "A generative agent is not configured";
  }
};

export function MessagesApp({
  messages,
  assistantConfig,
  isResponding,
  onChangeMessages,
  onSendMessage,
  onOpenPreferences,
  onAcceptPreference,
  onRejectPreference,
  onAcceptNote,
  onRejectNote,
  onAcceptNoteCreation,
  onRejectNoteCreation,
  onAcceptNoteAccess,
  onRejectNoteAccess,
  onAcceptLibrary,
  onRejectLibrary,
  personalization,
  onResetPersonalization,
  localChatSignals,
  onChangeLocalChatSignals,
  onResetCodexConversation,
}: Props) {
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [attachment, setAttachment] = useState<MessageAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [reactionForId, setReactionForId] = useState<string | null>(null);
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [confirmSignalReset, setConfirmSignalReset] = useState(false);
  const [chatImportStatus, setChatImportStatus] = useState("");
  const [isImportingChat, setIsImportingChat] = useState(false);
  const [confirmChatForget, setConfirmChatForget] = useState(false);
  const [confirmCodexReset, setConfirmCodexReset] = useState(false);
  const [codexResetStatus, setCodexResetStatus] = useState("");
  const [isResettingCodex, setIsResettingCodex] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatImportRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const assistantName =
    assistantConfig.provider === "codex" ? "Codex" : "Dashboard";

  const filteredMessages = useMemo(
    () =>
      filter.trim()
        ? messages.filter((message) =>
            message.body.toLowerCase().includes(filter.trim().toLowerCase()),
          )
        : messages,
    [filter, messages],
  );

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    if (typeof scrollElement.scrollTo === "function") {
      scrollElement.scrollTo({
        top: scrollElement.scrollHeight,
        behavior: "smooth",
      });
    } else {
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  }, [isResponding, messages]);

  useEffect(() => {
    const closePopovers = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setReactionForId(null);
      setDeleteMessageId(null);
      setShowEmojiPicker(false);
    };
    window.addEventListener("keydown", closePopovers);
    return () => window.removeEventListener("keydown", closePopovers);
  }, []);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if ((!body && !attachment) || isResponding) return;
    setDraft("");
    const selectedAttachment = attachment ?? undefined;
    setAttachment(null);
    setAttachmentError("");
    await onSendMessage(body || "Sent an image.", selectedAttachment);
  };

  const setReaction = (id: string, reaction: string) => {
    onChangeMessages(
      messages.map((message) =>
        message.id === id
          ? {
              ...message,
              reaction: message.reaction === reaction ? undefined : reaction,
            }
          : message,
      ),
    );
    setReactionForId(null);
  };

  const deleteMessage = (id: string) => {
    onChangeMessages(messages.filter((message) => message.id !== id));
    setReactionForId(null);
    setDeleteMessageId(null);
  };

  const providerName =
    assistantConfig.provider === "codex"
      ? "Codex"
      : assistantConfig.provider === "openai"
        ? "OpenAI"
        : "Local";
  const providerLabel =
    assistantConfig.status === "connected"
      ? `${providerName} connected`
      : assistantConfig.status === "configured"
        ? `${providerName} ready`
        : assistantConfig.status === "fallback"
          ? "Local fallback"
          : "Local mode";
  const codexThreadLabel = assistantConfig.codexThreadPersistent
    ? "Persistent Codex thread"
    : "Codex thread";
  const codexThreadDetail = assistantConfig.codexThreadId
    ? `Thread …${assistantConfig.codexThreadId.slice(-8)}`
    : "A new thread begins with your next message";

  const importChatSignals = async (file?: File) => {
    if (!file) return;
    setIsImportingChat(true);
    setChatImportStatus(`Analyzing ${file.name} locally…`);
    try {
      const signals = analyzeChatExport(await file.text(), file.name);
      onChangeLocalChatSignals(signals);
      setChatImportStatus(
        `Learned ${signals.topics.length} aggregate ${
          signals.topics.length === 1 ? "topic" : "topics"
        } from ${signals.messageCount} messages. No message text or names were stored or uploaded.`,
      );
    } catch (error) {
      setChatImportStatus(
        error instanceof Error ? error.message : "Chat import failed.",
      );
    } finally {
      setIsImportingChat(false);
      if (chatImportRef.current) chatImportRef.current.value = "";
    }
  };

  const startNewCodexConversation = async () => {
    if (isResettingCodex || isResponding) return;
    setIsResettingCodex(true);
    setCodexResetStatus("Starting a new Codex conversation…");
    try {
      await onResetCodexConversation();
      setFilter("");
      setDraft("");
      setAttachment(null);
      setAttachmentError("");
      setReactionForId(null);
      setShowEmojiPicker(false);
      setConfirmCodexReset(false);
      setCodexResetStatus("New Codex conversation ready.");
      draftRef.current?.focus();
    } catch {
      setCodexResetStatus(
        "Could not reset the Codex conversation. This thread is unchanged.",
      );
    } finally {
      setIsResettingCodex(false);
    }
  };

  return (
    <div className="messages-app">
      <aside className="messages-sidebar">
        <div className="messages-sidebar-tools">
          <label className="search-field">
            <Search size={14} />
            <input
              placeholder="Search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="Search messages"
            />
          </label>
          <button
            className="round-button"
            type="button"
            aria-label="New message"
            onClick={() => {
              setFilter("");
              draftRef.current?.focus();
            }}
          >
            <Plus size={17} />
          </button>
        </div>
        <button className="conversation is-selected" type="button">
          <span className="assistant-avatar">
            <Sparkles size={22} />
          </span>
          <span className="conversation-copy">
            <strong>{assistantName}</strong>
            <span>
              {filter
                ? `${filteredMessages.length} matching messages`
                : messages.at(-1)?.body.slice(0, 42)}
            </span>
          </span>
          <time>now</time>
        </button>
        <div className="messages-personalization">
          <ShieldCheck size={14} />
          <div>
            <strong>Preferences connected</strong>
            <span>Actions stay inside this dashboard.</span>
          </div>
        </div>
      </aside>

      <main className="message-thread">
        <header className="thread-header">
          <span className="assistant-avatar assistant-avatar--small">
            <Sparkles size={16} />
          </span>
          <div>
            <strong>{assistantName}</strong>
            <span
              className="assistant-presence"
              role="status"
              aria-label={`Assistant status: ${providerLabel}`}
            >
              <i
                className={`presence-dot presence-dot--${assistantConfig.provider}`}
              />
              {providerLabel}
              {assistantConfig.provider === "openai" &&
                assistantConfig.model && (
                  <small className="assistant-model-label">
                    {assistantConfig.model}
                  </small>
                )}
            </span>
          </div>
          <button
            type="button"
            aria-label="Conversation info"
            aria-expanded={showInfo}
            onClick={() => setShowInfo((value) => !value)}
          >
            <Info size={19} />
          </button>
        </header>

        {assistantConfig.provider === "codex" && (
          <div
            className="codex-thread-disclosure"
            role="note"
            aria-label="Codex conversation persistence"
          >
            <ShieldCheck size={14} />
            <span>
              <strong>{codexThreadLabel}</strong>
              <small>
                {assistantConfig.codexThreadPersistent
                  ? "Conversation context continues across dashboard restarts."
                  : "Conversation context stays in this thread."}{" "}
                {codexThreadDetail}.
              </small>
            </span>
            <button type="button" onClick={() => setShowInfo(true)}>
              Manage
            </button>
          </div>
        )}

        {showInfo && (
          <aside className="assistant-info-panel">
            <div className="assistant-info-heading">
              <span className="assistant-avatar assistant-avatar--small">
                <Sparkles size={15} />
              </span>
              <div>
                <strong>
                  {assistantConfig.provider === "codex"
                    ? "Codex agent"
                    : "Dashboard AI"}
                </strong>
                <span>{providerLabel}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                aria-label="Close assistant info"
              >
                <X size={15} />
              </button>
            </div>
            <div className="assistant-info-row">
              {assistantConfig.status === "connected" ||
              assistantConfig.status === "configured" ? (
                <Wifi size={15} />
              ) : (
                <WifiOff size={15} />
              )}
              <div>
                <strong>
                  {assistantConfig.status === "connected"
                    ? `${providerName} connected`
                    : assistantConfig.status === "configured"
                      ? `${providerName} ready`
                      : assistantConfig.status === "fallback"
                        ? "AI unavailable · local fallback active"
                        : "Deterministic local mode"}
                </strong>
                <span>
                  {assistantConfig.status === "connected"
                    ? assistantConfig.provider === "codex"
                      ? "Messages are continuing a persistent Codex thread through the authenticated local Codex CLI."
                      : "Messages use the server-side OpenAI connection."
                    : assistantConfig.status === "configured"
                      ? assistantConfig.provider === "codex"
                        ? "The existing ChatGPT-authenticated Codex session is ready; the first successful turn will confirm connectivity."
                        : "The key is present; the first successful response will confirm connectivity."
                      : assistantConfig.status === "fallback"
                        ? `${fallbackLabel(assistantConfig.fallbackReason)}. Dashboard actions still use the local fallback.`
                        : assistantConfig.fallbackReason ===
                            "service_unavailable"
                          ? "Start the local assistant service to reconnect Messages."
                          : "Sign in to Codex or configure an OpenAI provider to enable generative replies."}
                </span>
              </div>
            </div>
            <div className="assistant-info-row">
              <ShieldCheck size={15} />
              <div>
                <strong>Local-first controls</strong>
                <span>
                  {assistantConfig.provider === "codex"
                    ? `Codex uses your existing ChatGPT login in a persistent local thread with a ${assistantConfig.codexSandbox ?? "read-only"} sandbox and network access disabled. `
                    : "The API key stays on the local server and Responses API object storage is disabled with store:false. "}
                  The current request receives recommendation candidates,
                  review metadata, optional aggregate photo/chat signals, and
                  a bounded taste dossier rebuilt from every Note that exists
                  now. The dossier supplies exact preference-bearing passages,
                  polarity, strength, concepts, and source Note titles; direct
                  queries may add four more locally retrieved excerpts. Full
                  note text still requires Ask or one-request consent. Images
                  are supplied only after explicit selection or note-sharing
                  consent.
                </span>
                {assistantConfig.provider === "codex" && (
                  <>
                    <span>
                      Thread:{" "}
                      {assistantConfig.codexThreadId
                        ? `…${assistantConfig.codexThreadId.slice(-8)}`
                        : "created on first message"}
                    </span>
                    {codexResetStatus && (
                      <span role="status">{codexResetStatus}</span>
                    )}
                    {confirmCodexReset ? (
                      <>
                        <span className="codex-reset-warning" role="alert">
                          This clears the displayed Messages history and starts a
                          separate Codex thread. Preferences, Notes,
                          recommendations, and learned taste signals stay intact.
                        </span>
                        <span className="assistant-info-actions">
                          <button
                            type="button"
                            disabled={isResettingCodex || isResponding}
                            onClick={() => void startNewCodexConversation()}
                          >
                            {isResettingCodex
                              ? "Starting…"
                              : "Confirm New Conversation"}
                          </button>
                          <button
                            type="button"
                            disabled={isResettingCodex}
                            onClick={() => {
                              setConfirmCodexReset(false);
                              setCodexResetStatus("");
                            }}
                          >
                            Keep This Thread
                          </button>
                        </span>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="assistant-info-reset"
                        disabled={isResponding}
                        onClick={() => {
                          setCodexResetStatus("");
                          setConfirmCodexReset(true);
                        }}
                      >
                        New Codex Conversation
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="assistant-info-row assistant-info-row--signals">
              <Sparkles size={15} />
              <div>
                <strong>
                  {personalization.eventCount} learned taste{" "}
                  {personalization.eventCount === 1 ? "signal" : "signals"}
                </strong>
                <span>
                  Likes:{" "}
                  {personalization.learnedLikes.slice(0, 5).join(", ") ||
                    "none yet"}
                  . Avoids:{" "}
                  {personalization.learnedAvoids.slice(0, 5).join(", ") ||
                    "none yet"}
                  .
                </span>
                {personalization.eventCount > 0 &&
                  (confirmSignalReset ? (
                    <span className="assistant-info-actions">
                      <button
                        type="button"
                        onClick={() => {
                          onResetPersonalization();
                          setConfirmSignalReset(false);
                        }}
                      >
                        Confirm Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmSignalReset(false)}
                      >
                        Keep Signals
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="assistant-info-reset"
                      onClick={() => setConfirmSignalReset(true)}
                    >
                      Reset Learned Signals
                    </button>
                  ))}
              </div>
            </div>
            <div className="assistant-info-row assistant-info-row--signals">
              <MessageCircle size={15} />
              <div>
                <strong>Local chat topics</strong>
                <span>
                  {localChatSignals
                    ? `${localChatSignals.messageCount} messages analyzed · ${localChatSignals.topics
                        .slice(0, 5)
                        .map((topic) => topic.label)
                        .join(", ")}.`
                    : "Optionally select a TXT, CSV, or JSON chat export. Only fixed aggregate interest topics persist."}
                </span>
                {chatImportStatus && (
                  <span role="status">{chatImportStatus}</span>
                )}
                <input
                  ref={chatImportRef}
                  type="file"
                  accept=".txt,.csv,.json,text/plain,text/csv,application/json"
                  hidden
                  aria-label="Choose a chat export to analyze privately"
                  onChange={(event) =>
                    void importChatSignals(event.target.files?.[0])
                  }
                />
                <span className="assistant-info-actions">
                  <button
                    type="button"
                    onClick={() => chatImportRef.current?.click()}
                    disabled={isImportingChat}
                  >
                    <FileUp size={12} />
                    {isImportingChat
                      ? "Analyzing…"
                      : localChatSignals
                        ? "Replace Chat Signals"
                        : "Choose Chat Export"}
                  </button>
                  {localChatSignals &&
                    (confirmChatForget ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onChangeLocalChatSignals(null);
                            setConfirmChatForget(false);
                            setChatImportStatus(
                              "Aggregate chat topics were forgotten.",
                            );
                          }}
                        >
                          Confirm Forget
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmChatForget(false)}
                        >
                          Keep Topics
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmChatForget(true)}
                      >
                        Forget Topics
                      </button>
                    ))}
                </span>
              </div>
            </div>
          </aside>
        )}

        <div className="message-scroll" ref={scrollRef}>
          <div className="message-day">Today</div>
          {filteredMessages.map((message) => (
            <div
              className={`message-line message-line--${message.sender}`}
              key={message.id}
            >
              {message.sender === "assistant" && (
                <span className="assistant-avatar assistant-avatar--tiny">
                  <Sparkles size={12} />
                </span>
              )}
              <div className="message-bubble-wrap">
                <button
                  type="button"
                  className="message-bubble"
                  onDoubleClick={() => {
                    setDeleteMessageId(null);
                    setReactionForId((current) =>
                      current === message.id ? null : message.id,
                    );
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setDeleteMessageId(null);
                    setReactionForId(message.id);
                  }}
                  aria-label={`${message.sender === "assistant" ? assistantName : "You"}: ${message.body}. Double-click or use the context menu to react or delete.`}
                  title="Double-click or right-click for message actions"
                >
                  {message.attachment?.dataUrl && (
                    <img
                      className="message-image"
                      src={message.attachment.dataUrl}
                      alt={message.attachment.name}
                    />
                  )}
                  <span>{message.body}</span>
                </button>
                {message.sender === "assistant" &&
                  message.noteContext?.length && (
                    <div
                      className="message-note-context"
                      aria-label={`Relevant Notes used: ${message.noteContext
                        .map((note) => note.title)
                        .join(", ")}`}
                    >
                      <NotebookTabs size={11} />
                      <span>
                        Used{" "}
                        {message.noteContext
                          .map((note) => `“${note.title}”`)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                {reactionForId === message.id && (
                  <div
                    className={`tapback-picker ${
                      deleteMessageId === message.id
                        ? "is-delete-confirmation"
                        : ""
                    }`}
                    role={
                      deleteMessageId === message.id ? "alertdialog" : "menu"
                    }
                    aria-label={
                      deleteMessageId === message.id
                        ? "Delete this message?"
                        : "Message actions"
                    }
                  >
                    {deleteMessageId === message.id ? (
                      <div className="message-delete-confirmation">
                        <span>Delete this message?</span>
                        <button
                          type="button"
                          className="is-destructive"
                          onClick={() => deleteMessage(message.id)}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteMessageId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        {TAPBACKS.map((tapback) => (
                          <button
                            type="button"
                            role="menuitem"
                            key={tapback.value}
                            className={
                              message.reaction === tapback.value
                                ? "is-selected"
                                : ""
                            }
                            aria-label={`${message.reaction === tapback.value ? "Remove" : "Add"} ${tapback.label} reaction`}
                            onClick={() =>
                              setReaction(message.id, tapback.value)
                            }
                          >
                            {tapback.value}
                          </button>
                        ))}
                        <span className="tapback-divider" aria-hidden="true" />
                        <button
                          type="button"
                          role="menuitem"
                          className="tapback-delete"
                          aria-label="Delete message"
                          onClick={() => setDeleteMessageId(message.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                )}
                {message.preferenceSuggestion && (
                  <div className="preference-suggestion-card">
                    <span>
                      {message.preferenceSuggestion.status === "accepted"
                        ? "Added to Preferences"
                        : message.preferenceSuggestion.status === "rejected"
                          ? "Suggestion dismissed"
                          : "Suggested preference"}
                    </span>
                    <strong>{message.preferenceSuggestion.text}</strong>
                    <p>{message.preferenceSuggestion.reason}</p>
                    <div className="preference-suggestion-actions">
                      {!message.preferenceSuggestion.status ||
                      message.preferenceSuggestion.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onAcceptPreference(message.id)}
                          >
                            Add to Preferences
                          </button>
                          <button
                            type="button"
                            onClick={() => onRejectPreference(message.id)}
                          >
                            Not now
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={onOpenPreferences}>
                          Open Preferences <ChevronRight size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {message.noteSuggestion && (
                  <div className="preference-suggestion-card note-suggestion-card">
                    <span>
                      {message.noteSuggestion.status === "accepted"
                        ? "Applied to Notes"
                        : message.noteSuggestion.status === "rejected"
                          ? "Edit dismissed"
                          : `${message.noteSuggestion.mode === "replace" ? "Replace" : "Append to"} note`}
                    </span>
                    <strong>{message.noteSuggestion.content}</strong>
                    <p>{message.noteSuggestion.reason}</p>
                    {(!message.noteSuggestion.status ||
                      message.noteSuggestion.status === "pending") && (
                      <div className="preference-suggestion-actions">
                        <button
                          type="button"
                          onClick={() => onAcceptNote(message.id)}
                        >
                          {message.noteSuggestion.mode === "replace"
                            ? "Replace Note"
                            : "Add to Note"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRejectNote(message.id)}
                        >
                          Not now
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {message.noteCreationSuggestion && (
                  <div className="preference-suggestion-card note-suggestion-card">
                    <span>
                      {message.noteCreationSuggestion.status === "accepted"
                        ? "Created in Notes"
                        : message.noteCreationSuggestion.status === "rejected"
                          ? "New note dismissed"
                          : `New ${message.noteCreationSuggestion.folder} note`}
                    </span>
                    <strong>{message.noteCreationSuggestion.title}</strong>
                    <p>{message.noteCreationSuggestion.content}</p>
                    <p>{message.noteCreationSuggestion.reason}</p>
                    {(!message.noteCreationSuggestion.status ||
                      message.noteCreationSuggestion.status === "pending") && (
                      <div className="preference-suggestion-actions">
                        <button
                          type="button"
                          onClick={() => onAcceptNoteCreation(message.id)}
                        >
                          Create Note
                        </button>
                        <button
                          type="button"
                          onClick={() => onRejectNoteCreation(message.id)}
                        >
                          Not now
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {message.noteAccessSuggestion && (
                  <div className="preference-suggestion-card note-access-card">
                    <span>
                      {message.noteAccessSuggestion.status === "accepted"
                        ? "Shared for one request"
                        : message.noteAccessSuggestion.status === "rejected"
                          ? "Note stayed private"
                          : "Permission required"}
                    </span>
                    <strong>{message.noteAccessSuggestion.noteTitle}</strong>
                    <p>
                      {message.noteAccessSuggestion.status === "accepted"
                        ? `Up to 3,000 characters${
                            message.noteAccessSuggestion.hasSketch
                              ? " and one locally rendered sketch"
                              : ""
                          } were included only in the approved assistant request.`
                        : message.noteAccessSuggestion.status === "rejected"
                          ? "No note contents were sent."
                          : `Share up to 3,000 characters${
                              message.noteAccessSuggestion.hasSketch
                                ? " and its locally rendered sketch"
                                : ""
                            } with the configured assistant for this request only?`}
                    </p>
                    {(!message.noteAccessSuggestion.status ||
                      message.noteAccessSuggestion.status === "pending") && (
                      <div className="preference-suggestion-actions">
                        <button
                          type="button"
                          onClick={() => onAcceptNoteAccess(message.id)}
                        >
                          Share Note Once
                        </button>
                        <button
                          type="button"
                          onClick={() => onRejectNoteAccess(message.id)}
                        >
                          Keep Private
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {message.librarySuggestion && (
                  <div className="preference-suggestion-card library-suggestion-card">
                    <span>
                      {message.librarySuggestion.status === "accepted"
                        ? "Library updated"
                        : message.librarySuggestion.status === "rejected"
                          ? "Change dismissed"
                          : message.librarySuggestion.status === "failed"
                            ? "Could not save locally"
                            : "Review library change"}
                    </span>
                    <strong>
                      {message.librarySuggestion.operation === "add"
                        ? "Add"
                        : "Remove"}{" "}
                      “{message.librarySuggestion.title}”{" "}
                      {message.librarySuggestion.operation === "add"
                        ? "to"
                        : "from"}{" "}
                      {LIBRARY_NAMES[message.librarySuggestion.app]}
                    </strong>
                    <p>{message.librarySuggestion.reason}</p>
                    {(!message.librarySuggestion.status ||
                      message.librarySuggestion.status === "pending") && (
                      <div className="preference-suggestion-actions">
                        <button
                          type="button"
                          onClick={() => onAcceptLibrary(message.id)}
                        >
                          Confirm Change
                        </button>
                        <button
                          type="button"
                          onClick={() => onRejectLibrary(message.id)}
                        >
                          Not now
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {message.reaction && (
                  <span className="message-reaction">{message.reaction}</span>
                )}
                <time>
                  {time(message.timestamp)}
                  {message.sender === "assistant" && message.provider && (
                    <>
                      {" "}
                      ·{" "}
                      {message.provider === "codex"
                        ? "Codex"
                        : message.provider === "openai"
                          ? "AI"
                          : "Local"}
                      {message.fallbackReason &&
                        ` · ${fallbackLabel(message.fallbackReason)}`}
                    </>
                  )}
                </time>
              </div>
            </div>
          ))}

          {!filter && messages.length <= 1 && (
            <div className="quick-prompt-row" aria-label="Suggested requests">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  type="button"
                  key={prompt}
                  onClick={() => setDraft(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {isResponding && (
            <div className="message-line message-line--assistant">
              <span className="assistant-avatar assistant-avatar--tiny">
                <Sparkles size={12} />
              </span>
              <div
                className="typing-bubble"
                aria-label={`${assistantName} is responding`}
              >
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
        </div>

        <form className="message-composer" onSubmit={send}>
          {showEmojiPicker && (
            <div
              className="emoji-picker"
              role="menu"
              aria-label="Choose an emoji"
            >
              {EMOJIS.map((emoji) => (
                <button
                  type="button"
                  role="menuitem"
                  key={emoji}
                  aria-label={`Insert ${emoji}`}
                  onClick={() => {
                    setDraft((value) => `${value}${value ? " " : ""}${emoji}`);
                    setShowEmojiPicker(false);
                    draftRef.current?.focus();
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (
                !ALLOWED_IMAGE_TYPES.has(
                  file.type as MessageAttachment["mimeType"],
                )
              ) {
                setAttachmentError(
                  "Choose a JPEG, PNG, WebP, or GIF image.",
                );
                return;
              }
              if (file.size > MAX_IMAGE_BYTES) {
                setAttachmentError("Choose an image smaller than 2 MB.");
                return;
              }
              setAttachmentError("");
              void readDataUrl(file)
                .then((dataUrl) =>
                  setAttachment({
                    id: crypto.randomUUID(),
                    name: file.name.slice(0, 160),
                    mimeType: file.type as MessageAttachment["mimeType"],
                    size: file.size,
                    dataUrl,
                  }),
                )
                .catch((error: unknown) =>
                  setAttachmentError(
                    error instanceof Error
                      ? error.message
                      : "Image could not be read.",
                  ),
                );
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach image"
            title="Select an image to reference"
          >
            <ImagePlus size={18} />
          </button>
          <button
            type="button"
            aria-expanded={showEmojiPicker}
            onClick={() => setShowEmojiPicker((open) => !open)}
            aria-label="Add emoji"
          >
            <Laugh size={18} />
          </button>
          <input
            ref={draftRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              isResponding
                ? `${assistantName} is replying…`
                : `Message ${assistantName}`
            }
            aria-label="Message"
            disabled={isResponding}
          />
          <button
            type="submit"
            className="send-button"
            disabled={(!draft.trim() && !attachment) || isResponding}
            aria-label="Send message"
          >
            <SendHorizontal size={15} />
          </button>
          {(attachment || attachmentError) && (
            <div
              className={`composer-attachment ${
                attachmentError ? "has-error" : ""
              }`}
              role={attachmentError ? "alert" : "status"}
            >
              {attachment?.dataUrl && (
                <img src={attachment.dataUrl} alt="" />
              )}
              <span>
                {attachmentError ||
                  `${attachment?.name} · ${Math.ceil(
                    (attachment?.size ?? 0) / 1024,
                  )} KB`}
              </span>
              {attachment && (
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  aria-label="Remove attached image"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
