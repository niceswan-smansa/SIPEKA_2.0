import { z } from "zod";

import { OPERATIONAL_GRADES, type OperationalGrade } from "@/shared/domain/grades";

export type StudentRecord = {
  id: string;
  nis: string;
  nisn: string;
  fullName: string;
  gender: "L" | "P";
  currentGrade: OperationalGrade | "ALUMNI";
  currentClassId: string | null;
  classNumber: number | null;
  homeroomTeacher: string | null;
  academicYearId: string | null;
  yearEntered: number | null;
  graduationYear: number | null;
  isActive: boolean;
};

export type EnrollmentHistory = {
  id: string;
  academicYearName: string;
  grade: OperationalGrade | "ALUMNI";
  classNumber: number | null;
  startedOn: string;
  endedOn: string | null;
  isCurrent: boolean;
};

export type StudentDetail = StudentRecord & { enrollments: EnrollmentHistory[] };

export type StudentListQuery = {
  search?: string;
  grade?: OperationalGrade;
  classId?: string;
  active?: boolean;
  yearEntered?: number;
  page: number;
  pageSize: number;
};

export type StudentListResult = {
  items: StudentRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export function normalizeStudentName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeStudentIdentifier(value: string) {
  return value.trim();
}

const year = z.coerce.number().int().min(1900).max(2200);
const identityFields = {
  fullName: z.string().trim().min(2).max(160),
  nis: z.string().trim().min(1).max(40),
  nisn: z.string().trim().min(1).max(40),
  gender: z.enum(["L", "P"]),
  yearEntered: year,
};

export const studentCreateSchema = z.object({
  ...identityFields,
  grade: z.enum(OPERATIONAL_GRADES),
  classId: z.uuid(),
  isActive: z.boolean().default(true),
});
export const studentIdentitySchema = z.object({ id: z.uuid(), ...identityFields });
export const studentAcademicSchema = z.object({
  id: z.uuid(),
  grade: z.enum(OPERATIONAL_GRADES),
  classId: z.uuid(),
  isActive: z.boolean(),
});

export type StudentCreateInput = z.infer<typeof studentCreateSchema>;
export type StudentIdentityInput = z.infer<typeof studentIdentitySchema>;
export type StudentAcademicInput = z.infer<typeof studentAcademicSchema>;

export interface StudentRepository {
  search(query: StudentListQuery): Promise<StudentListResult>;
  getDetail(id: string): Promise<StudentDetail | null>;
  create(input: StudentCreateInput): Promise<string>;
  updateIdentity(input: StudentIdentityInput): Promise<void>;
  changeAcademic(input: StudentAcademicInput): Promise<void>;
}
