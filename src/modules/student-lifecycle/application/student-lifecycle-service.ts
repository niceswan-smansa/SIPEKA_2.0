import { importPayloadSchema, type ImportRow } from "../domain/student-lifecycle";

export interface StudentLifecycleRepository {
  importStudents(input: {
    classId: string;
    fileName: string;
    yearEntered: number;
    rows: ImportRow[];
  }): Promise<number>;
  promote(toAcademicYearId: string): Promise<number>;
  rollback(batchId: string): Promise<number>;
  archive(studentId: string): Promise<void>;
  tombstone(studentId: string): Promise<void>;
  listPromotionBatches(): Promise<
    {
      id: string;
      fromYear: string;
      toYear: string;
      status: "PREVIEWED" | "COMPLETED" | "REVERTED" | "FAILED";
      createdAt: string;
    }[]
  >;
}

export function createStudentLifecycleService(repository: StudentLifecycleRepository) {
  return {
    async importStudents(input: unknown) {
      return repository.importStudents(importPayloadSchema.parse(input));
    },
    promote: (toAcademicYearId: string) => repository.promote(toAcademicYearId),
    rollback: (batchId: string) => repository.rollback(batchId),
    archive: (studentId: string) => repository.archive(studentId),
    tombstone: (studentId: string) => repository.tombstone(studentId),
    listPromotionBatches: () => repository.listPromotionBatches(),
  };
}
