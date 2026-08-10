import express from "express";
import { createDashboardAssistantService } from "./dashboardAssistant.js";
import {
  InputValidationError,
  validateAssistantRequest,
} from "./validation.js";
import {
  RecommendationPlanningUnavailableError,
  validateRecommendationPlanRequest,
} from "./recommendationPlanner.js";
import { createPhotoDiscoveryService } from "./photoDiscovery.js";
import { createBookDiscoveryService } from "./bookDiscovery.js";
import { createTvDiscoveryService } from "./tvDiscovery.js";
import { AssistantProviderUnavailableError } from "./providerErrors.js";

const DEFAULT_DASHBOARD_ORIGINS = [
  "http://127.0.0.1:4175",
  "http://localhost:4175",
];
const MAX_REQUESTS_PER_MINUTE = 30;

const allowedDashboardOrigins = () =>
  new Set(
    (process.env.DASHBOARD_ORIGINS || DEFAULT_DASHBOARD_ORIGINS.join(","))
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
      .flatMap((origin) => {
        try {
          return [new URL(origin).origin];
        } catch {
          return [];
        }
      }),
  );

export const isLoopbackAddress = (address = "") =>
  address === "127.0.0.1" ||
  address === "::1" ||
  address === "::ffff:127.0.0.1";

export const isLocalOrigin = (origin) => {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return allowedDashboardOrigins().has(url.origin);
  } catch {
    return false;
  }
};

const localOnly = (req, res, next) => {
  if (!isLoopbackAddress(req.socket.remoteAddress)) {
    return res.status(403).json({ error: "This service is local-only." });
  }

  const origin = req.get("origin");
  if (!isLocalOrigin(origin)) {
    return res.status(403).json({ error: "Origin is not allowed." });
  }

  res.set({
    "Cache-Control": "no-store",
    "Cross-Origin-Resource-Policy": "same-site",
    "Referrer-Policy": "no-referrer",
    Vary: "Origin",
  });
  if (origin) res.set("Access-Control-Allow-Origin", origin);

  if (req.method === "OPTIONS") {
    res.set({
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Max-Age": "600",
    });
    return res.sendStatus(204);
  }

  next();
};

const createRateLimiter = () => {
  const windows = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.socket.remoteAddress || "local";
    const current = windows.get(key);

    if (!current || now - current.startedAt >= 60_000) {
      windows.set(key, { startedAt: now, count: 1 });
      return next();
    }

    current.count += 1;
    if (current.count > MAX_REQUESTS_PER_MINUTE) {
      res.set("Retry-After", "60");
      return res.status(429).json({
        error: "Too many assistant requests. Please try again shortly.",
      });
    }
    next();
  };
};

export const createApp = ({
  assistantService = createDashboardAssistantService(),
  photoDiscoveryService = createPhotoDiscoveryService(),
  bookDiscoveryService = createBookDiscoveryService(),
  tvDiscoveryService = createTvDiscoveryService(),
} = {}) => {
  const app = express();
  const assistantProvider =
    assistantService.provider ??
    (assistantService.configured ? "openai" : "local");
  app.disable("x-powered-by");
  app.disable("etag");
  app.set("trust proxy", false);
  app.use(localOnly);
  app.use(express.json({ limit: "3mb", strict: true }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      status: "ready",
      providerConfigured: assistantService.configured,
      provider: assistantProvider,
    });
  });

  app.get("/api/config", (_req, res) => {
    res.json({
      assistant: {
        configured: assistantService.configured,
        provider: assistantProvider,
        status:
          assistantService.status ??
          (assistantService.configured ? "configured" : "local"),
        ...(assistantService.configured
          ? { model: assistantService.model }
          : {}),
        ...(assistantProvider === "openai"
          ? { reasoningEffort: "low" }
          : {}),
        localOnly: true,
        allowedActions: [
          "open_app",
          "select_note",
          "set_app_view",
          "search_app",
          "select_item",
          "update_library",
          "propose_note_edit",
          "propose_note_create",
          "update_preferences",
        ],
        preferenceUpdatesRequireReview: true,
        noteUpdatesRequireReview: true,
        ...(assistantProvider === "openai" ? { openAIStore: false } : {}),
        ...(assistantProvider === "codex"
          ? {
              codexAuthenticated: assistantService.configured,
              codexThreadPersistent: true,
              codexSandbox: assistantService.sandbox ?? "read-only",
              ...(assistantService.threadId
                ? { codexThreadId: assistantService.threadId }
                : {}),
            }
          : {}),
        photoDiscovery:
          photoDiscoveryService.sources ?? [
            "Openverse",
            "Wikimedia Commons",
            "Art Institute of Chicago",
            "The Met Open Access",
          ],
        bookDiscovery: "open-library",
        tvDiscovery: {
          sources:
            tvDiscoveryService.sources ?? ["Apple Search", "TVmaze"],
          region: tvDiscoveryService.region ?? "US",
          tmdbConfigured: Boolean(tvDiscoveryService.tmdbConfigured),
          providerAvailability: tvDiscoveryService.tmdbConfigured
            ? "TMDB + JustWatch"
            : "TVmaze network and web-channel data",
        },
      },
    });
  });

  app.post("/api/codex/thread/reset", createRateLimiter(), (_req, res) => {
    if (
      assistantProvider !== "codex" ||
      typeof assistantService.resetThread !== "function"
    ) {
      return res.status(409).json({
        error: "The Codex provider is not active.",
      });
    }
    assistantService.resetThread();
    res.json({ ok: true, status: "new_thread_ready" });
  });

  app.post(
    "/api/recommendations/plan",
    createRateLimiter(),
    async (req, res) => {
      try {
        const payload = validateRecommendationPlanRequest(req.body);
        const controller = new AbortController();
        req.once("aborted", () => controller.abort());
        const result = await assistantService.planRecommendations(
          payload,
          controller.signal,
        );
        if (!res.headersSent && !controller.signal.aborted) {
          res.json(result);
        }
      } catch (error) {
        if (error instanceof InputValidationError) {
          return res.status(400).json({ error: error.message });
        }
        if (req.aborted) return;
        if (error instanceof RecommendationPlanningUnavailableError) {
          console.warn(
            `[MacDashboard recommendations] AI plan not returned (${error.reason}).`,
          );
          return res.status(error.statusCode).json({
            error:
              "AI recommendation planning did not complete. No local fallback was used; your existing recommendations are unchanged.",
            reason: error.reason,
            retryable: error.retryable,
          });
        }
        console.warn(
          "[MacDashboard recommendations] Planning request failed.",
          error instanceof Error ? error.name : "UnknownError",
        );
        res.status(502).json({
          error:
            "AI recommendation planning is temporarily unavailable. Saved recommendations remain available.",
        });
      }
    },
  );

  app.get("/api/discover/photos", createRateLimiter(), async (req, res) => {
    const query =
      typeof req.query.q === "string"
        ? req.query.q.replace(/\s+/g, " ").trim()
        : "";
    if (query.length < 2 || query.length > 160) {
      return res.status(400).json({
        error: "Photo discovery query must contain 2 to 160 characters.",
      });
    }

    const controller = new AbortController();
    req.once("aborted", () => controller.abort());
    try {
      const items = await photoDiscoveryService.search(
        query,
        controller.signal,
      );
      if (!res.headersSent && !controller.signal.aborted) {
        const sources =
          photoDiscoveryService.sources ?? [
            "Openverse",
            "Wikimedia Commons",
            "Art Institute of Chicago",
            "The Met Open Access",
          ];
        res.json({
          source: sources.join(", "),
          sources,
          query,
          items,
        });
      }
    } catch (error) {
      if (req.aborted) return;
      console.warn(
        "[MacDashboard photos] Open image discovery unavailable.",
        error instanceof Error ? error.name : "UnknownError",
      );
      res.status(502).json({
        error:
          "Fresh photo discovery is temporarily unavailable. Saved recommendations remain available.",
      });
    }
  });

  app.get("/api/discover/books", createRateLimiter(), async (req, res) => {
    const query =
      typeof req.query.q === "string"
        ? req.query.q.replace(/\s+/g, " ").trim()
        : "";
    if (query.length < 2 || query.length > 160) {
      return res.status(400).json({
        error: "Book discovery query must contain 2 to 160 characters.",
      });
    }

    const controller = new AbortController();
    req.once("aborted", () => controller.abort());
    try {
      const items = await bookDiscoveryService.search(
        query,
        controller.signal,
      );
      if (!res.headersSent && !controller.signal.aborted) {
        res.json({ source: "Open Library", query, items });
      }
    } catch (error) {
      if (req.aborted) return;
      console.warn(
        "[MacDashboard books] Open Library discovery unavailable.",
        error instanceof Error ? error.name : "UnknownError",
      );
      res.status(502).json({
        error:
          "Fresh book discovery is temporarily unavailable. Saved recommendations remain available.",
      });
    }
  });

  app.get("/api/discover/tv", createRateLimiter(), async (req, res) => {
    const query =
      typeof req.query.q === "string"
        ? req.query.q.replace(/\s+/g, " ").trim()
        : "";
    if (query.length < 2 || query.length > 120) {
      return res.status(400).json({
        error: "TV discovery query must contain 2 to 120 characters.",
      });
    }

    const controller = new AbortController();
    req.once("aborted", () => controller.abort());
    try {
      const items = await tvDiscoveryService.search(
        query,
        controller.signal,
      );
      if (!res.headersSent && !controller.signal.aborted) {
        const sources =
          tvDiscoveryService.sources ?? ["Apple Search", "TVmaze"];
        res.json({
          source: sources.join(" + "),
          sources,
          query,
          region: tvDiscoveryService.region ?? "US",
          tmdbConfigured: Boolean(tvDiscoveryService.tmdbConfigured),
          items,
        });
      }
    } catch (error) {
      if (req.aborted) return;
      console.warn(
        "[MacDashboard TV] cross-platform discovery unavailable.",
        error instanceof Error ? error.name : "UnknownError",
      );
      res.status(502).json({
        error:
          "Cross-platform TV discovery is temporarily unavailable. Saved recommendations remain available.",
      });
    }
  });

  app.post("/api/assistant", createRateLimiter(), async (req, res) => {
    try {
      const payload = validateAssistantRequest(req.body);
      const controller = new AbortController();
      req.once("aborted", () => controller.abort());
      const result = await assistantService.respond(payload, controller.signal);

      if (!res.headersSent && !controller.signal.aborted) {
        res.json(result);
      }
    } catch (error) {
      if (error instanceof InputValidationError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      if (req.aborted) return;

      if (error instanceof AssistantProviderUnavailableError) {
        console.warn(
          `[MacDashboard assistant] AI response not returned (${error.reason}).`,
        );
        return res.status(error.statusCode).json({
          error:
            "The AI request did not complete. No local fallback was used and nothing was changed.",
          reason: error.reason,
          retryable: error.retryable,
        });
      }

      console.error(
        "[MacDashboard assistant] Request failed.",
        error instanceof Error ? error.name : "UnknownError",
      );
      res.status(500).json({
        error: "The assistant request could not be completed.",
      });
    }
  });

  app.use((error, _req, res, _next) => {
    if (
      error?.type === "entity.too.large" ||
      error?.status === 413 ||
      error?.statusCode === 413
    ) {
      return res.status(413).json({ error: "Request body is too large." });
    }
    if (error instanceof SyntaxError) {
      return res.status(400).json({ error: "Request body must be valid JSON." });
    }
    console.error(
      "[MacDashboard assistant] Unhandled request error.",
      error instanceof Error ? error.name : "UnknownError",
    );
    res.status(500).json({ error: "Unexpected local service error." });
  });

  return app;
};
