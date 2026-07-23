import { describe, expect, it } from "vitest";

import { monthGrid, moveMonth } from "../domain/dashboard";

describe("dashboard date logic", () => {
  it("keeps selected date separate while moving visible month", () => {
    expect(moveMonth("2026-07-01", 1)).toBe("2026-08-01");
    expect(moveMonth("2026-01-01", -1)).toBe("2025-12-01");
  });

  it("builds a Monday-first leap-month grid", () => {
    expect(monthGrid("2028-02-01")).toMatchObject({ days: 29, month: 2, year: 2028 });
  });
});
