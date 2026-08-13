export const DASHBOARD_APPS = [
  "books",
  "photos",
  "notes",
  "tv",
  "messages",
  "dictionary",
];
export const APP_VIEWS = {
  books: ["discover", "reread", "saved"],
  photos: ["recommended", "all", "liked", "disliked"],
  tv: ["discover", "rewatch", "upNext"],
};
const SEARCHABLE_APPS = new Set(["books", "photos", "notes", "tv"]);

export const LIMITS = Object.freeze({
  messages: 12,
  messageCharacters: 4_000,
  totalMessageCharacters: 20_000,
  imageNameCharacters: 160,
  imageBytes: 2_000_000,
  profileItems: 30,
  profileItemCharacters: 200,
  notes: 50,
  noteIdCharacters: 120,
  noteTitleCharacters: 240,
  noteFolderCharacters: 120,
  relevantNotes: 4,
  relevantNoteExcerptCharacters: 600,
  relevantNoteMatchedTerms: 10,
  relevantNoteMatchedTermCharacters: 80,
  tasteDossierEvidence: 80,
  tasteDossierPassageCharacters: 360,
  tasteDossierConcepts: 20,
  tasteDossierConceptCharacters: 80,
  actionCount: 3,
  assistantMessageCharacters: 2_000,
  preferenceSuggestionCharacters: 500,
  preferenceReasonCharacters: 300,
  searchQueryCharacters: 160,
  tasteSignals: 30,
  tasteSignalTitleCharacters: 240,
  tasteSignalTags: 16,
  tasteSignalTagCharacters: 120,
  reviews: 30,
  reviewTitleCharacters: 240,
  bookHistory: 100,
  bookAuthorCharacters: 180,
  localPhotoSignalTags: 16,
  localChatSignalTopics: 12,
  recommendations: 30,
  recommendationItemIdCharacters: 120,
  recommendationTitleCharacters: 240,
  recommendationKindCharacters: 80,
  recommendationDescriptionCharacters: 700,
  recommendationEvidenceCharacters: 600,
  recommendationSourceNotes: 5,
  noteSuggestionCharacters: 5_000,
  noteSuggestionReasonCharacters: 300,
  libraryReasonCharacters: 300,
});

const PROFILE_KEYS = ["interests", "moods", "favorites", "avoid"];
const MESSAGE_ROLES = new Set(["user", "assistant"]);
const APP_SET = new Set(DASHBOARD_APPS);
const FEEDBACK_KINDS = new Set([
  "opened",
  "saved",
  "liked",
  "downloaded",
  "dismissed",
]);
const RECOMMENDATION_APPS = new Set(["books", "photos", "tv"]);
const TASTE_POLARITIES = new Set(["positive", "negative", "curious"]);
const TASTE_DOMAINS = new Set(["general", "books", "tv", "photos"]);
const PREFERENCE_SUGGESTION_LINE_PATTERN =
  /^(?:Interests|Moods|Favorites|Avoid)\s*:\s*\S(?:.*\S)?$/i;
const IMAGE_DATA_PATTERN =
  /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_IMAGE_DIMENSION = 12_000;
const MAX_IMAGE_PIXELS = 40_000_000;

const imageDimensions = (bytes, mimeType) => {
  if (mimeType === "image/png" && bytes.length >= 24) {
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }
  if (mimeType === "image/gif" && bytes.length >= 10) {
    return {
      width: bytes.readUInt16LE(6),
      height: bytes.readUInt16LE(8),
    };
  }
  if (
    mimeType === "image/webp" &&
    bytes.length >= 30 &&
    bytes.toString("ascii", 12, 16) === "VP8X"
  ) {
    return {
      width: 1 + bytes.readUIntLE(24, 3),
      height: 1 + bytes.readUIntLE(27, 3),
    };
  }
  if (mimeType === "image/jpeg") {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        return {
          height: bytes.readUInt16BE(offset + 5),
          width: bytes.readUInt16BE(offset + 7),
        };
      }
      if (offset + 3 >= bytes.length) break;
      const segmentLength = bytes.readUInt16BE(offset + 2);
      if (segmentLength < 2) break;
      offset += segmentLength + 2;
    }
  }
  return null;
};

const hasValidImageBytes = (mimeType, base64) => {
  const bytes = Buffer.from(base64, "base64");
  const validSignature =
    (mimeType === "image/png" &&
      bytes.length >= 24 &&
      bytes.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )) ||
    (mimeType === "image/jpeg" &&
      bytes.length >= 4 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff) ||
    (mimeType === "image/gif" &&
      bytes.length >= 10 &&
      ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) ||
    (mimeType === "image/webp" &&
      bytes.length >= 16 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP");
  if (!validSignature) return false;

  const dimensions = imageDimensions(bytes, mimeType);
  if (!dimensions) return true;
  return (
    dimensions.width > 0 &&
    dimensions.height > 0 &&
    dimensions.width <= MAX_IMAGE_DIMENSION &&
    dimensions.height <= MAX_IMAGE_DIMENSION &&
    dimensions.width * dimensions.height <= MAX_IMAGE_PIXELS
  );
};

const isRecord = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isBoundedString = (value, maximum, { allowEmpty = false } = {}) =>
  typeof value === "string" &&
  value.length <= maximum &&
  (allowEmpty || value.trim().length > 0);

const copyBoundedString = (value, maximum) => value.trim().slice(0, maximum);

const isValidPreferenceSuggestion = (value) => {
  if (typeof value !== "string") return false;
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines.length > 0 &&
    lines.every((line) => PREFERENCE_SUGGESTION_LINE_PATTERN.test(line))
  );
};

export class InputValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputValidationError";
    this.statusCode = 400;
  }
}

const validateMessages = (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new InputValidationError("messages must be a non-empty array.");
  }
  if (messages.length > LIMITS.messages) {
    throw new InputValidationError(
      `messages cannot contain more than ${LIMITS.messages} items.`,
    );
  }

  let totalCharacters = 0;
  const validated = messages.map((message, index) => {
    if (!isRecord(message) || !MESSAGE_ROLES.has(message.role)) {
      throw new InputValidationError(
        `messages[${index}].role must be user or assistant.`,
      );
    }
    if (!isBoundedString(message.content, LIMITS.messageCharacters)) {
      throw new InputValidationError(
        `messages[${index}].content must be a non-empty string of at most ${LIMITS.messageCharacters} characters.`,
      );
    }
    totalCharacters += message.content.length;
    const validatedMessage = {
      role: message.role,
      content: copyBoundedString(message.content, LIMITS.messageCharacters),
    };

    if (message.image !== undefined) {
      if (
        message.role !== "user" ||
        !isRecord(message.image) ||
        !isBoundedString(
          message.image.name,
          LIMITS.imageNameCharacters,
        ) ||
        typeof message.image.dataUrl !== "string"
      ) {
        throw new InputValidationError(
          `messages[${index}].image is invalid.`,
        );
      }
      const match = message.image.dataUrl.match(IMAGE_DATA_PATTERN);
      const estimatedBytes = match
        ? Math.floor((match[2].length * 3) / 4)
        : Number.POSITIVE_INFINITY;
      if (
        !match ||
        match[1] !== message.image.mimeType ||
        estimatedBytes > LIMITS.imageBytes ||
        !hasValidImageBytes(match[1], match[2])
      ) {
        throw new InputValidationError(
          `messages[${index}].image must be a supported image no larger than ${LIMITS.imageBytes} bytes.`,
        );
      }
      validatedMessage.image = {
        name: copyBoundedString(
          message.image.name,
          LIMITS.imageNameCharacters,
        ),
        mimeType: match[1],
        dataUrl: message.image.dataUrl,
      };
    }

    return validatedMessage;
  });

  if (totalCharacters > LIMITS.totalMessageCharacters) {
    throw new InputValidationError(
      `message content cannot exceed ${LIMITS.totalMessageCharacters} total characters.`,
    );
  }

  return validated;
};

export const validateProfile = (profile) => {
  if (!isRecord(profile)) {
    throw new InputValidationError("profile must be an object.");
  }

  return Object.fromEntries(
    PROFILE_KEYS.map((key) => {
      const values = profile[key];
      if (!Array.isArray(values) || values.length > LIMITS.profileItems) {
        throw new InputValidationError(
          `profile.${key} must be an array with at most ${LIMITS.profileItems} items.`,
        );
      }

      const validated = values.map((value, index) => {
        if (!isBoundedString(value, LIMITS.profileItemCharacters)) {
          throw new InputValidationError(
            `profile.${key}[${index}] must be a non-empty string of at most ${LIMITS.profileItemCharacters} characters.`,
          );
        }
        return copyBoundedString(value, LIMITS.profileItemCharacters);
      });

      return [key, validated];
    }),
  );
};

export const validateNotes = (notes) => {
  if (notes === undefined) return [];
  if (!Array.isArray(notes) || notes.length > LIMITS.notes) {
    throw new InputValidationError(
      `notes must be an array with at most ${LIMITS.notes} items.`,
    );
  }

  const seen = new Set();
  return notes.map((note, index) => {
    if (!isRecord(note)) {
      throw new InputValidationError(`notes[${index}] must be an object.`);
    }
    if (!isBoundedString(note.id, LIMITS.noteIdCharacters)) {
      throw new InputValidationError(
        `notes[${index}].id must be a non-empty string of at most ${LIMITS.noteIdCharacters} characters.`,
      );
    }
    if (seen.has(note.id)) {
      throw new InputValidationError(`notes[${index}].id must be unique.`);
    }
    seen.add(note.id);
    if (!isBoundedString(note.title, LIMITS.noteTitleCharacters)) {
      throw new InputValidationError(
        `notes[${index}].title must be a non-empty string of at most ${LIMITS.noteTitleCharacters} characters.`,
      );
    }

    const result = {
      id: copyBoundedString(note.id, LIMITS.noteIdCharacters),
      title: copyBoundedString(note.title, LIMITS.noteTitleCharacters),
    };

    if (note.folder !== undefined) {
      if (
        !isBoundedString(note.folder, LIMITS.noteFolderCharacters, {
          allowEmpty: true,
        })
      ) {
        throw new InputValidationError(
          `notes[${index}].folder must be a string of at most ${LIMITS.noteFolderCharacters} characters.`,
        );
      }
      result.folder = copyBoundedString(
        note.folder,
        LIMITS.noteFolderCharacters,
      );
    }
    if (note.updatedAt !== undefined) {
      if (
        !isBoundedString(note.updatedAt, 80, {
          allowEmpty: true,
        })
      ) {
        throw new InputValidationError(
          `notes[${index}].updatedAt must be a string of at most 80 characters.`,
        );
      }
      result.updatedAt = copyBoundedString(note.updatedAt, 80);
    }
    if (note.pinned !== undefined) {
      if (typeof note.pinned !== "boolean") {
        throw new InputValidationError(
          `notes[${index}].pinned must be a boolean.`,
        );
      }
      result.pinned = note.pinned;
    }
    if (note.hasSketch !== undefined) {
      if (typeof note.hasSketch !== "boolean") {
        throw new InputValidationError(
          `notes[${index}].hasSketch must be a boolean.`,
        );
      }
      result.hasSketch = note.hasSketch;
    }

    return result;
  });
};

const validateRelevantNotes = (relevantNotes, notes) => {
  if (relevantNotes === undefined) return [];
  if (
    !Array.isArray(relevantNotes) ||
    relevantNotes.length > LIMITS.relevantNotes
  ) {
    throw new InputValidationError(
      `relevantNotes must be an array with at most ${LIMITS.relevantNotes} items.`,
    );
  }
  const suppliedNotes = new Map(notes.map((note) => [note.id, note]));
  const seen = new Set();
  return relevantNotes.map((note, index) => {
    if (!isRecord(note)) {
      throw new InputValidationError(
        `relevantNotes[${index}] must be an object.`,
      );
    }
    const supplied = suppliedNotes.get(note.id);
    if (!supplied || seen.has(note.id)) {
      throw new InputValidationError(
        `relevantNotes[${index}].id must reference a unique supplied note.`,
      );
    }
    seen.add(note.id);
    if (
      note.title !== supplied.title ||
      note.folder !== supplied.folder ||
      !isBoundedString(
        note.excerpt,
        LIMITS.relevantNoteExcerptCharacters,
      )
    ) {
      throw new InputValidationError(
        `relevantNotes[${index}] contains invalid note metadata or excerpt.`,
      );
    }
    if (
      !Array.isArray(note.matchedTerms) ||
      note.matchedTerms.length > LIMITS.relevantNoteMatchedTerms
    ) {
      throw new InputValidationError(
        `relevantNotes[${index}].matchedTerms must be a bounded array.`,
      );
    }
    return {
      id: supplied.id,
      title: supplied.title,
      folder: supplied.folder ?? "",
      excerpt: copyBoundedString(
        note.excerpt,
        LIMITS.relevantNoteExcerptCharacters,
      ),
      matchedTerms: note.matchedTerms.map((term, termIndex) => {
        if (
          !isBoundedString(
            term,
            LIMITS.relevantNoteMatchedTermCharacters,
          )
        ) {
          throw new InputValidationError(
            `relevantNotes[${index}].matchedTerms[${termIndex}] is invalid.`,
          );
        }
        return copyBoundedString(
          term,
          LIMITS.relevantNoteMatchedTermCharacters,
        );
      }),
    };
  });
};

export const validateTasteDossier = (dossier, notes) => {
  if (dossier === undefined) {
    return {
      currentNoteCount: notes.length,
      evidenceNoteCount: 0,
      evidenceCount: 0,
      evidence: [],
    };
  }
  if (!isRecord(dossier) || !Array.isArray(dossier.evidence)) {
    throw new InputValidationError("tasteDossier must be an object.");
  }
  if (dossier.evidence.length > LIMITS.tasteDossierEvidence) {
    throw new InputValidationError(
      `tasteDossier.evidence must contain at most ${LIMITS.tasteDossierEvidence} items.`,
    );
  }
  const suppliedNotes = new Map(notes.map((note) => [note.id, note]));
  const evidence = dossier.evidence.map((item, index) => {
    if (!isRecord(item)) {
      throw new InputValidationError(
        `tasteDossier.evidence[${index}] must be an object.`,
      );
    }
    const supplied = suppliedNotes.get(item.noteId);
    if (
      !supplied ||
      item.noteTitle !== supplied.title ||
      item.folder !== supplied.folder ||
      !TASTE_POLARITIES.has(item.polarity) ||
      !Number.isInteger(item.strength) ||
      item.strength < 1 ||
      item.strength > 5 ||
      !isBoundedString(
        item.passage,
        LIMITS.tasteDossierPassageCharacters,
      ) ||
      !Array.isArray(item.domains) ||
      item.domains.length < 1 ||
      item.domains.length > TASTE_DOMAINS.size ||
      item.domains.some((domain) => !TASTE_DOMAINS.has(domain)) ||
      !Array.isArray(item.concepts) ||
      item.concepts.length < 1 ||
      item.concepts.length > LIMITS.tasteDossierConcepts
    ) {
      throw new InputValidationError(
        `tasteDossier.evidence[${index}] is invalid or references a Note that no longer exists.`,
      );
    }
    const concepts = item.concepts.map((concept, conceptIndex) => {
      if (
        !isBoundedString(
          concept,
          LIMITS.tasteDossierConceptCharacters,
        )
      ) {
        throw new InputValidationError(
          `tasteDossier.evidence[${index}].concepts[${conceptIndex}] is invalid.`,
        );
      }
      return copyBoundedString(
        concept,
        LIMITS.tasteDossierConceptCharacters,
      );
    });
    return {
      noteId: supplied.id,
      noteTitle: supplied.title,
      folder: supplied.folder ?? "",
      passage: copyBoundedString(
        item.passage,
        LIMITS.tasteDossierPassageCharacters,
      ),
      polarity: item.polarity,
      strength: item.strength,
      domains: [...new Set(item.domains)],
      concepts,
      ...(isBoundedString(item.updatedAt, 80, { allowEmpty: true })
        ? { updatedAt: copyBoundedString(item.updatedAt, 80) }
        : {}),
    };
  });
  const evidenceNoteCount = new Set(evidence.map((item) => item.noteId)).size;
  if (
    dossier.currentNoteCount !== notes.length ||
    dossier.evidenceCount !== evidence.length ||
    dossier.evidenceNoteCount !== evidenceNoteCount
  ) {
    throw new InputValidationError(
      "tasteDossier coverage must match the currently supplied Notes.",
    );
  }
  return {
    currentNoteCount: notes.length,
    evidenceNoteCount,
    evidenceCount: evidence.length,
    evidence,
  };
};

const validateTasteSignals = (signals) => {
  if (signals === undefined) return [];
  if (!Array.isArray(signals) || signals.length > LIMITS.tasteSignals) {
    throw new InputValidationError(
      `tasteSignals must be an array with at most ${LIMITS.tasteSignals} items.`,
    );
  }

  return signals.map((signal, index) => {
    if (
      !isRecord(signal) ||
      !APP_SET.has(signal.appId) ||
      !FEEDBACK_KINDS.has(signal.kind) ||
      !isBoundedString(
        signal.targetTitle,
        LIMITS.tasteSignalTitleCharacters,
      ) ||
      !isBoundedString(signal.timestamp, 80)
    ) {
      throw new InputValidationError(
        `tasteSignals[${index}] contains invalid metadata.`,
      );
    }
    if (
      !Array.isArray(signal.tags) ||
      signal.tags.length > LIMITS.tasteSignalTags
    ) {
      throw new InputValidationError(
        `tasteSignals[${index}].tags must contain at most ${LIMITS.tasteSignalTags} items.`,
      );
    }

    return {
      appId: signal.appId,
      targetTitle: copyBoundedString(
        signal.targetTitle,
        LIMITS.tasteSignalTitleCharacters,
      ),
      kind: signal.kind,
      timestamp: copyBoundedString(signal.timestamp, 80),
      tags: signal.tags.map((tag, tagIndex) => {
        if (!isBoundedString(tag, LIMITS.tasteSignalTagCharacters)) {
          throw new InputValidationError(
            `tasteSignals[${index}].tags[${tagIndex}] is invalid.`,
          );
        }
        return copyBoundedString(tag, LIMITS.tasteSignalTagCharacters);
      }),
    };
  });
};

const validateReviews = (reviews) => {
  if (reviews === undefined) return [];
  if (!Array.isArray(reviews) || reviews.length > LIMITS.reviews) {
    throw new InputValidationError(
      `reviews must be an array with at most ${LIMITS.reviews} items.`,
    );
  }

  return reviews.map((review, index) => {
    if (
      !isRecord(review) ||
      !isBoundedString(review.title, LIMITS.reviewTitleCharacters) ||
      !isBoundedString(review.reviewedAt, 80)
    ) {
      throw new InputValidationError(`reviews[${index}] is invalid.`);
    }
    if (
      review.rating !== undefined &&
      (typeof review.rating !== "number" ||
        !Number.isFinite(review.rating) ||
        review.rating < 0 ||
        review.rating > 5)
    ) {
      throw new InputValidationError(
        `reviews[${index}].rating must be between 0 and 5.`,
      );
    }
    if (
      review.minutes !== undefined &&
      (!Number.isInteger(review.minutes) ||
        review.minutes < 0 ||
        review.minutes > 1_000_000)
    ) {
      throw new InputValidationError(
        `reviews[${index}].minutes is invalid.`,
      );
    }

    return {
      title: copyBoundedString(review.title, LIMITS.reviewTitleCharacters),
      reviewedAt: copyBoundedString(review.reviewedAt, 80),
      ...(review.rating !== undefined ? { rating: review.rating } : {}),
      ...(review.minutes !== undefined ? { minutes: review.minutes } : {}),
    };
  });
};

const validateBookHistory = (history) => {
  if (history === undefined) return [];
  if (!Array.isArray(history) || history.length > LIMITS.bookHistory) {
    throw new InputValidationError(
      `bookHistory must contain at most ${LIMITS.bookHistory} items.`,
    );
  }
  return history.map((entry, index) => {
    if (
      !isRecord(entry) ||
      !isBoundedString(entry.title, LIMITS.reviewTitleCharacters) ||
      !Array.isArray(entry.shelves) ||
      entry.shelves.length > LIMITS.tasteSignalTags
    ) {
      throw new InputValidationError(`bookHistory[${index}] is invalid.`);
    }
    if (
      entry.author !== undefined &&
      !isBoundedString(entry.author, LIMITS.bookAuthorCharacters)
    ) {
      throw new InputValidationError(
        `bookHistory[${index}].author is invalid.`,
      );
    }
    if (
      entry.rating !== undefined &&
      (typeof entry.rating !== "number" ||
        !Number.isFinite(entry.rating) ||
        entry.rating < 0 ||
        entry.rating > 5)
    ) {
      throw new InputValidationError(
        `bookHistory[${index}].rating must be between 0 and 5.`,
      );
    }
    if (
      entry.minutes !== undefined &&
      (!Number.isInteger(entry.minutes) ||
        entry.minutes < 0 ||
        entry.minutes > 1_000_000)
    ) {
      throw new InputValidationError(
        `bookHistory[${index}].minutes is invalid.`,
      );
    }
    if (
      entry.readAt !== undefined &&
      (!isBoundedString(entry.readAt, 80) ||
        Number.isNaN(new Date(entry.readAt).getTime()))
    ) {
      throw new InputValidationError(
        `bookHistory[${index}].readAt is invalid.`,
      );
    }
    return {
      title: copyBoundedString(entry.title, LIMITS.reviewTitleCharacters),
      shelves: entry.shelves.map((shelf, shelfIndex) => {
        if (!isBoundedString(shelf, LIMITS.tasteSignalTagCharacters)) {
          throw new InputValidationError(
            `bookHistory[${index}].shelves[${shelfIndex}] is invalid.`,
          );
        }
        return copyBoundedString(shelf, LIMITS.tasteSignalTagCharacters);
      }),
      ...(entry.author
        ? {
            author: copyBoundedString(
              entry.author,
              LIMITS.bookAuthorCharacters,
            ),
          }
        : {}),
      ...(entry.rating !== undefined ? { rating: entry.rating } : {}),
      ...(entry.minutes !== undefined ? { minutes: entry.minutes } : {}),
      ...(entry.readAt
        ? { readAt: new Date(entry.readAt).toISOString() }
        : {}),
    };
  });
};

const validateLocalPhotoSignals = (signals) => {
  if (signals === undefined || signals === null) return null;
  if (
    !isRecord(signals) ||
    !Number.isInteger(signals.fileCount) ||
    signals.fileCount < 1 ||
    signals.fileCount > 120 ||
    !Array.isArray(signals.tags) ||
    !Array.isArray(signals.palette) ||
    signals.tags.length + signals.palette.length >
      LIMITS.localPhotoSignalTags ||
    !isBoundedString(signals.importedAt, 80) ||
    Number.isNaN(new Date(signals.importedAt).getTime())
  ) {
    throw new InputValidationError("localPhotoSignals is invalid.");
  }
  const validateLabels = (values, field) =>
    values.map((value, index) => {
      if (!isBoundedString(value, LIMITS.tasteSignalTagCharacters)) {
        throw new InputValidationError(
          `localPhotoSignals.${field}[${index}] is invalid.`,
        );
      }
      return copyBoundedString(value, LIMITS.tasteSignalTagCharacters);
    });
  return {
    fileCount: signals.fileCount,
    tags: validateLabels(signals.tags, "tags"),
    palette: validateLabels(signals.palette, "palette"),
    importedAt: new Date(signals.importedAt).toISOString(),
  };
};

const validateLocalChatSignals = (signals) => {
  if (signals === undefined || signals === null) return null;
  if (
    !isRecord(signals) ||
    !Number.isInteger(signals.messageCount) ||
    signals.messageCount < 1 ||
    signals.messageCount > 5_000 ||
    !Array.isArray(signals.topics) ||
    signals.topics.length < 1 ||
    signals.topics.length > LIMITS.localChatSignalTopics ||
    !isBoundedString(signals.importedAt, 80) ||
    Number.isNaN(new Date(signals.importedAt).getTime())
  ) {
    throw new InputValidationError("localChatSignals is invalid.");
  }
  return {
    messageCount: signals.messageCount,
    topics: signals.topics.map((topic, index) => {
      if (!isBoundedString(topic, LIMITS.tasteSignalTagCharacters)) {
        throw new InputValidationError(
          `localChatSignals.topics[${index}] is invalid.`,
        );
      }
      return copyBoundedString(topic, LIMITS.tasteSignalTagCharacters);
    }),
    importedAt: new Date(signals.importedAt).toISOString(),
  };
};

const validateRecommendations = (recommendations) => {
  if (recommendations === undefined) return [];
  if (
    !Array.isArray(recommendations) ||
    recommendations.length > LIMITS.recommendations
  ) {
    throw new InputValidationError(
      `recommendations must contain at most ${LIMITS.recommendations} items.`,
    );
  }
  const seen = new Set();
  return recommendations.map((item, index) => {
    if (
      !isRecord(item) ||
      !RECOMMENDATION_APPS.has(item.appId) ||
      !isBoundedString(
        item.itemId,
        LIMITS.recommendationItemIdCharacters,
      ) ||
      !isBoundedString(
        item.title,
        LIMITS.recommendationTitleCharacters,
      ) ||
      !isBoundedString(item.kind, LIMITS.recommendationKindCharacters) ||
      typeof item.score !== "number" ||
      !Number.isFinite(item.score) ||
      item.score < 0 ||
      item.score > 100 ||
      !Array.isArray(item.tags) ||
      item.tags.length > LIMITS.tasteSignalTags
    ) {
      throw new InputValidationError(
        `recommendations[${index}] is invalid.`,
      );
    }
    const key = `${item.appId}:${item.itemId}`;
    if (seen.has(key)) {
      throw new InputValidationError(
        `recommendations[${index}] must be unique.`,
      );
    }
    seen.add(key);
    if (
      item.description !== undefined &&
      !isBoundedString(
        item.description,
        LIMITS.recommendationDescriptionCharacters,
      )
    ) {
      throw new InputValidationError(
        `recommendations[${index}].description is invalid.`,
      );
    }
    if (
      item.evidenceSummary !== undefined &&
      !isBoundedString(
        item.evidenceSummary,
        LIMITS.recommendationEvidenceCharacters,
      )
    ) {
      throw new InputValidationError(
        `recommendations[${index}].evidenceSummary is invalid.`,
      );
    }
    if (
      item.sourceNotes !== undefined &&
      (!Array.isArray(item.sourceNotes) ||
        item.sourceNotes.length > LIMITS.recommendationSourceNotes ||
        item.sourceNotes.some(
          (title) =>
            !isBoundedString(
              title,
              LIMITS.recommendationTitleCharacters,
            ),
        ))
    ) {
      throw new InputValidationError(
        `recommendations[${index}].sourceNotes is invalid.`,
      );
    }
    return {
      appId: item.appId,
      itemId: copyBoundedString(
        item.itemId,
        LIMITS.recommendationItemIdCharacters,
      ),
      title: copyBoundedString(
        item.title,
        LIMITS.recommendationTitleCharacters,
      ),
      kind: copyBoundedString(
        item.kind,
        LIMITS.recommendationKindCharacters,
      ),
      score: Math.round(item.score),
      tags: item.tags.map((tag, tagIndex) => {
        if (!isBoundedString(tag, LIMITS.tasteSignalTagCharacters)) {
          throw new InputValidationError(
            `recommendations[${index}].tags[${tagIndex}] is invalid.`,
          );
        }
        return copyBoundedString(tag, LIMITS.tasteSignalTagCharacters);
      }),
      ...(item.description
        ? {
            description: copyBoundedString(
              item.description,
              LIMITS.recommendationDescriptionCharacters,
            ),
          }
        : {}),
      ...(item.evidenceSummary
        ? {
            evidenceSummary: copyBoundedString(
              item.evidenceSummary,
              LIMITS.recommendationEvidenceCharacters,
            ),
          }
        : {}),
      ...(item.sourceNotes
        ? {
            sourceNotes: item.sourceNotes.map((title) =>
              copyBoundedString(
                title,
                LIMITS.recommendationTitleCharacters,
              ),
            ),
          }
        : {}),
    };
  });
};

const validateActiveSelection = (selection, recommendations) => {
  if (selection === undefined) return undefined;
  if (
    !isRecord(selection) ||
    !RECOMMENDATION_APPS.has(selection.appId) ||
    !isBoundedString(
      selection.itemId,
      LIMITS.recommendationItemIdCharacters,
    )
  ) {
    throw new InputValidationError("activeSelection is invalid.");
  }
  const item = recommendations.find(
    (candidate) =>
      candidate.appId === selection.appId &&
      candidate.itemId === selection.itemId,
  );
  if (!item) {
    throw new InputValidationError(
      "activeSelection must reference a supplied recommendation.",
    );
  }
  return {
    appId: item.appId,
    itemId: item.itemId,
    title: item.title,
  };
};

export const validateAssistantRequest = (payload) => {
  if (!isRecord(payload)) {
    throw new InputValidationError("Request body must be an object.");
  }

  if (payload.activeApp !== undefined && !APP_SET.has(payload.activeApp)) {
    throw new InputValidationError(
      `activeApp must be one of: ${DASHBOARD_APPS.join(", ")}.`,
    );
  }

  const notes = validateNotes(payload.notes);
  const recommendations = validateRecommendations(payload.recommendations);
  const activeSelection = validateActiveSelection(
    payload.activeSelection,
    recommendations,
  );
  return {
    messages: validateMessages(payload.messages),
    profile: validateProfile(payload.profile),
    ...(payload.activeApp ? { activeApp: payload.activeApp } : {}),
    notes,
    relevantNotes: validateRelevantNotes(payload.relevantNotes, notes),
    tasteDossier: validateTasteDossier(payload.tasteDossier, notes),
    tasteSignals: validateTasteSignals(payload.tasteSignals),
    reviews: validateReviews(payload.reviews),
    bookHistory: validateBookHistory(payload.bookHistory),
    localPhotoSignals: validateLocalPhotoSignals(payload.localPhotoSignals),
    localChatSignals: validateLocalChatSignals(payload.localChatSignals),
    recommendations,
    ...(activeSelection ? { activeSelection } : {}),
  };
};

export const validateDashboardActions = (
  actions,
  notes = [],
  recommendations = [],
) => {
  if (!Array.isArray(actions)) return [];

  const noteIds = new Set(notes.map((note) => note.id));
  const recommendationIds = new Set(
    recommendations.map((item) => `${item.appId}:${item.itemId}`),
  );
  const validated = [];

  for (const action of actions) {
    if (validated.length >= LIMITS.actionCount) break;
    if (!isRecord(action) || typeof action.type !== "string") continue;

    if (action.type === "open_app" && APP_SET.has(action.app)) {
      validated.push({ type: "open_app", app: action.app });
      continue;
    }

    if (
      action.type === "select_note" &&
      isBoundedString(action.noteId, LIMITS.noteIdCharacters) &&
      noteIds.has(action.noteId)
    ) {
      validated.push({
        type: "select_note",
        noteId: copyBoundedString(action.noteId, LIMITS.noteIdCharacters),
      });
      continue;
    }

    if (
      action.type === "set_app_view" &&
      Object.hasOwn(APP_VIEWS, action.app) &&
      APP_VIEWS[action.app].includes(action.view)
    ) {
      validated.push({
        type: "set_app_view",
        app: action.app,
        view: action.view,
      });
      continue;
    }

    if (
      action.type === "search_app" &&
      SEARCHABLE_APPS.has(action.app) &&
      isBoundedString(action.query, LIMITS.searchQueryCharacters)
    ) {
      validated.push({
        type: "search_app",
        app: action.app,
        query: copyBoundedString(action.query, LIMITS.searchQueryCharacters),
      });
      continue;
    }

    if (
      action.type === "select_item" &&
      RECOMMENDATION_APPS.has(action.app) &&
      isBoundedString(
        action.itemId,
        LIMITS.recommendationItemIdCharacters,
      ) &&
      recommendationIds.has(`${action.app}:${action.itemId}`)
    ) {
      validated.push({
        type: "select_item",
        app: action.app,
        itemId: copyBoundedString(
          action.itemId,
          LIMITS.recommendationItemIdCharacters,
        ),
      });
      continue;
    }

    if (
      action.type === "update_library" &&
      RECOMMENDATION_APPS.has(action.app) &&
      isBoundedString(
        action.itemId,
        LIMITS.recommendationItemIdCharacters,
      ) &&
      recommendationIds.has(`${action.app}:${action.itemId}`) &&
      (action.operation === "add" || action.operation === "remove") &&
      isBoundedString(action.reason, LIMITS.libraryReasonCharacters)
    ) {
      validated.push({
        type: "update_library",
        app: action.app,
        itemId: copyBoundedString(
          action.itemId,
          LIMITS.recommendationItemIdCharacters,
        ),
        operation: action.operation,
        reason: copyBoundedString(
          action.reason,
          LIMITS.libraryReasonCharacters,
        ),
      });
      continue;
    }

    if (
      action.type === "propose_note_edit" &&
      isBoundedString(action.noteId, LIMITS.noteIdCharacters) &&
      noteIds.has(action.noteId) &&
      action.noteId !== "preferences" &&
      (action.mode === "append" || action.mode === "replace") &&
      isBoundedString(action.content, LIMITS.noteSuggestionCharacters) &&
      isBoundedString(
        action.reason,
        LIMITS.noteSuggestionReasonCharacters,
      )
    ) {
      validated.push({
        type: "propose_note_edit",
        noteId: copyBoundedString(action.noteId, LIMITS.noteIdCharacters),
        mode: action.mode,
        content: copyBoundedString(
          action.content,
          LIMITS.noteSuggestionCharacters,
        ),
        reason: copyBoundedString(
          action.reason,
          LIMITS.noteSuggestionReasonCharacters,
        ),
      });
      continue;
    }

    if (
      action.type === "propose_note_create" &&
      isBoundedString(action.title, 120) &&
      (action.folder === "Personal" ||
        action.folder === "Ideas" ||
        action.folder === "Reviews") &&
      isBoundedString(action.content, LIMITS.noteSuggestionCharacters) &&
      isBoundedString(
        action.reason,
        LIMITS.noteSuggestionReasonCharacters,
      )
    ) {
      validated.push({
        type: "propose_note_create",
        title: copyBoundedString(action.title, 120),
        folder: action.folder,
        content: copyBoundedString(
          action.content,
          LIMITS.noteSuggestionCharacters,
        ),
        reason: copyBoundedString(
          action.reason,
          LIMITS.noteSuggestionReasonCharacters,
        ),
      });
      continue;
    }

    if (
      action.type === "update_preferences" &&
      isBoundedString(
        action.suggestion,
        LIMITS.preferenceSuggestionCharacters,
      ) &&
      isValidPreferenceSuggestion(action.suggestion) &&
      isBoundedString(action.reason, LIMITS.preferenceReasonCharacters)
    ) {
      validated.push({
        type: "update_preferences",
        suggestion: copyBoundedString(
          action.suggestion,
          LIMITS.preferenceSuggestionCharacters,
        ),
        reason: copyBoundedString(
          action.reason,
          LIMITS.preferenceReasonCharacters,
        ),
      });
    }
  }

  return validated;
};

export const validateModelResult = (
  candidate,
  notes = [],
  recommendations = [],
) => {
  if (
    !isRecord(candidate) ||
    !isBoundedString(candidate.message, LIMITS.assistantMessageCharacters)
  ) {
    throw new Error("The assistant returned an invalid message.");
  }

  return {
    message: copyBoundedString(
      candidate.message,
      LIMITS.assistantMessageCharacters,
    ),
    actions: validateDashboardActions(
      candidate.actions,
      notes,
      recommendations,
    ),
  };
};
