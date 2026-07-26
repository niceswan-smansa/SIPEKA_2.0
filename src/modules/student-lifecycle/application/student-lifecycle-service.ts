import {
  bulkImportPayloadSchema,
  importPayloadSchema,
  lifecycleIdSchema,
  type BulkImportBatch,
  type ImportRow,
  type PromotionPreview,
} from "../domain/student-lifecycle";

export interface StudentLifecycleRepository {
  importStudents(input: {
    classId: string;
    fileName: string;
    yearEntered: number;
    rows: ImportRow[];
  }): Promise<number>;
  importStudentsBulk?(input: BulkImportBatch[]): Promise<number>;
  promote(toAcademicYearId: string): Promise<number>;
  previewPromotion(toAcademicYearId: string): Promise<PromotionPreview>;
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
    async importStudentsBulk(input: unknown) {
      const parsed = bulkImportPayloadSchema.parse(input);
      if (!repository.importStudentsBulk) throw new Error("BULK_IMPORT_UNSUPPORTED");
      return repository.importStudentsBulk(parsed);
    },
    previewPromotion: (toAcademicYearId: string) =>
      repository.previewPromotion(lifecycleIdSchema.parse(toAcademicYearId)),
    promote: (toAcademicYearId: string) =>
      repository.promote(lifecycleIdSchema.parse(toAcademicYearId)),
    rollback: (batchId: string) => repository.rollback(lifecycleIdSchema.parse(batchId)),
    archive: (studentId: string) => repository.archive(lifecycleIdSchema.parse(studentId)),
    tombstone: (studentId: string) => repository.tombstone(lifecycleIdSchema.parse(studentId)),
    listPromotionBatches: () => repository.listPromotionBatches(),
  };
}
