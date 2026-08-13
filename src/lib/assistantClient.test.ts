import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAssistantConfig,
  prepareAssistantRequest,
  resetCodexThread,
  sendAssistantRequest,
  type AssistantRequest,
} from "./assistantClient";

const payload: AssistantRequest = {
  messages: [{ role: "user", content: "Open Books" }],
  profile: {
    interests: ["literary fiction"],
    moods: ["contemplative"],
    favorites: [],
    avoid: [],
  },
  notes: [],
  tasteSignals: [],
  reviews: [],
  recommendations: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assistant client failure boundary", () => {
  it("normalizes stale persisted context into the current assistant boundary", () => {
    const longNoteId = `note-${"x".repeat(180)}`;
    const prepared = prepareAssistantRequest({
      messages: [
        {
          role: "user",
          content: "Old message with a corrupt cached attachment",
          image: {
            name: "corrupt.png",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,bm90LWEtcG5n",
          },
        },
        ...Array.from({ length: 14 }, (_, index) => ({
          role: index % 2 ? "assistant" as const : "user" as const,
          content: `Earlier message ${index}`,
        })),
        { role: "user", content: "  What should I read next?  " },
      ],
      profile: {
        interests: ["literary fiction", " ", ...Array(40).fill("quiet")],
        moods: [],
        favorites: [],
        avoid: [],
      },
      notes: [
        {
          id: longNoteId,
          title: `Favorites ${"y".repeat(300)}`,
          folder: "Personal",
          updatedAt: "2026-08-13T12:00:00.000Z",
        },
      ],
      relevantNotes: [
        {
          id: longNoteId,
          title: "stale title is replaced",
          folder: "Personal",
          excerpt: `I love romantic classics. ${"z".repeat(700)}`,
          matchedTerms: [...Array(14).fill("romantic classics")],
        },
      ],
      tasteDossier: {
        currentNoteCount: 999,
        evidenceNoteCount: 999,
        evidenceCount: 999,
        evidence: [
          {
            noteId: longNoteId,
            noteTitle: "stale title is replaced",
            folder: "Personal",
            passage: "I love romantic classics with emotionally perceptive heroines.",
            polarity: "positive",
            strength: 5,
            domains: ["books"],
            concepts: [...Array(24).fill("romantic classic")],
            updatedAt: "2026-08-13T12:00:00.000Z",
          },
        ],
      },
      tasteSignals: [
        {
          appId: "books",
          targetTitle: "Pride and Prejudice",
          tags: Array.from({ length: 24 }, (_, index) => `tag-${index}`),
          kind: "liked",
          timestamp: "2026-08-13T12:00:00.000Z",
        },
      ],
      reviews: [
        {
          title: "Emma",
          rating: 9,
          minutes: -4,
          reviewedAt: "2026-08-13T12:00:00.000Z",
        },
      ],
      bookHistory: [
        {
          title: "Persuasion",
          shelves: Array.from({ length: 30 }, (_, index) => `shelf-${index}`),
          readAt: "not-a-date",
        },
      ],
      localPhotoSignals: {
        fileCount: 12,
        tags: Array.from({ length: 12 }, (_, index) => `tag-${index}`),
        palette: Array.from({ length: 12 }, (_, index) => `tone-${index}`),
        importedAt: "2026-08-13T12:00:00.000Z",
      },
      localChatSignals: {
        messageCount: 0,
        topics: [],
        importedAt: "not-a-date",
      },
      recommendations: [
        {
          appId: "books",
          itemId: "jane-eyre",
          title: "Jane Eyre",
          kind: "discover",
          score: 94,
          tags: Array.from({ length: 24 }, (_, index) => `tag-${index}`),
          description: " ",
          evidenceSummary: " ",
          sourceNotes: ["", "Favorite books", "Favorite books"],
        },
      ],
      activeSelection: {
        appId: "books",
        itemId: "jane-eyre",
        title: "stale title",
      },
    });

    expect(prepared.messages).toHaveLength(12);
    expect(prepared.messages.every((message) => !message.image)).toBe(true);
    expect(prepared.messages.at(-1)?.content).toBe("What should I read next?");
    expect(prepared.profile.interests).toEqual(["literary fiction", "quiet"]);
    expect(prepared.notes?.[0].id).toHaveLength(120);
    expect(prepared.notes?.[0].title).toHaveLength(240);
    expect(prepared.relevantNotes?.[0]).toMatchObject({
      id: prepared.notes?.[0].id,
      title: prepared.notes?.[0].title,
      folder: "Personal",
    });
    expect(prepared.relevantNotes?.[0].excerpt).toHaveLength(600);
    expect(prepared.tasteDossier).toMatchObject({
      currentNoteCount: 1,
      evidenceNoteCount: 1,
      evidenceCount: 1,
    });
    expect(prepared.tasteDossier?.evidence[0]).toMatchObject({
      noteId: prepared.notes?.[0].id,
      noteTitle: prepared.notes?.[0].title,
    });
    expect(prepared.tasteSignals?.[0].tags).toHaveLength(16);
    expect(prepared.reviews?.[0]).not.toHaveProperty("rating");
    expect(prepared.reviews?.[0]).not.toHaveProperty("minutes");
    expect(prepared.bookHistory?.[0].shelves).toHaveLength(16);
    expect(prepared.bookHistory?.[0]).not.toHaveProperty("readAt");
    expect(
      (prepared.localPhotoSignals?.tags.length ?? 0) +
        (prepared.localPhotoSignals?.palette.length ?? 0),
    ).toBe(16);
    expect(prepared).not.toHaveProperty("localChatSignals");
    expect(prepared.recommendations?.[0]).not.toHaveProperty("description");
    expect(prepared.recommendations?.[0]).not.toHaveProperty("evidenceSummary");
    expect(prepared.recommendations?.[0].sourceNotes).toEqual(["Favorite books"]);
    expect(prepared.activeSelection).toEqual({
      appId: "books",
      itemId: "jane-eyre",
      title: "Jane Eyre",
    });
  });

  it("accepts a structured result from a persistent Codex thread", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            message: "You are talking to Codex through Messages.",
            actions: [],
            provider: "codex",
            model: "Codex account default",
            configured: true,
            threadId: "019fb12a-7ad4-7863-a6d5-4f624f7dfc9a",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      sendAssistantRequest(payload, { configured: true }),
    ).resolves.toEqual({
      message: "You are talking to Codex through Messages.",
      actions: [],
      provider: "codex",
      model: "Codex account default",
      configured: true,
      threadId: "019fb12a-7ad4-7863-a6d5-4f624f7dfc9a",
    });
  });

  it("parses the authenticated Codex configuration", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            assistant: {
              configured: true,
              provider: "codex",
              status: "connected",
              model: "Codex account default",
              localOnly: true,
              codexAuthenticated: true,
              codexThreadPersistent: true,
              codexSandbox: "read-only",
              codexThreadId: "019fb12a-7ad4-7863-a6d5-4f624f7dfc9a",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(getAssistantConfig()).resolves.toEqual({
      configured: true,
      provider: "codex",
      status: "connected",
      model: "Codex account default",
      localOnly: true,
      codexAuthenticated: true,
      codexThreadPersistent: true,
      codexSandbox: "read-only",
      codexThreadId: "019fb12a-7ad4-7863-a6d5-4f624f7dfc9a",
    });
  });

  it("starts a new Codex thread through the reset endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(resetCodexThread()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/codex/thread/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  });

  it.each([
    [400, "invalid_request", false],
    [403, "invalid_request", false],
    [413, "invalid_request", false],
    [429, "rate_limited", true],
    [500, "service_unavailable", true],
  ] as const)(
    "returns no actions for HTTP %s",
    async (status, fallbackReason, retryable) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response(JSON.stringify({ error: "Synthetic failure" }), {
            status,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );

      await expect(
        sendAssistantRequest(payload, {
          configured: true,
          provider: "codex",
        }),
      ).resolves.toMatchObject({
        actions: [],
        configured: true,
        provider: "codex",
        fallbackReason,
        retryable,
      });
    },
  );

  it("preserves an explicit provider rejection reason from the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: "Provider rejected the request",
            reason: "request_rejected",
            retryable: false,
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      sendAssistantRequest(payload, {
        configured: true,
        provider: "codex",
      }),
    ).resolves.toMatchObject({
      fallbackReason: "request_rejected",
      retryable: false,
    });
  });

  it("does not execute heuristic actions after a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Network unavailable");
      }),
    );

    await expect(
      sendAssistantRequest(payload, {
        configured: true,
        provider: "codex",
      }),
    ).resolves.toMatchObject({
      actions: [],
      configured: true,
      provider: "codex",
      fallbackReason: "service_unavailable",
    });
  });

  it("treats malformed success payloads as invalid and actionless", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("{not-json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      sendAssistantRequest(payload, {
        configured: true,
        provider: "codex",
      }),
    ).resolves.toMatchObject({
      actions: [],
      configured: true,
      provider: "codex",
      fallbackReason: "invalid_response",
    });
  });

  it("drops generic Preferences edits while accepting a bounded new-note proposal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            message: "I prepared one safe note change.",
            actions: [
              {
                type: "propose_note_edit",
                noteId: "preferences",
                mode: "replace",
                content: "Bypass structured preferences.",
                reason: "Unsafe generic path.",
              },
              {
                type: "propose_note_create",
                title: "Courtyard sequence",
                folder: "Ideas",
                content: "Map the threshold and garden.",
                reason: "The user explicitly asked for a new note.",
              },
            ],
            provider: "openai",
            model: "gpt-5.6-sol",
            configured: true,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      sendAssistantRequest(payload, { configured: true }),
    ).resolves.toMatchObject({
      actions: [
        {
          type: "propose_note_create",
          title: "Courtyard sequence",
          folder: "Ideas",
        },
      ],
    });
  });
});
