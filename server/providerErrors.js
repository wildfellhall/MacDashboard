export class AssistantProviderUnavailableError extends Error {
  constructor(reason, { retryable = true, cause } = {}) {
    super("The AI provider did not complete the request.", {
      ...(cause ? { cause } : {}),
    });
    this.name = "AssistantProviderUnavailableError";
    this.reason = reason;
    this.retryable = retryable;
    this.statusCode = 503;
  }
}
