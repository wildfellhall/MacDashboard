import { DASHBOARD_APPS, validateDashboardActions } from "./validation.js";

const APP_LABELS = {
  books: "Books",
  photos: "Photos",
  notes: "Notes",
  tv: "TV",
  messages: "Messages",
  dictionary: "Dictionary",
};

const latestUserMessage = (messages) =>
  [...messages].reverse().find((message) => message.role === "user")?.content ??
  "";

const requestedApp = (text) => {
  const normalized = text.toLowerCase();
  const aliases = {
    books: /\b(book|books|read|reading)\b/,
    photos: /\b(photo|photos|image|images|picture|pictures)\b/,
    notes: /\b(note|notes|preference|preferences)\b/,
    tv: /\b(tv|television|movie|movies|series|watch|watching)\b/,
    messages: /\b(message|messages|chat)\b/,
    dictionary: /\b(dictionary|vocabulary|word|words|definition|define)\b/,
  };
  return DASHBOARD_APPS.find((app) => aliases[app].test(normalized));
};

const preferencesNote = (notes) =>
  notes.find((note) => note.title.trim().toLowerCase() === "preferences");

const explicitPreference = (text) => {
  const normalized = text.trim();
  const positive = normalized.match(
    /\b(?:i like|i love|i enjoy|i prefer)\s+(.+)/i,
  );
  if (positive) return `Interests: ${positive[1].slice(0, 460)}`;
  const negative = normalized.match(
    /\b(?:i dislike|i hate|please avoid)\s+(.+)/i,
  );
  return negative ? `Avoid: ${negative[1].slice(0, 470)}` : null;
};

const requestedNoteCreation = (text) => {
  const titled = text.match(
    /\b(?:create|make|start)\s+(?:a\s+)?note\s+(?:called|titled)\s+["“]?([^"”:]{1,120})["”]?\s*:\s*(.{1,5000})$/i,
  );
  if (titled) {
    return {
      title: titled[1].trim(),
      folder: "Ideas",
      content: titled[2].trim(),
    };
  }
  const about = text.match(
    /\b(?:create|make|start)\s+(?:a\s+)?note\s+about\s+(.{1,5000})$/i,
  );
  if (!about) return null;
  const content = about[1].trim();
  const title = content
    .replace(/[.!?].*$/s, "")
    .split(/\s+/)
    .slice(0, 8)
    .join(" ");
  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    folder: "Ideas",
    content,
  };
};

const requestedView = (app, text) => {
  const normalized = text.toLowerCase();
  if (app === "books") {
    if (/\b(reread|return to|read again)\b/.test(normalized)) return "reread";
    if (/\b(want to read|saved books?|reading list)\b/.test(normalized)) {
      return "saved";
    }
  }
  if (app === "photos") {
    if (/\b(favorites?|favourites?|liked photos?)\b/.test(normalized)) {
      return "liked";
    }
    if (/\b(all photos?|all discoveries)\b/.test(normalized)) return "all";
  }
  if (app === "tv") {
    if (/\b(rewatch|watch again)\b/.test(normalized)) return "rewatch";
    if (/\b(up next|watchlist|saved shows?)\b/.test(normalized)) {
      return "upNext";
    }
  }
  return null;
};

const requestedLibraryOperation = (app, text) => {
  const normalized = text.toLowerCase();
  const remove = /\b(remove|unsave|unlike|unfavorite|unfavourite)\b/.test(
    normalized,
  );
  if (app === "books") {
    if (
      remove ||
      /\b(save|want to read|reading list)\b/.test(normalized)
    ) {
      return remove ? "remove" : "add";
    }
  }
  if (app === "photos") {
    if (
      remove ||
      /\b(like|favorite|favourite)\b/.test(normalized)
    ) {
      return remove ? "remove" : "add";
    }
  }
  if (app === "tv") {
    if (
      remove ||
      /\b(save|up next|watchlist)\b/.test(normalized)
    ) {
      return remove ? "remove" : "add";
    }
  }
  return null;
};

export const createLocalFallback = (
  payload,
  {
    configured = false,
    fallbackReason = configured ? "provider_unavailable" : "not_configured",
    retryable = configured,
  } = {},
) => {
  const text = latestUserMessage(payload.messages);
  const normalized = text.toLowerCase();
  const noteCreation = requestedNoteCreation(text);
  const app = noteCreation ? "notes" : requestedApp(text);
  const actions = [];

  if (app) {
    actions.push({ type: "open_app", app });
    const view = requestedView(app, text);
    if (view) actions.push({ type: "set_app_view", app, view });
  }

  if (normalized.includes("preference")) {
    if (!actions.some((action) => action.type === "open_app")) {
      actions.push({ type: "open_app", app: "notes" });
    }
    const note = preferencesNote(payload.notes);
    if (note) actions.push({ type: "select_note", noteId: note.id });
  }

  const preference = explicitPreference(text);
  if (preference) {
    actions.push({
      type: "update_preferences",
      suggestion: preference,
      reason: "Review this explicit preference before adding it to your profile.",
    });
  }

  if (noteCreation) {
    if (
      !actions.some(
        (action) => action.type === "open_app" && action.app === "notes",
      )
    ) {
      actions.push({ type: "open_app", app: "notes" });
    }
    actions.push({
      type: "propose_note_create",
      ...noteCreation,
      reason: "Review this new local note before it is created.",
    });
  }

  const matchingItem =
    payload.recommendations?.find((item) =>
      normalized.includes(item.title.toLowerCase()),
    ) ??
    (/\b(this|it)\b/.test(normalized)
      ? payload.recommendations?.find(
          (item) =>
            item.appId === payload.activeSelection?.appId &&
            item.itemId === payload.activeSelection?.itemId,
        )
      : undefined);
  if (matchingItem) {
    if (
      !actions.some(
        (action) =>
          action.type === "open_app" && action.app === matchingItem.appId,
      )
    ) {
      actions.push({ type: "open_app", app: matchingItem.appId });
    }
    const operation = requestedLibraryOperation(
      matchingItem.appId,
      text,
    );
    if (operation) {
      actions.push({
        type: "update_library",
        app: matchingItem.appId,
        itemId: matchingItem.itemId,
        operation,
        reason: `Review this ${operation === "add" ? "addition" : "removal"} before changing your local library.`,
      });
    }
    actions.push({
      type: "select_item",
      app: matchingItem.appId,
      itemId: matchingItem.itemId,
    });
  }
  const effectiveApp = app ?? matchingItem?.appId;

  let message;
  if (!text.trim()) {
    message = "I’m ready whenever you are.";
  } else if (preference) {
    message =
      "I can suggest adding that to your Preferences note. Please review it before anything is saved.";
  } else if (normalized.includes("preference")) {
    message =
      "I can open Notes and select your Preferences note. Your profile stays local while rich AI personalization is offline.";
  } else if (noteCreation) {
    message =
      "I prepared a new note for review using the exact details in your request. Nothing will be created until you approve it.";
  } else if (
    matchingItem &&
    requestedLibraryOperation(matchingItem.appId, text)
  ) {
    message =
      "I prepared that library change for review. Nothing will change until you approve it.";
  } else if (effectiveApp) {
    const noteContext = payload.relevantNotes?.length
      ? ` I also matched ${payload.relevantNotes
          .map((note) => `“${note.title}”`)
          .join(" and ")} locally.`
      : payload.tasteDossier?.evidenceCount
        ? ` The local taste dossier still has ${payload.tasteDossier.evidenceCount} preference passages from ${payload.tasteDossier.evidenceNoteCount} current Notes.`
      : "";
    message = `I can open ${APP_LABELS[effectiveApp]} for you.${noteContext} Rich AI personalization is temporarily offline, but your local dashboard data remains available.`;
  } else if (payload.relevantNotes?.length) {
    message = `I found relevant local context in ${payload.relevantNotes
      .map((note) => `“${note.title}”`)
      .join(" and ")}, but rich AI analysis is temporarily offline.`;
  } else {
    const interests = payload.profile.interests.slice(0, 2);
    const context = payload.tasteDossier?.evidenceCount
      ? ` The local dossier still has ${payload.tasteDossier.evidenceCount} preference passages from ${payload.tasteDossier.evidenceNoteCount} current Notes.`
      : interests.length
      ? ` I still have your local interests in ${interests.join(" and ")} available.`
      : "";
    message = `I’m in local mode because the AI service is not configured or is temporarily unavailable.${context}`;
  }

  return {
    message,
    actions: validateDashboardActions(
      actions,
      payload.notes,
      payload.recommendations,
    ),
    provider: "local",
    configured,
    fallbackReason,
    retryable,
  };
};
