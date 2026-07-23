import { z } from "zod";

export const auditFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  action: z.string().trim().max(80).optional(),
  search: z.string().trim().max(120).optional(),
});
export type AuditFilter = z.infer<typeof auditFilterSchema>;
export type OperationalAudit = {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
};
export interface OperationalAuditRepository {
  list(filter: AuditFilter): Promise<{ items: OperationalAudit[]; total: number }>;
}
