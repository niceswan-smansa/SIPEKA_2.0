import { describe, expect, it } from "vitest";

import { isIsoDate, moveMonth } from "./dates";

describe("date helpers", () => {
  it("rejects impossible ISO dates", () => {
    expect(isIsoDate("2026-99-99")).toBe(false);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });

  it("clamps selected dates when moving months", () => {
    expect(moveMonth("2026-01-31", 1)).toBe("2026-02-28");
  });
});
