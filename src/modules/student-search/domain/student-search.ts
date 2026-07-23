import { z } from "zod";

import type { StudentListQuery } from "@/modules/students";
import { ALL_GRADES } from "@/shared/domain/grades";

const searchSchema = z.object({
  q: z
    .string()
    .trim()
    .max(80)
    .transform((value) => value.replace(/\s+/g, " "))
    .default(""),
  grade: z.enum(ALL_GRADES).optional(),
  classId: z.uuid().optional(),
  status: z.enum(["active", "inactive", "all"]).optional(),
  yearEntered: z.coerce.number().int().min(1900).max(2200).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type StudentSearchParams = z.infer<typeof searchSchema>;

export function parseStudentSearchParams(input: Record<string, string | undefined>): {
  params: StudentSearchParams;
  query: StudentListQuery;
} {
  const compact = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== ""));
  const params = searchSchema.parse(compact);

  return {
    params,
    query: {
      ...(params.q ? { search: params.q } : {}),
      ...(params.grade ? { grade: params.grade } : {}),
      ...(params.classId ? { classId: params.classId } : {}),
      ...(params.status && params.status !== "all" ? { active: params.status === "active" } : {}),
      ...(params.yearEntered ? { yearEntered: params.yearEntered } : {}),
      page: params.page,
      pageSize: params.pageSize,
    },
  };
}
