import OpenAI from "openai";
import { createLocalFallback } from "./fallback.js";
import {
  ASSISTANT_INSTRUCTIONS,
  ASSISTANT_RESULT_SCHEMA,
  buildAssistantInput,
} from "./prompt.js";
import {
  buildRecommendationPlanPrompt,
  RECOMMENDATION_PLAN_SCHEMA,
  RecommendationPlanningUnavailableError,
  validateRecommendationPlanResult,
} from "./recommendationPlanner.js";
import { validateModelResult } from "./validation.js";
import { resolveSafetyIdentifier } from "./installation.js";
import { AssistantProviderUnavailableError } from "./providerErrors.js";

export const DEFAULT_MODEL = "gpt-5.6-sol";
const DEFAULT_TIMEOUT_MS = 30_000;

class AssistantProviderFailure extends Error {
  constructor(reason, { retryable = false } = {}) {
    super(reason);
    this.name = "AssistantProviderFailure";
    this.reason = reason;
    this.retryable = retryable;
  }
}

const parseOutput = (outputText) => {
  if (typeof outputText !== "string" || !outputText.trim()) {
    throw new AssistantProviderFailure("invalid_response", {
      retryable: true,
    });
  }
  try {
    return JSON.parse(outputText);
  } catch {
    throw new AssistantProviderFailure("invalid_response", {
      retryable: true,
    });
  }
};

const refusalFrom = (response) =>
  response?.output
    ?.flatMap((item) => item?.content ?? [])
    .find((content) => content?.type === "refusal");

const assertCompletedResponse = (response) => {
  if (refusalFrom(response)) {
    throw new AssistantProviderFailure("refused");
  }
  if (response?.status === "incomplete") {
    throw new AssistantProviderFailure("incomplete", { retryable: true });
  }
  if (response?.status === "failed" || response?.error) {
    throw new AssistantProviderFailure("provider_failed", {
      retryable: true,
    });
  }
};

const classifyProviderError = (error, timedOut) => {
  if (error instanceof AssistantProviderFailure) {
    return { reason: error.reason, retryable: error.retryable };
  }
  if (timedOut || error?.name === "AbortError") {
    return { reason: "timeout", retryable: true };
  }
  if (error?.status === 401 || error?.status === 403) {
    return { reason: "authentication_failed", retryable: false };
  }
  if (error?.status === 429) {
    return { reason: "rate_limited", retryable: true };
  }
  if (typeof error?.status === "number" && error.status >= 500) {
    return { reason: "provider_unavailable", retryable: true };
  }
  return { reason: "provider_unavailable", retryable: true };
};

export const createAssistantService = ({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL || DEFAULT_MODEL,
  safetyIdentifier =
    resolveSafetyIdentifier(process.env.OPENAI_SAFETY_IDENTIFIER),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  client = apiKey ? new OpenAI({ apiKey }) : null,
} = {}) => {
  const configured = Boolean(apiKey && client);

  const respond = async (payload, requestSignal) => {
    if (!configured) return createLocalFallback(payload);

    const controller = new AbortController();
    let timedOut = false;
    const abortFromRequest = () => controller.abort();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    requestSignal?.addEventListener("abort", abortFromRequest, { once: true });

    try {
      const response = await client.responses.create(
        {
          model,
          reasoning: { effort: "low" },
          instructions: ASSISTANT_INSTRUCTIONS,
          input: buildAssistantInput(payload),
          max_output_tokens: 900,
          safety_identifier: safetyIdentifier,
          store: false,
          text: {
            verbosity: "low",
            format: {
              type: "json_schema",
              name: "macdashboard_assistant_result",
              strict: true,
              schema: ASSISTANT_RESULT_SCHEMA,
            },
          },
        },
        { signal: controller.signal },
      );

      assertCompletedResponse(response);
      const result = validateModelResult(
        parseOutput(response.output_text),
        payload.notes,
        payload.recommendations,
      );

      return {
        ...result,
        provider: "openai",
        model: response.model || model,
        configured: true,
      };
    } catch (error) {
      if (requestSignal?.aborted) throw error;
      const failure = classifyProviderError(error, timedOut);
      console.warn(
        `[MacDashboard assistant] OpenAI request unavailable (${failure.reason}); no local fallback was used.`,
      );
      throw new AssistantProviderUnavailableError(failure.reason, {
        retryable: failure.retryable,
        cause: error,
      });
    } finally {
      clearTimeout(timer);
      requestSignal?.removeEventListener("abort", abortFromRequest);
    }
  };

  const planRecommendations = async (payload, requestSignal) => {
    if (!configured) {
      throw new RecommendationPlanningUnavailableError("not_configured", {
        retryable: false,
      });
    }

    const controller = new AbortController();
    let timedOut = false;
    const abortFromRequest = () => controller.abort();
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    requestSignal?.addEventListener("abort", abortFromRequest, { once: true });

    try {
      const response = await client.responses.create(
        {
          model,
          reasoning: { effort: "medium" },
          input: buildRecommendationPlanPrompt(payload),
          max_output_tokens: 2_500,
          safety_identifier: safetyIdentifier,
          store: false,
          text: {
            verbosity: "low",
            format: {
              type: "json_schema",
              name: "macdashboard_recommendation_plan",
              strict: true,
              schema: RECOMMENDATION_PLAN_SCHEMA,
            },
          },
        },
        { signal: controller.signal },
      );
      assertCompletedResponse(response);
      return {
        ...validateRecommendationPlanResult(
          parseOutput(response.output_text),
          payload,
        ),
        provider: "openai",
        model: response.model || model,
        aiPowered: true,
      };
    } catch (error) {
      if (requestSignal?.aborted) throw error;
      const failure = classifyProviderError(error, timedOut);
      console.warn(
        `[MacDashboard recommendations] OpenAI planning unavailable (${failure.reason}); no local plan was produced.`,
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

  return {
    configured,
    model,
    respond,
    planRecommendations,
  };
};
