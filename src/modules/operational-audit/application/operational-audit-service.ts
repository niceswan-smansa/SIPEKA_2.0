import { auditFilterSchema, type OperationalAuditRepository } from "../domain/operational-audit";

export function createOperationalAuditService(repository: OperationalAuditRepository) {
  return {
    list(input: Record<string, string | undefined>) {
      return repository.list(auditFilterSchema.parse(input));
    },
  };
}
