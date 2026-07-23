import { describe, expect, it } from "vitest";

import { monthStart, moveMonth, reportRangeSchema } from "../domain/student-attendance";

describe("student attendance", () => {
  it("normalizes calendar months and validates report ranges", () => {
    expect(monthStart("2026-07-23")).toBe("2026-07-01");
    expect(moveMonth("2026-01-01", -1)).toBe("2025-12-01");
    expect(
      reportRangeSchema.safeParse({ startDate: "2026-07-02", endDate: "2026-07-01" }).success,
    ).toBe(false);
  });
});
