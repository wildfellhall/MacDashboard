import { once } from "node:events";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createAssistantService } from "./assistant.js";
import { RecommendationPlanningUnavailableError } from "./recommendationPlanner.js";

const servers = [];
const assistantPayload = {
  messages: [{ role: "user", content: "Open Books" }],
  profile: {
    interests: [],
    moods: [],
    favorites: [],
    avoid: [],
  },
  notes: [],
  tasteSignals: [],
  reviews: [],
  recommendations: [],
};

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve) => server.close(() => resolve(undefined))),
    ),
  );
});

const startServer = async (options = {}) => {
  const app = createApp({
    assistantService: createAssistantService({ apiKey: "", client: null }),
    ...options,
  });
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return `http://127.0.0.1:${address.port}`;
};

const createFakeCodexService = () => {
  let connected = true;
  let threadId = "thr_dashboard_12345678";
  let resetCalls = 0;

  return {
    configured: true,
    provider: "codex",
    model: "Codex account default",
    sandbox: "read-only",
    get status() {
      return connected ? "connected" : "configured";
    },
    get threadId() {
      return threadId;
    },
    get resetCalls() {
      return resetCalls;
    },
    respond: async () => ({
      message: "Ready.",
      actions: [],
      provider: "codex",
      model: "Codex account default",
      configured: true,
      ...(threadId ? { threadId } : {}),
    }),
    planRecommendations: async (payload) => ({
      summary: `A balanced ${payload.domain} slate.`,
      candidates: [
        {
          title: "The Summer Book",
          creator: "Tove Jansson",
          mediaType: "book",
          searchQuery: "The Summer Book Tove Jansson",
          fitScore: 90,
          rationale: "A varied whole-profile fit.",
          evidenceNotes: [],
          facets: ["quiet", "family"],
        },
      ],
      provider: "codex",
      aiPowered: true,
    }),
    resetThread() {
      resetCalls += 1;
      connected = false;
      threadId = null;
    },
  };
};

describe.runIf(process.env.RUN_HTTP_TESTS === "1")(
  "local assistant HTTP boundary",
  () => {
  it("reports authenticated persistent Codex configuration", async () => {
    const assistantService = createFakeCodexService();
    const base = await startServer({ assistantService });
    const response = await fetch(`${base}/api/config`, {
      headers: { Origin: "http://127.0.0.1:4175" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      assistant: {
        configured: true,
        provider: "codex",
        status: "connected",
        model: "Codex account default",
        localOnly: true,
        codexAuthenticated: true,
        codexThreadPersistent: true,
        codexSandbox: "read-only",
        codexThreadId: "thr_dashboard_12345678",
      },
    });
  });

  it("resets only the active Codex thread pointer over the local HTTP boundary", async () => {
    const assistantService = createFakeCodexService();
    const base = await startServer({ assistantService });
    const reset = await fetch(`${base}/api/codex/thread/reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:4175",
      },
      body: "{}",
    });

    expect(reset.status).toBe(200);
    expect(await reset.json()).toEqual({
      ok: true,
      status: "new_thread_ready",
    });
    expect(assistantService.resetCalls).toBe(1);
    expect(assistantService.threadId).toBeNull();

    const config = await fetch(`${base}/api/config`, {
      headers: { Origin: "http://127.0.0.1:4175" },
    });
    const configBody = await config.json();
    expect(configBody.assistant).toMatchObject({
      configured: true,
      provider: "codex",
      status: "configured",
      codexAuthenticated: true,
      codexThreadPersistent: true,
      codexSandbox: "read-only",
    });
    expect(configBody.assistant).not.toHaveProperty("codexThreadId");
  });

  it("accepts the dashboard origin and rejects a hostile localhost port", async () => {
    const base = await startServer();
    const allowed = await fetch(`${base}/api/health`, {
      headers: { Origin: "http://127.0.0.1:4175" },
    });
    const rejected = await fetch(`${base}/api/health`, {
      headers: { Origin: "http://localhost:9999" },
    });

    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({
      ok: true,
      providerConfigured: false,
    });
    const config = await fetch(`${base}/api/config`, {
      headers: { Origin: "http://127.0.0.1:4175" },
    });
    const configBody = await config.json();
    expect(configBody.assistant.allowedActions).toContain(
      "propose_note_create",
    );
    expect(configBody.assistant.noteUpdatesRequireReview).toBe(true);
    expect(rejected.status).toBe(403);
  });

  it("validates an assistant request through the real Express listener", async () => {
    const base = await startServer();
    const response = await fetch(`${base}/api/assistant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:4175",
      },
      body: JSON.stringify(assistantPayload),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      provider: "local",
      configured: false,
      actions: [{ type: "open_app", app: "books" }],
    });
  });

  it("validates and serves a structured AI recommendation plan", async () => {
    const base = await startServer({
      assistantService: createFakeCodexService(),
    });
    const response = await fetch(`${base}/api/recommendations/plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:4175",
      },
      body: JSON.stringify({
        domain: "books",
        profile: {
          interests: ["literary fiction"],
          moods: ["contemplative"],
          favorites: ["precise prose"],
          avoid: ["cynical endings"],
        },
        notes: [],
        tasteDossier: {
          currentNoteCount: 0,
          evidenceNoteCount: 0,
          evidenceCount: 0,
          evidence: [],
        },
        anchorTitles: ["Little Women"],
        knownTitles: [],
        dismissedTitles: [],
        historyTitles: [],
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      provider: "codex",
      aiPowered: true,
      candidates: [
        expect.objectContaining({
          title: "The Summer Book",
          searchQuery: "The Summer Book Tove Jansson",
        }),
      ],
    });
  });

  it("returns an AI error instead of a local recommendation fallback", async () => {
    const assistantService = createFakeCodexService();
    assistantService.planRecommendations = async () => {
      throw new RecommendationPlanningUnavailableError("timeout", {
        retryable: true,
      });
    };
    const base = await startServer({ assistantService });
    const response = await fetch(`${base}/api/recommendations/plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:4175",
      },
      body: JSON.stringify({
        domain: "books",
        profile: {
          interests: ["literary fiction"],
          moods: ["contemplative"],
          favorites: ["precise prose"],
          avoid: [],
        },
        notes: [],
        tasteDossier: {
          currentNoteCount: 0,
          evidenceNoteCount: 0,
          evidenceCount: 0,
          evidence: [],
        },
        anchorTitles: [],
        knownTitles: [],
        dismissedTitles: [],
        historyTitles: [],
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      reason: "timeout",
      retryable: true,
      error: expect.stringMatching(/No local fallback was used/i),
    });
    expect(body).not.toHaveProperty("provider", "local");
    expect(body).not.toHaveProperty("candidates");
  });

  it("handles preflight, malformed JSON, and oversized bodies safely", async () => {
    const base = await startServer();
    const preflight = await fetch(`${base}/api/assistant`, {
      method: "OPTIONS",
      headers: { Origin: "http://127.0.0.1:4175" },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toContain(
      "POST",
    );

    const malformed = await fetch(`${base}/api/assistant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:4175",
      },
      body: "{",
    });
    expect(malformed.status).toBe(400);

    const oversized = await fetch(`${base}/api/assistant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://127.0.0.1:4175",
      },
      body: JSON.stringify({ payload: "x".repeat(3_300_000) }),
    });
    expect(oversized.status).toBe(413);
  });

  it("rate-limits repeated assistant requests without returning actions", async () => {
    const base = await startServer();
    const responses = [];
    for (let index = 0; index < 31; index += 1) {
      responses.push(
        await fetch(`${base}/api/assistant`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://127.0.0.1:4175",
          },
          body: JSON.stringify(assistantPayload),
        }),
      );
    }

    expect(responses.slice(0, 30).every((response) => response.status === 200))
      .toBe(true);
    expect(responses[30].status).toBe(429);
    expect(await responses[30].json()).toMatchObject({
      error: expect.stringMatching(/too many/i),
    });
  });

  it("discovers photos only through an explicit bounded query", async () => {
    const searches = [];
    const base = await startServer({
      photoDiscoveryService: {
        sources: [
          "Openverse",
          "Wikimedia Commons",
          "Art Institute of Chicago",
          "The Met Open Access",
        ],
        search: async (query) => {
          searches.push(query);
          return [
            {
              id: "commons-42",
              title: "Quiet courtyard",
              url: "https://upload.wikimedia.org/quiet.jpg",
              sourceUrl:
                "https://commons.wikimedia.org/wiki/File:Quiet.jpg",
              creator: "Ada Example",
              tags: ["quiet"],
              reason: "Found through Wikimedia Commons.",
              license: "CC BY-SA 4.0",
            },
          ];
        },
      },
    });

    const invalid = await fetch(`${base}/api/discover/photos?q=x`, {
      headers: { Origin: "http://127.0.0.1:4175" },
    });
    expect(invalid.status).toBe(400);
    expect(searches).toHaveLength(0);

    const response = await fetch(
      `${base}/api/discover/photos?q=quiet%20architecture`,
      { headers: { Origin: "http://127.0.0.1:4175" } },
    );
    expect(response.status).toBe(200);
    expect(searches).toEqual(["quiet architecture"]);
    expect(await response.json()).toMatchObject({
      source:
        "Openverse, Wikimedia Commons, Art Institute of Chicago, The Met Open Access",
      sources: [
        "Openverse",
        "Wikimedia Commons",
        "Art Institute of Chicago",
        "The Met Open Access",
      ],
      items: [{ id: "commons-42", license: "CC BY-SA 4.0" }],
    });
  });

  it("discovers books only through an explicit bounded query", async () => {
    const searches = [];
    const base = await startServer({
      bookDiscoveryService: {
        search: async (query) => {
          searches.push(query);
          return [
            {
              id: "openlibrary-ol42w",
              title: "Quiet Rooms",
              author: "Ada Example",
              year: "2021",
              cover: "https://covers.openlibrary.org/b/id/42-L.jpg",
              genres: ["architecture"],
              themes: ["quiet"],
              description: "A catalog match.",
              kind: "discover",
              sourceUrl: "https://openlibrary.org/works/OL42W",
              sourceLabel: "Open Library",
            },
          ];
        },
      },
    });

    const invalid = await fetch(`${base}/api/discover/books?q=x`, {
      headers: { Origin: "http://127.0.0.1:4175" },
    });
    expect(invalid.status).toBe(400);
    expect(searches).toHaveLength(0);

    const response = await fetch(
      `${base}/api/discover/books?q=quiet%20architecture`,
      { headers: { Origin: "http://127.0.0.1:4175" } },
    );
    expect(response.status).toBe(200);
    expect(searches).toEqual(["quiet architecture"]);
    expect(await response.json()).toMatchObject({
      source: "Open Library",
      items: [
        {
          id: "openlibrary-ol42w",
          sourceUrl: "https://openlibrary.org/works/OL42W",
        },
      ],
    });
  });

  it("discovers cross-platform TV titles only through an explicit bounded query", async () => {
    const searches = [];
    const base = await startServer({
      tvDiscoveryService: {
        sources: ["Apple Search", "TVmaze"],
        region: "US",
        tmdbConfigured: false,
        search: async (query) => {
          searches.push(query);
          return [
            {
              id: "apple-movie-42",
              title: "Quiet Future",
              year: "2022",
              artwork: "https://is1-ssl.mzstatic.com/quiet.jpg",
              genres: ["science fiction", "movie"],
              moods: ["thoughtful"],
              runtime: "1 hr 49 min",
              description: "A patient story.",
              kind: "discover",
              sourceUrl: "https://tv.apple.com/us/movie/quiet/umc.42",
              sourceLabel: "View on Apple TV",
            },
          ];
        },
      },
    });

    const invalid = await fetch(`${base}/api/discover/tv?q=x`, {
      headers: { Origin: "http://127.0.0.1:4175" },
    });
    expect(invalid.status).toBe(400);
    expect(searches).toHaveLength(0);

    const response = await fetch(
      `${base}/api/discover/tv?q=thoughtful%20science%20fiction`,
      { headers: { Origin: "http://127.0.0.1:4175" } },
    );
    expect(response.status).toBe(200);
    expect(searches).toEqual(["thoughtful science fiction"]);
    expect(await response.json()).toMatchObject({
      source: "Apple Search + TVmaze",
      sources: ["Apple Search", "TVmaze"],
      region: "US",
      tmdbConfigured: false,
      items: [
        {
          id: "apple-movie-42",
          sourceUrl: "https://tv.apple.com/us/movie/quiet/umc.42",
        },
      ],
    });
  });
  },
);
