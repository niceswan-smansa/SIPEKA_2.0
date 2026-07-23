export { createAcademicYearService } from "./application/academic-year-service";
export {
  academicYearInputSchema,
  type AcademicYear,
  type AcademicYearInput,
  type AcademicYearRepository,
} from "./domain/academic-years";
export { createSupabaseAcademicYearRepository } from "./infrastructure/supabase-academic-year.repository";
export {
  activateAcademicYearAction,
  createAcademicYearAction,
  updateAcademicYearAction,
} from "./presentation/actions";
