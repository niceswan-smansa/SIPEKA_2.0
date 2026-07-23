import { describe, expect, it } from "vitest";

import { academicYearInputSchema } from "../domain/academic-years";

describe("academic year validation", () => {
  it("requires a strict date range", () => {
    expect(
      academicYearInputSchema.safeParse({
        name: "2027/2028",
        startDate: "2027-07-01",
        endDate: "2027-07-01",
        isActive: false,
      }).success,
    ).toBe(false);
  });
});
