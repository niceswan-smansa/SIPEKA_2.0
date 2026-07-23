import type { StudentRepository } from "@/modules/students";

import { parseStudentSearchParams } from "../domain/student-search";

export function createStudentSearchService(repository: StudentRepository) {
  return {
    async search(input: Record<string, string | undefined>) {
      const parsed = parseStudentSearchParams(input);
      return { ...parsed, result: await repository.search(parsed.query) };
    },
  };
}
