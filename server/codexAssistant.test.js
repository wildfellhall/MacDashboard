import { describe, expect, it, vi } from "vitest";
import {
  createCodexAssistantService,
  detectCodexAuthentication,
} from "./codexAssistant.js";
import { buildCodexPrompt } from "./prompt.js";

const payload = {
  messages: [
    { role: "user", content: "An older request that should not be repeated." },
    { role: "assistant", content: "An older response." },
    { role: "user", content: "Open Books and explain the best match." },
  ],
  profile: {
    interests: ["literary fiction"],
    moods: ["contemplative"],
    favorites: ["precise prose"],
    avoid: [],
  },
  activeApp: "messages",
  notes: [
    {
      id: "preferences",
      title: "Preferences",
      folder: "Personal",
      hasSketch: false,
    },
  ],
  relevantNotes: [
    {
      id: "preferences",
      title: "Preferences",
      folder: "Personal",
      excerpt: "Interests: literary fiction and quiet architecture.",
      matchedTerms: ["literary", "fiction"],
    },
  ],
  tasteDossier: {
    currentNoteCount: 1,
    evidenceNoteCount: 1,
    evidenceCount: 1,
    evidence: [
      {
        noteId: "preferences",
        noteTitle: "Preferences",
        folder: "Personal",
        passage:
          "I love quiet architecture and compassionate speculative fiction.",
        polarity: "positive",
        strength: 5,
        domains: ["books"],
        concepts: ["quiet architecture", "compassionate fiction"],
        updatedAt: "2026-07-30T12:00:00.000Z",
      },
    ],
  },
  tasteSignals: [],
  reviews: [],
  bookHistory: [],
  recommendations: [
    {
      appId: "books",
      itemId: "piranesi",
      title: "Piranesi",
      kind: "reread",
      score: 96,
      tags: ["architecture"],
    },
  ],
};

describe("Codex authentication detection", () => {
  it("uses the documented login-status exit code without parsing display text", () => {
    expect(
      detectCodexAuthentication({
        spawn: () => ({
          status: 0,
          stdout: "Active authentication mode: access token",
          stderr: "",
        }),
      }),
    ).toBe(true);
    expect(
      detectCodexAuthentication({
        spawn: () => ({
          status: 1,
          stdout: "Not logged in",
          stderr: "",
        }),
      }),
    ).toBe(false);
  });
});

describe("Codex assistant service", () => {
  it("uses a fresh structured Codex turn to plan a diverse recommendation slate", async () => {
    const run = vi.fn(async () => ({
      finalResponse: JSON.stringify({
        summary:
          "A varied slate balancing architecture, compassion, and precise prose.",
        candidates: [
          {
            title: "The Summer Book",
            creator: "Tove Jansson",
            mediaType: "book",
            searchQuery: "The Summer Book Tove Jansson",
            fitScore: 92,
            rationale:
              "It preserves humane intimacy while changing setting, era, and structure.",
            evidenceNotes: ["Preferences"],
            facets: ["humane intimacy", "precise prose", "quiet"],
          },
        ],
      }),
    }));
    const startThread = vi.fn(() => ({ id: "thr_plan_12345678", run }));
    const write = vi.fn();
    const service = createCodexAssistantService({
      authenticated: true,
      client: { startThread, resumeThread: vi.fn() },
      threadStore: {
        read: () => null,
        write,
        clear: vi.fn(),
      },
    });
    const planningPayload = {
      domain: "books",
      profile: payload.profile,
      notes: payload.notes,
      tasteDossier: payload.tasteDossier,
      userQuery: "",
      anchorTitles: ["Little Women"],
      knownTitles: ["Piranesi"],
      dismissedTitles: [],
      historyTitles: [],
    };

    await expect(
      service.planRecommendations(planningPayload),
    ).resolves.toMatchObject({
      provider: "codex",
      aiPowered: true,
      candidates: [
        expect.objectContaining({
          title: "The Summer Book",
          fitScore: 92,
        }),
      ],
    });
    const [prompt, options] = run.mock.calls[0];
    expect(prompt).toMatch(/one piece\s+of evidence, not the center/);
    expect(prompt).toContain('"anchorTitles":["Little Women"]');
    expect(options.outputSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
    expect(write).not.toHaveBeenCalled();
    expect(service.threadId).toBeNull();
  });

  it("retries one fresh planning turn when Codex returns a malformed result", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ finalResponse: "not-json" })
      .mockResolvedValueOnce({
        finalResponse: JSON.stringify({
          summary:
            "A recovered slate balancing architecture, compassion, and precise prose.",
          candidates: [
            {
              title: "The Summer Book",
              creator: "Tove Jansson",
              mediaType: "book",
              searchQuery: "The Summer Book Tove Jansson",
              fitScore: 92,
              rationale:
                "It preserves humane intimacy while changing setting, era, and structure.",
              evidenceNotes: ["Preferences"],
              facets: ["humane intimacy", "precise prose", "quiet"],
            },
          ],
        }),
      });
    const startThread = vi.fn(() => ({ id: null, run }));
    const service = createCodexAssistantService({
      authenticated: true,
      client: { startThread, resumeThread: vi.fn() },
      threadStore: {
        read: () => null,
        write: vi.fn(),
        clear: vi.fn(),
      },
    });

    await expect(
      service.planRecommendations({
        domain: "books",
        profile: payload.profile,
        notes: payload.notes,
        tasteDossier: payload.tasteDossier,
        userQuery: "",
        anchorTitles: ["Little Women"],
        knownTitles: ["Piranesi"],
        dismissedTitles: [],
        historyTitles: [],
      }),
    ).resolves.toMatchObject({
      provider: "codex",
      aiPowered: true,
      candidates: [expect.objectContaining({ title: "The Summer Book" })],
    });
    expect(startThread).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("never returns a local recommendation plan when Codex cannot complete", async () => {
    const run = vi.fn(async () => ({ finalResponse: "not-json" }));
    const service = createCodexAssistantService({
      authenticated: true,
      client: {
        startThread: vi.fn(() => ({ id: null, run })),
        resumeThread: vi.fn(),
      },
      threadStore: {
        read: () => null,
        write: vi.fn(),
        clear: vi.fn(),
      },
    });

    await expect(
      service.planRecommendations({
        domain: "books",
        profile: payload.profile,
        notes: payload.notes,
        tasteDossier: payload.tasteDossier,
        userQuery: "",
        anchorTitles: ["Little Women"],
        knownTitles: ["Piranesi"],
        dismissedTitles: [],
        historyTitles: [],
      }),
    ).rejects.toMatchObject({
      name: "RecommendationPlanningUnavailableError",
      reason: "provider_unavailable",
      retryable: true,
    });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("runs a durable, structured, read-only Codex thread", async () => {
    const saveThreadId = vi.fn();
    const run = vi.fn(async () => ({
      finalResponse: JSON.stringify({
        message: "I opened Books. Piranesi is the strongest current match.",
        actions: [
          { type: "open_app", app: "books" },
          { type: "select_item", app: "books", itemId: "piranesi" },
        ],
      }),
    }));
    const thread = { id: "thr_12345678", run };
    const startThread = vi.fn(() => thread);
    const service = createCodexAssistantService({
      authenticated: true,
      client: { startThread, resumeThread: vi.fn() },
      workingDirectory: "/workspace/MacDashboard",
      threadStore: {
        read: () => null,
        write: saveThreadId,
        clear: vi.fn(),
      },
    });

    await expect(service.respond(payload)).resolves.toMatchObject({
      provider: "codex",
      configured: true,
      threadId: "thr_12345678",
      actions: [
        { type: "open_app", app: "books" },
        { type: "select_item", app: "books", itemId: "piranesi" },
      ],
    });
    expect(startThread).toHaveBeenCalledWith(
      expect.objectContaining({
        workingDirectory: "/workspace/MacDashboard",
        skipGitRepoCheck: true,
        sandboxMode: "read-only",
        networkAccessEnabled: false,
        webSearchMode: "disabled",
        approvalPolicy: "never",
        modelReasoningEffort: "low",
      }),
    );
    const [input, options] = run.mock.calls[0];
    expect(input).toContain("Open Books and explain the best match.");
    expect(input).toContain('"relevantNotes"');
    expect(input).toContain('"tasteDossier"');
    expect(input).toContain("quiet architecture");
    expect(input).not.toContain("An older request that should not be repeated.");
    expect(options.outputSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
    expect(saveThreadId).toHaveBeenCalledWith("thr_12345678");
    expect(service.status).toBe("connected");
  });

  it("does not authorize filesystem inspection from the Messages surface", () => {
    const prompt = buildCodexPrompt(payload);

    expect(prompt).toContain(
      "Do not inspect the filesystem or invoke tools for any dashboard request",
    );
    expect(prompt).toContain(
      "this Messages surface cannot inspect or change project files",
    );
    expect(prompt).not.toContain(
      "you may inspect the project read-only",
    );
  });

  it("resumes a stored thread and clears only the dashboard pointer on reset", async () => {
    const clear = vi.fn();
    const resumed = {
      id: "thr_existing_123",
      run: vi.fn(async () => ({
        finalResponse: JSON.stringify({
          message: "Continuing the existing conversation.",
          actions: [],
        }),
      })),
    };
    const resumeThread = vi.fn(() => resumed);
    const service = createCodexAssistantService({
      authenticated: true,
      client: { startThread: vi.fn(), resumeThread },
      threadStore: {
        read: () => "thr_existing_123",
        write: vi.fn(),
        clear,
      },
    });

    await service.respond(payload);
    expect(resumeThread).toHaveBeenCalledWith(
      "thr_existing_123",
      expect.objectContaining({ sandboxMode: "read-only" }),
    );
    service.resetThread();
    expect(clear).toHaveBeenCalledOnce();
    expect(service.threadId).toBeNull();
    expect(service.status).toBe("configured");
  });

  it("does not run local actions when the Codex turn fails", async () => {
    const service = createCodexAssistantService({
      authenticated: true,
      client: {
        startThread: () => ({
          id: null,
          run: vi.fn(async () => {
            throw new Error("401 Unauthorized");
          }),
        }),
        resumeThread: vi.fn(),
      },
      threadStore: {
        read: () => null,
        write: vi.fn(),
        clear: vi.fn(),
      },
    });

    await expect(service.respond(payload)).rejects.toMatchObject({
      name: "AssistantProviderUnavailableError",
      reason: "authentication_failed",
      retryable: false,
    });
  });

  it("clears a stale stored thread and retries once on a fresh thread", async () => {
    const clear = vi.fn();
    const write = vi.fn();
    const staleThread = {
      id: "thr_stale_12345678",
      run: vi.fn(async () => {
        throw new Error(
          "Codex Exec exited with code 1: thread not found: thr_stale_12345678",
        );
      }),
    };
    const freshThread = {
      id: "thr_fresh_12345678",
      run: vi.fn(async () => ({
        finalResponse: JSON.stringify({
          message: "I recovered in a fresh Codex conversation.",
          actions: [],
        }),
      })),
    };
    const startThread = vi.fn(() => freshThread);
    const resumeThread = vi.fn(() => staleThread);
    const service = createCodexAssistantService({
      authenticated: true,
      client: { startThread, resumeThread },
      threadStore: {
        read: () => "thr_stale_12345678",
        write,
        clear,
      },
    });

    await expect(service.respond(payload)).resolves.toMatchObject({
      provider: "codex",
      configured: true,
      threadId: "thr_fresh_12345678",
      message: "I recovered in a fresh Codex conversation.",
    });
    expect(resumeThread).toHaveBeenCalledOnce();
    expect(staleThread.run).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledOnce();
    expect(startThread).toHaveBeenCalledOnce();
    expect(freshThread.run).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith("thr_fresh_12345678");
    expect(service.threadId).toBe("thr_fresh_12345678");
    expect(service.status).toBe("connected");
  });

  it("does not discard a stored thread for an authentication failure", async () => {
    const clear = vi.fn();
    const startThread = vi.fn();
    const service = createCodexAssistantService({
      authenticated: true,
      client: {
        startThread,
        resumeThread: () => ({
          id: "thr_existing_123",
          run: vi.fn(async () => {
            throw new Error("401 Unauthorized");
          }),
        }),
      },
      threadStore: {
        read: () => "thr_existing_123",
        write: vi.fn(),
        clear,
      },
    });

    await expect(service.respond(payload)).rejects.toMatchObject({
      name: "AssistantProviderUnavailableError",
      reason: "authentication_failed",
    });
    expect(clear).not.toHaveBeenCalled();
    expect(startThread).not.toHaveBeenCalled();
    expect(service.threadId).toBe("thr_existing_123");
    expect(service.status).toBe("configured");
  });

  it("does not resurrect an in-flight thread after reset", async () => {
    let finishTurn;
    const run = vi.fn(
      () =>
        new Promise((resolve) => {
          finishTurn = resolve;
        }),
    );
    const thread = { id: "thr_inflight_123", run };
    const write = vi.fn();
    const clear = vi.fn();
    const startThread = vi.fn(() => thread);
    const service = createCodexAssistantService({
      authenticated: true,
      client: { startThread, resumeThread: vi.fn() },
      threadStore: {
        read: () => null,
        write,
        clear,
      },
    });

    const pending = service.respond(payload);
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    service.resetThread();
    finishTurn({
      finalResponse: JSON.stringify({
        message: "The old turn completed.",
        actions: [],
      }),
    });

    await expect(pending).resolves.toMatchObject({
      provider: "codex",
      configured: true,
      message: "The old turn completed.",
    });
    expect(await pending).not.toHaveProperty("threadId");
    expect(startThread).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
    expect(clear).toHaveBeenCalledOnce();
    expect(service.threadId).toBeNull();
    expect(service.status).toBe("configured");
  });

  it("returns a successful turn even when its thread pointer cannot be persisted", async () => {
    const service = createCodexAssistantService({
      authenticated: true,
      client: {
        startThread: () => ({
          id: "thr_memory_only_123",
          run: vi.fn(async () => ({
            finalResponse: JSON.stringify({
              message: "The turn still succeeded.",
              actions: [],
            }),
          })),
        }),
        resumeThread: vi.fn(),
      },
      threadStore: {
        read: () => null,
        write: () => {
          throw new Error("read-only filesystem");
        },
        clear: vi.fn(),
      },
    });

    await expect(service.respond(payload)).resolves.toMatchObject({
      provider: "codex",
      configured: true,
      threadId: "thr_memory_only_123",
      message: "The turn still succeeded.",
    });
    expect(service.threadId).toBe("thr_memory_only_123");
    expect(service.status).toBe("connected");
  });
});
