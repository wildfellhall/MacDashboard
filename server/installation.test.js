import { describe, expect, it } from "vitest";
import { resolveSafetyIdentifier } from "./installation.js";

describe("privacy-preserving safety identifier", () => {
  it("hashes a stable local seed without exposing it", () => {
    const first = resolveSafetyIdentifier("test-installation");
    const second = resolveSafetyIdentifier("test-installation");

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("test-installation");
  });
});
