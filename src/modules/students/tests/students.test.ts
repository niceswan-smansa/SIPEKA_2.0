import { describe, expect, it } from "vitest";

import {
  normalizeStudentIdentifier,
  normalizeStudentName,
  studentCreateSchema,
} from "../domain/students";

describe("student domain", () => {
  it("normalizes names and identifiers", () => {
    expect(normalizeStudentName("  Nabila   Putri ")).toBe("nabila putri");
    expect(normalizeStudentIdentifier(" 00123 ")).toBe("00123");
  });

  it("rejects alumni and invalid student forms", () => {
    expect(
      studentCreateSchema.safeParse({
        fullName: "Nabila Sintetis",
        nis: "10001",
        nisn: "0012345678",
        gender: "P",
        grade: "ALUMNI",
        classId: "20000000-0000-4000-8000-000000000001",
        yearEntered: 2026,
        isActive: true,
      }).success,
    ).toBe(false);
    expect(
      studentCreateSchema.safeParse({
        fullName: "Siswa Sintetis",
        nis: "10002",
        nisn: "0012345679",
        gender: "L",
        grade: "XI",
        classId: "20000000-0000-4000-8000-000000000001",
        yearEntered: 2026,
        isActive: true,
      }).success,
    ).toBe(true);
  });

  it("accepts missing NIS, NISN, or both", () => {
    const base = {
      fullName: "Siswa Tanpa Identifier",
      gender: "L",
      grade: "XI",
      classId: "20000000-0000-4000-8000-000000000001",
      yearEntered: 2026,
      isActive: true,
    };
    expect(studentCreateSchema.safeParse({ ...base, nis: "", nisn: "0012345678" }).success).toBe(
      true,
    );
    expect(studentCreateSchema.safeParse({ ...base, nis: "10001", nisn: "" }).success).toBe(true);
    expect(studentCreateSchema.safeParse({ ...base, nis: "", nisn: "" }).success).toBe(true);
    expect(studentCreateSchema.safeParse({ ...base, nis: "10001", nisn: "123" }).success).toBe(
      false,
    );
  });
});
