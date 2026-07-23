import {
  studentAcademicSchema,
  studentCreateSchema,
  studentIdentitySchema,
  type StudentListQuery,
  type StudentRepository,
} from "../domain/students";

export function createStudentService(repository: StudentRepository) {
  return {
    search: (query: StudentListQuery) => repository.search(query),
    getDetail: (id: string) => repository.getDetail(id),
    create(input: Parameters<StudentRepository["create"]>[0]) {
      return repository.create(studentCreateSchema.parse(input));
    },
    updateIdentity(input: Parameters<StudentRepository["updateIdentity"]>[0]) {
      return repository.updateIdentity(studentIdentitySchema.parse(input));
    },
    changeAcademic(input: Parameters<StudentRepository["changeAcademic"]>[0]) {
      return repository.changeAcademic(studentAcademicSchema.parse(input));
    },
  };
}
