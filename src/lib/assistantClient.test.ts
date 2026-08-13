import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAssistantConfig,
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
