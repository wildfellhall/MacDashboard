import { expect, test } from "vitest";
import {
  createApp,
  isLocalOrigin,
  isLoopbackAddress,
} from "./app.js";
import { createAssistantService } from "./assistant.js";

const payload = {
  messages: [{ role: "user", content: "Open Books" }],
  profile: {
    interests: ["speculative fiction"],
    moods: ["curious"],
    favorites: [],
    avoid: [],
  },
  activeApp: "messages",
  notes: [],
};

test("creates a local-only app without an API key", () => {
  const assistantService = createAssistantService({
    apiKey: "",
    client: null,
  });
  const app = createApp({ assistantService });

  expect(assistantService.configured).toBe(false);
  expect(typeof app).toBe("function");
});

test("recognizes only loopback socket addresses", () => {
  expect(isLoopbackAddress("127.0.0.1")).toBe(true);
  expect(isLoopbackAddress("::1")).toBe(true);
  expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
  expect(isLoopbackAddress("192.168.1.20")).toBe(false);
});

test("allows only the configured dashboard origins", () => {
  expect(isLocalOrigin(undefined)).toBe(true);
  expect(isLocalOrigin("http://127.0.0.1:4175")).toBe(true);
  expect(isLocalOrigin("http://localhost:4175")).toBe(true);
  expect(isLocalOrigin("http://localhost:5173")).toBe(false);
  expect(isLocalOrigin("http://127.0.0.1:9999")).toBe(false);
  expect(isLocalOrigin("https://example.com")).toBe(false);
  expect(isLocalOrigin("file:///Users/example")).toBe(false);
  expect(isLocalOrigin("not a URL")).toBe(false);
});

test("assistant service returns the deterministic local fallback", async () => {
  const assistantService = createAssistantService({
    apiKey: "",
    client: null,
  });
  const result = await assistantService.respond(payload);

  expect(result).toMatchObject({
    provider: "local",
    actions: [{ type: "open_app", app: "books" }],
  });
});
