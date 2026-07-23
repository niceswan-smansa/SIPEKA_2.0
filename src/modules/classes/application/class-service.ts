import { classUpdateSchema, type ClassRepository } from "../domain/classes";

export function createClassService(repository: ClassRepository) {
  return {
    list: (query?: Parameters<ClassRepository["list"]>[0]) => repository.list(query),
    update(input: Parameters<ClassRepository["update"]>[0]) {
      return repository.update(classUpdateSchema.parse(input));
    },
  };
}
