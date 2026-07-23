import { z } from "zod";

import { OPERATIONAL_GRADES, type OperationalGrade } from "@/shared/domain/grades";

export { OPERATIONAL_GRADES, type OperationalGrade };

export type ClassRecord = {
  id: string;
  academicYearId: string;
  academicYearName: string;
  academicYearActive: boolean;
  grade: OperationalGrade;
  classNumber: number;
  homeroomTeacher: string | null;
  notes: string | null;
  isActive: boolean;
  activeStudentCount: number;
};

export const classUpdateSchema = z.object({
  id: z.uuid(),
  homeroomTeacher: z.string().trim().max(160),
  notes: z.string().trim().max(500),
  isActive: z.boolean(),
});

export function classDisplayName(grade: OperationalGrade, classNumber: number) {
  if (classNumber < 1 || classNumber > 10) throw new Error("CLASS_NUMBER_INVALID");
  return `${grade}-${classNumber}`;
}

export interface ClassRepository {
  list(query?: { academicYearId?: string; grade?: OperationalGrade }): Promise<ClassRecord[]>;
  update(input: z.infer<typeof classUpdateSchema>): Promise<ClassRecord>;
}
