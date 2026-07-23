import { describe, expect, it, vi } from "vitest";

import { createSignedState, verifySignedState } from "./signed-state";

describe("signed state", () => {
  it("accepts the intended user and purpose only", () => {
    const token = createSignedState("user-1", "completion", "test-secret", 60);
    expect(
      verifySignedState(token, { purpose: "completion", userId: "user-1" }, "test-secret"),
    ).toBe(true);
    expect(
      verifySignedState(token, { purpose: "completion", userId: "user-2" }, "test-secret"),
    ).toBe(false);
    expect(
      verifySignedState(`${token}x`, { purpose: "completion", userId: "user-1" }, "test-secret"),
    ).toBe(false);
  });

  it("rejects expired state", () => {
    vi.useFakeTimers();
    const token = createSignedState("user-1", "completion", "test-secret", 1);
    vi.advanceTimersByTime(2_000);
    expect(
      verifySignedState(token, { purpose: "completion", userId: "user-1" }, "test-secret"),
    ).toBe(false);
    vi.useRealTimers();
  });
});
