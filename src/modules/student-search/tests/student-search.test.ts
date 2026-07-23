import { describe, expect, it } from "vitest";

import { parseStudentSearchParams } from "../domain/student-search";

describe("student search query", () => {
  it("supports partial optional filters and bounded pagination", () => {
    const parsed = parseStudentSearchParams({
      q: "  nabil  ",
      grade: "XI",
      classId: "20000000-0000-4000-8000-000000000001",
      status: "inactive",
      yearEntered: "2026",
      page: "2",
    });
    expect(parsed.query).toMatchObject({
      search: "nabil",
      grade: "XI",
      classId: "20000000-0000-4000-8000-000000000001",
      active: false,
      yearEntered: 2026,
      page: 2,
      pageSize: 20,
    });
  });

  it("rejects invalid page boundaries", () => {
    expect(() => parseStudentSearchParams({ page: "0" })).toThrow();
  });
});
