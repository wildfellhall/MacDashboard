import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { Codex } from "@openai/codex-sdk";
import { createLocalFallback } from "./fallback.js";
import {
  ASSISTANT_RESULT_SCHEMA,
  buildCodexPrompt,
} from "./prompt.js";
import {
  buildRecommendationPlanPrompt,
  RECOMMENDATION_PLAN_SCHEMA,
  RecommendationPlanningUnavailableError,
  validateRecommendationPlanResult,
} from "./recommendationPlanner.js";
import { validateModelResult } from "./validation.js";
import { AssistantProviderUnavailableError } from "./providerErrors.js";

const DEFAULT_TIMEOUT_MS = 120_000;
const THREAD_ID_PATTERN = /^(?!-)[a-zA-Z0-9_-]{8,160}$/;
const STALE_THREAD_PATTERN =
  /(?:thread|session)\s+(?:was\s+)?not found|no (?:saved )?session found|failed to resume (?:the )?(?:codex |exec-server )?session|failed to resume session from/i;
const IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const defaultThreadPath = () =>
  resolve(process.cwd(), ".macdashboard", "codex-thread-id");
const defaultAttachmentDirectory = () =>
  resolve(process.cwd(), ".macdashboard", "codex-attachments");

const createThreadStore = (path = defaultThreadPath()) => ({
  read() {
    try {
      const value = readFileSync(path, "utf8").trim();
      return THREAD_ID_PATTERN.test(value) ? value : null;
    } catch {
      return null;
    }
  },
  write(threadId) {
    if (!THREAD_ID_PATTERN.test(threadId)) return;
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    writeFileSync(path, `${threadId}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  },
  clear() {
    try {
      unlinkSync(path);
    } catch {
      // There may not be a stored dashboard thread yet.
    }
  },
});

export const detectCodexAuthentication = ({
  codexPath = process.env.CODEX_PATH || "codex",
  spawn = spawnSync,
} = {}) => {
  try {
    const result = spawn(codexPath, ["login", "status"], {
      encoding: "utf8",
      timeout: 5_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return result.status === 0;
  } catch {
    return false;
  }
};

const errorText = (error) => {
  const messages = [];
  let current = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (current instanceof Error) messages.push(current.message);
    else messages.push(String(current));
    current =
      typeof current === "object" && current !== null ? current.cause : null;
  }
  return messages.join("\n").toLowerCase();
};

const classifyCodexError = (error, timedOut) => {
  const message = errorText(error);
  if (timedOut || error?.name === "AbortError" || /timed? out/.test(message)) {
    return { reason: "timeout", retryable: true };
  }
  if (
    /unauthorized|authentication|not logged in|login required|401|403/.test(
      message,
    )
  ) {
    return { reason: "authentication_failed", retryable: false };
  }
  if (/rate.?limit|usage limit|429/.test(message)) {
    return { reason: "rate_limited", retryable: true };
  }
  if (/refus/.test(message)) {
    return { reason: "refused", retryable: false };
  }
  return { reason: "provider_unavailable", retryable: true };
};

const parseCodexResult = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Codex returned an empty response.");
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Codex returned an invalid structured response.");
  }
};

const latestImage = (payload) =>
  [...payload.messages]
    .reverse()
    .find((message) => message.role === "user" && message.image)?.image;

const materializeImage = (
  payload,
  directory = defaultAttachmentDirectory(),
) => {
  const image = latestImage(payload);
  if (!image) return null;
  const extension = IMAGE_EXTENSIONS[image.mimeType];
  const encoded = image.dataUrl.split(",")[1];
  if (!extension || !encoded) return null;
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = resolve(directory, `${randomUUID()}.${extension}`);
  writeFileSync(path, Buffer.from(encoded, "base64"), {
    mode: 0o600,
    flag: "wx",
  });
  return path;
};

const removeMaterializedImage = (path) => {
  if (!path) return;
  try {
    unlinkSync(path);
  } catch {
    // The bounded temporary attachment is already gone.
  }
};

export const createCodexAssistantService = ({
  authenticated = detectCodexAuthentication(),
  client = authenticated
    ? new Codex({
        ...(process.env.CODEX_PATH
          ? { codexPathOverride: process.env.CODEX_PATH }
          : {}),
      })
    : null,
  workingDirectory = process.cwd(),
  model = process.env.CODEX_MODEL || "",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  threadStore = createThreadStore(),
  attachmentDirectory = defaultAttachmentDirectory(),
} = {}) => {
  const configured = Boolean(authenticated && client);
  let connected = false;
  let threadId = threadStore.read();
  let thread = null;
  let threadGeneration = 0;
  let queue = Promise.resolve();
  let plannerQueue = Promise.resolve();

  const threadOptions = {
    workingDirectory,
    skipGitRepoCheck: true,
    sandboxMode: "read-only",
    networkAccessEnabled: false,
    webSearchMode: "disabled",
    approvalPolicy: "never",
    modelReasoningEffort: "low",
    ...(model ? { model } : {}),
  };

  const currentThread = () => {
    if (thread) return thread;
    thread = threadId
      ? client.resumeThread(threadId, threadOptions)
      : client.startThread(threadOptions);
    return thread;
  };

  const clearStoredThread = () => {
    try {
      threadStore.clear();
    } catch {
      console.warn(
        "[MacDashboard assistant] Could not clear the stored Codex thread pointer.",
      );
    }
  };

  const persistThread = (activeThreadId) => {
    try {
      threadStore.write(activeThreadId);
    } catch {
      console.warn(
        "[MacDashboard assistant] Could not persist the active Codex thread pointer.",
      );
    }
  };

  const run = async (payload, requestSignal) => {
    if (!configured) return createLocalFallback(payload);
    if (requestSignal?.aborted) {
      const error = new Error("Assistant request aborted.");
      error.name = "AbortError";
      throw error;
    }

    const controller = new AbortController();
    let timedOut = false;
    const abortFromRequest = () => controller.abort();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    requestSignal?.addEventListener("abort", abortFromRequest, { once: true });
    let imagePath = null;

    try {
      imagePath = materializeImage(payload, attachmentDirectory);
      const input = imagePath
        ? [
            { type: "text", text: buildCodexPrompt(payload) },
            { type: "local_image", path: imagePath },
          ]
        : buildCodexPrompt(payload);

      let activeThread = currentThread();
      let activeGeneration = threadGeneration;
      const executeTurn = async () => {
        const result = await activeThread.run(input, {
          outputSchema: ASSISTANT_RESULT_SCHEMA,
          signal: controller.signal,
        });
        return validateModelResult(
          parseCodexResult(result.finalResponse),
          payload.notes,
          payload.recommendations,
        );
      };

      let validated;
      try {
        validated = await executeTurn();
      } catch (error) {
        const canRecoverStaleThread =
          !timedOut &&
          !controller.signal.aborted &&
          Boolean(threadId) &&
          activeThread === thread &&
          activeGeneration === threadGeneration &&
          STALE_THREAD_PATTERN.test(errorText(error));
        if (!canRecoverStaleThread) throw error;

        console.warn(
          "[MacDashboard assistant] Stored Codex thread is unavailable; starting a fresh dashboard thread.",
        );
        thread = null;
        threadId = null;
        connected = false;
        threadGeneration += 1;
        clearStoredThread();
        activeThread = currentThread();
        activeGeneration = threadGeneration;
        validated = await executeTurn();
      }

      let activeThreadId = null;
      if (
        activeThread === thread &&
        activeGeneration === threadGeneration
      ) {
        activeThreadId = activeThread.id;
        if (activeThreadId && activeThreadId !== threadId) {
          threadId = activeThreadId;
          persistThread(activeThreadId);
        }
        connected = true;
      }

      return {
        ...validated,
        provider: "codex",
        model: model || "Codex account default",
        configured: true,
        ...(activeThreadId ? { threadId: activeThreadId } : {}),
      };
    } catch (error) {
      if (requestSignal?.aborted) throw error;
      connected = false;
      const failure = classifyCodexError(error, timedOut);
      console.warn(
        `[MacDashboard assistant] Codex request unavailable (${failure.reason}); no local fallback was used.`,
      );
      throw new AssistantProviderUnavailableError(failure.reason, {
        retryable: failure.retryable,
        cause: error,
      });
    } finally {
      clearTimeout(timer);
      requestSignal?.removeEventListener("abort", abortFromRequest);
      removeMaterializedImage(imagePath);
    }
  };

  const respond = (payload, requestSignal) => {
    const pending = queue.then(
      () => run(payload, requestSignal),
      () => run(payload, requestSignal),
    );
    queue = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  };

  const runRecommendationPlan = async (payload, requestSignal) => {
    if (!configured) {
      throw new RecommendationPlanningUnavailableError("not_configured", {
        retryable: false,
      });
    }
    if (requestSignal?.aborted) {
      const error = new Error("Recommendation planning aborted.");
      error.name = "AbortError";
      throw error;
    }

    const controller = new AbortController();
    let timedOut = false;
    const abortFromRequest = () => controller.abort();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    requestSignal?.addEventListener("abort", abortFromRequest, { once: true });

    const executePlan = async () => {
      const planningThread = client.startThread(threadOptions);
      const result = await planningThread.run(
        buildRecommendationPlanPrompt(payload),
        {
          outputSchema: RECOMMENDATION_PLAN_SCHEMA,
          signal: controller.signal,
        },
      );
      return {
        ...validateRecommendationPlanResult(
          parseCodexResult(result.finalResponse),
          payload,
        ),
        provider: "codex",
        model: model || "Codex account default",
        aiPowered: true,
      };
    };

    try {
      return await executePlan();
    } catch (error) {
      if (requestSignal?.aborted) throw error;
      let failure = classifyCodexError(error, timedOut);
      if (
        failure.reason === "provider_unavailable" &&
        !controller.signal.aborted
      ) {
        try {
          return await executePlan();
        } catch (retryError) {
          if (requestSignal?.aborted) throw retryError;
          failure = classifyCodexError(retryError, timedOut);
        }
      }
      console.warn(
        `[MacDashboard recommendations] Codex planning unavailable (${failure.reason}); no local plan was produced.`,
      );
      throw new RecommendationPlanningUnavailableError(failure.reason, {
        retryable: failure.retryable,
        cause: error,
      });
    } finally {
      clearTimeout(timer);
      requestSignal?.removeEventListener("abort", abortFromRequest);
    }
  };

  const planRecommendations = (payload, requestSignal) => {
    const pending = plannerQueue.then(
      () => runRecommendationPlan(payload, requestSignal),
      () => runRecommendationPlan(payload, requestSignal),
    );
    plannerQueue = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  };

  const resetThread = () => {
    thread = null;
    threadId = null;
    connected = false;
    threadGeneration += 1;
    clearStoredThread();
  };

  return {
    configured,
    provider: "codex",
    model: model || "Codex account default",
    get status() {
      return connected ? "connected" : configured ? "configured" : "local";
    },
    get threadId() {
      return threadId;
    },
    sandbox: "read-only",
    respond,
    planRecommendations,
    resetThread,
  };
};
