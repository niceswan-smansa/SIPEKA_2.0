import {
  academicYearInputSchema,
  type AcademicYearInput,
  type AcademicYearRepository,
} from "../domain/academic-years";

export function createAcademicYearService(repository: AcademicYearRepository) {
  return {
    list: () => repository.list(),
    create(input: AcademicYearInput) {
      return repository.create(academicYearInputSchema.parse(input));
    },
    update(id: string, input: Omit<AcademicYearInput, "isActive">) {
      const parsed = academicYearInputSchema.parse({ ...input, isActive: false });
      return repository.update(id, {
        name: parsed.name,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
      });
    },
    activate: (id: string) => repository.activate(id),
  };
}
