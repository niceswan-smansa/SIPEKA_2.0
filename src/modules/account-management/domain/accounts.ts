import { z } from "zod";

export const MANAGED_ROLES = ["ADMIN", "USER"] as const;
export type ManagedRole = (typeof MANAGED_ROLES)[number];

export type AccountRecord = {
  id: string;
  username: string;
  email: string | null;
  fullName: string;
  role: "SUPER_ADMIN" | ManagedRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountListQuery = {
  page: number;
  search?: string;
  role?: ManagedRole;
  active?: boolean;
};
export type AccountListResult = {
  items: AccountRecord[];
  page: number;
  pageSize: number;
  total: number;
};
export type AccountAuditEntry = {
  id: string;
  createdAt: string;
  action: string;
  actorName: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
};

export const accountInputSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/),
  email: z.string().trim().toLowerCase().email().max(254).optional().or(z.literal("")),
  role: z.enum(MANAGED_ROLES),
  password: z.string().min(12).max(128),
  confirmation: z.string().max(128),
  isActive: z.boolean().default(true),
});

export const accountUpdateSchema = accountInputSchema.pick({
  fullName: true,
  username: true,
  email: true,
  role: true,
  isActive: true,
});
export const passwordResetSchema = z.object({
  password: z.string().min(12).max(128),
  confirmation: z.string().max(128),
});

export type AccountInput = z.infer<typeof accountInputSchema>;
export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;

export type AccountOperationResult =
  | {
      status: "success";
      code:
        | "ACCOUNT_CREATED"
        | "ACCOUNT_UPDATED"
        | "ROLE_CHANGED"
        | "PASSWORD_RESET"
        | "ACCOUNT_ACTIVATED"
        | "ACCOUNT_DEACTIVATED"
        | "ACCOUNT_DELETED"
        | "SESSIONS_REVOKED";
      account?: AccountRecord;
    }
  | { status: "unsupported"; code: "SESSION_REVOCATION_UNSUPPORTED" }
  | {
      status: "failed";
      code: "AUTH_PROVIDER_FAILURE" | "DATABASE_FAILURE" | "AUDIT_FAILURE" | "PARTIAL_OPERATION";
    };

export type SessionRevocationResult =
  | { status: "success"; code: "SESSIONS_REVOKED" }
  | { status: "unsupported"; code: "SESSION_REVOCATION_UNSUPPORTED" }
  | { status: "failed"; code: "AUTH_PROVIDER_FAILURE" };

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}
export function accountSnapshot(
  account:
    | AccountRecord
    | Pick<
        AccountRecord,
        "id" | "username" | "email" | "fullName" | "role" | "isActive" | "mustChangePassword"
      >,
) {
  return {
    id: account.id,
    username: account.username,
    email: account.email,
    full_name: account.fullName,
    role: account.role,
    is_active: account.isActive,
    must_change_password: account.mustChangePassword,
  };
}
export function assertManagedTarget(actorId: string, target: AccountRecord) {
  if (target.id === actorId) throw new Error("TARGET_SELF");
  if (target.role === "SUPER_ADMIN") throw new Error("TARGET_PROTECTED");
}

export interface AccountRepository {
  listAccounts(query: AccountListQuery): Promise<AccountListResult>;
  getAccount(id: string): Promise<AccountRecord | null>;
  createAuthUser(input: { email: string; password: string }): Promise<{ id: string }>;
  deleteAuthUser(id: string): Promise<void>;
  updateAuthUser(id: string, input: { email?: string; password?: string }): Promise<void>;
  insertProfileWithAudit(input: {
    id: string;
    username: string;
    email: string;
    fullName: string;
    role: ManagedRole;
    isActive: boolean;
    mustChangePassword: boolean;
    createdBy: string;
    requestId: string;
  }): Promise<AccountRecord>;
  updateProfileWithAudit(input: {
    actorId: string;
    targetId: string;
    fullName: string;
    username: string;
    email: string | null;
    role: ManagedRole;
    isActive: boolean;
    action: "UPDATE" | "ROLE_CHANGE" | "ACTIVATE" | "DEACTIVATE";
    requestId: string;
  }): Promise<AccountRecord>;
  markPasswordResetWithAudit(input: {
    actorId: string;
    targetId: string;
    requestId: string;
  }): Promise<AccountRecord>;
  tombstoneProfileWithAudit(input: {
    actorId: string;
    targetId: string;
    tombstoneUsername: string;
    requestId: string;
  }): Promise<AccountRecord>;
  insertAudit(input: {
    actorId: string;
    actorName: string;
    action: string;
    entityId: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  listAccountAudit(query: {
    page: number;
    action?: string;
    search?: string;
  }): Promise<{ items: AccountAuditEntry[]; page: number; pageSize: number; total: number }>;
  revokeSessions(id: string): Promise<SessionRevocationResult>;
}
