import { z } from "zod";

export type AcademicYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export const academicYearInputSchema = z
  .object({
    name: z.string().trim().min(3).max(40),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    isActive: z.boolean().default(false),
  })
  .refine((value) => value.startDate < value.endDate, {
    message: "Tanggal mulai harus lebih awal dari tanggal selesai.",
    path: ["endDate"],
  });

export type AcademicYearInput = z.infer<typeof academicYearInputSchema>;

export interface AcademicYearRepository {
  list(): Promise<AcademicYear[]>;
  create(input: AcademicYearInput): Promise<AcademicYear>;
  update(id: string, input: Omit<AcademicYearInput, "isActive">): Promise<AcademicYear>;
  activate(id: string): Promise<void>;
}
