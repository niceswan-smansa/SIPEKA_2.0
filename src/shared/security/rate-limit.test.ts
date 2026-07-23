import { describe, expect, it } from "vitest";

import { rateLimitHash } from "./rate-limit-hash";

describe("rate-limit hash", () => {
  it("uses domain separation without returning its input", () => {
    const address = rateLimitHash("same-value", "login-address", "test-key");
    const account = rateLimitHash("same-value", "login-account", "test-key");
    expect(address).not.toBe(account);
    expect(address).not.toContain("same-value");
    expect(address).toMatch(/^[a-f0-9]{64}$/);
  });
});
