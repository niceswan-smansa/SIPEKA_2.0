import { randomBytes, randomUUID } from "node:crypto";

import {
  accountInputSchema,
  accountSnapshot,
  accountUpdateSchema,
  assertManagedTarget,
  passwordResetSchema,
  type AccountInput,
  type AccountOperationResult,
  type AccountRepository,
  type AccountUpdateInput,
  type ManagedRole,
} from "../domain/accounts";

function ensureConfirmation(password: string, confirmation: string) {
  if (password !== confirmation) throw new Error("VALIDATION");
}

function failure(
  code: Extract<AccountOperationResult, { status: "failed" }>["code"],
): AccountOperationResult {
  return { status: "failed", code };
}

function failureCode(
  error: unknown,
  fallback: Extract<AccountOperationResult, { status: "failed" }>["code"],
) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("AUDIT")) return "AUDIT_FAILURE" as const;
  if (message.includes("AUTH")) return "AUTH_PROVIDER_FAILURE" as const;
  return fallback;
}

function isDeletedTombstone(account: {
  username: string;
  email: string | null;
  isActive: boolean;
}) {
  return (
    !account.isActive && account.email === null && /^deleted_[a-f0-9]{32}$/.test(account.username)
  );
}

function tombstoneUsername(id: string) {
  return `deleted_${id.replaceAll("-", "").slice(0, 32)}`;
}

function tombstoneEmail(id: string) {
  return `deleted+${id}@invalid.local`;
}

export function createAccountService(repository: AccountRepository) {
  return {
    listAccounts: (query: Parameters<AccountRepository["listAccounts"]>[0]) =>
      repository.listAccounts(query),
    listAccountAudit: (query: Parameters<AccountRepository["listAccountAudit"]>[0]) =>
      repository.listAccountAudit(query),
    getAccount: (id: string) => repository.getAccount(id),

    async createAccount(
      actor: { id: string; fullName: string },
      input: AccountInput,
    ): Promise<AccountOperationResult> {
      const parsed = accountInputSchema.safeParse(input);
      if (!parsed.success) throw new Error("VALIDATION");
      ensureConfirmation(parsed.data.password, parsed.data.confirmation);
      if (!parsed.data.email) throw new Error("VALIDATION");

      let authUser: { id: string } | null = null;
      try {
        authUser = await repository.createAuthUser({
          email: parsed.data.email,
          password: parsed.data.password,
        });
      } catch {
        return failure("AUTH_PROVIDER_FAILURE");
      }

      let profile;
      try {
        profile = await repository.insertProfileWithAudit({
          id: authUser.id,
          username: parsed.data.username,
          email: parsed.data.email,
          fullName: parsed.data.fullName,
          role: parsed.data.role,
          isActive: parsed.data.isActive,
          mustChangePassword: true,
          createdBy: actor.id,
          requestId: randomUUID(),
        });
      } catch (error) {
        try {
          await repository.deleteAuthUser(authUser.id);
        } catch {
          return failure("PARTIAL_OPERATION");
        }
        return failure(failureCode(error, "DATABASE_FAILURE"));
      }

      return { status: "success", code: "ACCOUNT_CREATED", account: profile };
    },

    async updateAccount(
      actor: { id: string; fullName: string },
      id: string,
      input: AccountUpdateInput,
    ): Promise<AccountOperationResult> {
      const target = await repository.getAccount(id);
      if (!target) throw new Error("NOT_FOUND");
      assertManagedTarget(actor.id, target);
      const parsed = accountUpdateSchema.safeParse(input);
      if (!parsed.success) throw new Error("VALIDATION");
      const emailChanged = parsed.data.email !== (target.email ?? "");

      if (emailChanged && parsed.data.email) {
        try {
          await repository.updateAuthUser(id, { email: parsed.data.email });
        } catch {
          return failure("AUTH_PROVIDER_FAILURE");
        }
      }

      try {
        const updated = await repository.updateProfileWithAudit({
          actorId: actor.id,
          targetId: id,
          fullName: parsed.data.fullName,
          username: parsed.data.username,
          email: parsed.data.email || null,
          role: parsed.data.role as ManagedRole,
          isActive: parsed.data.isActive,
          action: target.role === parsed.data.role ? "UPDATE" : "ROLE_CHANGE",
          requestId: randomUUID(),
        });
        return {
          status: "success",
          code: target.role === updated.role ? "ACCOUNT_UPDATED" : "ROLE_CHANGED",
          account: updated,
        };
      } catch (error) {
        let compensated = true;
        if (emailChanged && target.email) {
          try {
            await repository.updateAuthUser(id, { email: target.email });
          } catch {
            compensated = false;
          }
        }
        return failure(compensated ? failureCode(error, "AUDIT_FAILURE") : "PARTIAL_OPERATION");
      }
    },

    async resetPassword(
      actor: { id: string; fullName: string },
      id: string,
      password: string,
      confirmation: string,
    ): Promise<AccountOperationResult> {
      const target = await repository.getAccount(id);
      if (!target) throw new Error("NOT_FOUND");
      assertManagedTarget(actor.id, target);
      const parsed = passwordResetSchema.safeParse({ password, confirmation });
      if (!parsed.success) throw new Error("VALIDATION");
      ensureConfirmation(parsed.data.password, parsed.data.confirmation);

      try {
        await repository.updateAuthUser(id, { password: parsed.data.password });
      } catch {
        return failure("AUTH_PROVIDER_FAILURE");
      }
      try {
        const updated = await repository.markPasswordResetWithAudit({
          actorId: actor.id,
          targetId: id,
          requestId: randomUUID(),
        });
        return { status: "success", code: "PASSWORD_RESET", account: updated };
      } catch (error) {
        return failure(failureCode(error, "PARTIAL_OPERATION"));
      }
    },

    async setActive(
      actor: { id: string; fullName: string },
      id: string,
      isActive: boolean,
    ): Promise<AccountOperationResult> {
      const target = await repository.getAccount(id);
      if (!target) throw new Error("NOT_FOUND");
      assertManagedTarget(actor.id, target);
      try {
        const updated = await repository.updateProfileWithAudit({
          actorId: actor.id,
          targetId: id,
          fullName: target.fullName,
          username: target.username,
          email: target.email,
          role: target.role as ManagedRole,
          isActive,
          action: isActive ? "ACTIVATE" : "DEACTIVATE",
          requestId: randomUUID(),
        });
        return {
          status: "success",
          code: isActive ? "ACCOUNT_ACTIVATED" : "ACCOUNT_DEACTIVATED",
          account: updated,
        };
      } catch (error) {
        return failure(failureCode(error, "AUDIT_FAILURE"));
      }
    },

    async forceLogout(
      actor: { id: string; fullName: string },
      id: string,
    ): Promise<AccountOperationResult> {
      const target = await repository.getAccount(id);
      if (!target) throw new Error("NOT_FOUND");
      assertManagedTarget(actor.id, target);
      const revocation = await repository.revokeSessions(id);
      if (revocation.status === "unsupported") {
        try {
          await repository.insertAudit({
            actorId: actor.id,
            actorName: actor.fullName,
            action: "FORCE_LOGOUT_FAILED",
            entityId: id,
            before: accountSnapshot(target),
            after: accountSnapshot(target),
            metadata: { status: "FAILED", code: revocation.code },
          });
        } catch {
          return failure("AUDIT_FAILURE");
        }
        return revocation;
      }
      if (revocation.status === "failed") {
        try {
          await repository.insertAudit({
            actorId: actor.id,
            actorName: actor.fullName,
            action: "FORCE_LOGOUT_FAILED",
            entityId: id,
            before: accountSnapshot(target),
            after: accountSnapshot(target),
            metadata: { status: "FAILED", code: revocation.code },
          });
        } catch {
          return failure("AUDIT_FAILURE");
        }
        return revocation;
      }
      try {
        await repository.insertAudit({
          actorId: actor.id,
          actorName: actor.fullName,
          action: "FORCE_LOGOUT",
          entityId: id,
          before: accountSnapshot(target),
          after: accountSnapshot(target),
          metadata: { status: "SUCCESS", code: revocation.code },
        });
      } catch {
        return failure("AUDIT_FAILURE");
      }
      return revocation;
    },

    async deleteAccount(
      actor: { id: string; fullName: string },
      id: string,
    ): Promise<AccountOperationResult> {
      const target = await repository.getAccount(id);
      if (!target) throw new Error("NOT_FOUND");
      assertManagedTarget(actor.id, target);
      if (isDeletedTombstone(target)) {
        return { status: "success", code: "ACCOUNT_DELETED" };
      }

      const anonymizedEmail = tombstoneEmail(id);
      // Supabase password policy requires mixed character classes; the prefix also makes retries deterministic.
      const password = `Aa1!${randomBytes(32).toString("base64url")}`;
      try {
        await repository.updateAuthUser(id, { email: anonymizedEmail, password });
      } catch {
        return failure("AUTH_PROVIDER_FAILURE");
      }

      try {
        const updated = await repository.tombstoneProfileWithAudit({
          actorId: actor.id,
          targetId: id,
          tombstoneUsername: tombstoneUsername(id),
          requestId: randomUUID(),
        });
        return { status: "success", code: "ACCOUNT_DELETED", account: updated };
      } catch (error) {
        return failure(failureCode(error, "PARTIAL_OPERATION"));
      }
    },
  };
}
