import { randomBytes, randomUUID } from "node:crypto";

import {
  accountInputSchema,
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

function isDeletedTombstone(account: { username: string; isActive: boolean }) {
  return !account.isActive && /^deleted_[a-f0-9]{32}$/.test(account.username);
}

function tombstoneUsername(id: string) {
  return `deleted_${id.replaceAll("-", "").slice(0, 32)}`;
}

function tombstoneEmail() {
  return `deleted+${randomUUID()}@invalid.local`;
}

export function createAccountService(repository: AccountRepository) {
  return {
    listAccounts: (query: Parameters<AccountRepository["listAccounts"]>[0]) =>
      repository.listAccounts(query),
    getAccount: (id: string) => repository.getAccount(id),

    async createAccount(
      actor: { id: string },
      input: AccountInput,
    ): Promise<AccountOperationResult> {
      const parsed = accountInputSchema.safeParse(input);
      if (!parsed.success) throw new Error("VALIDATION");
      ensureConfirmation(parsed.data.password, parsed.data.confirmation);

      let authUser: { id: string };
      try {
        authUser = await repository.createAuthUser({ password: parsed.data.password });
      } catch {
        return failure("AUTH_PROVIDER_FAILURE");
      }

      try {
        const profile = await repository.insertProfile({
          id: authUser.id,
          username: parsed.data.username,
          fullName: parsed.data.fullName,
          role: parsed.data.role,
          isActive: parsed.data.isActive,
          mustChangePassword: true,
          createdBy: actor.id,
          requestId: randomUUID(),
        });
        return { status: "success", code: "ACCOUNT_CREATED", account: profile };
      } catch {
        try {
          await repository.deleteAuthUser(authUser.id);
        } catch {
          return failure("PARTIAL_OPERATION");
        }
        return failure("DATABASE_FAILURE");
      }
    },

    async updateAccount(
      actor: { id: string },
      id: string,
      input: AccountUpdateInput,
    ): Promise<AccountOperationResult> {
      const target = await repository.getAccount(id);
      if (!target) throw new Error("NOT_FOUND");
      assertManagedTarget(actor.id, target);

      const parsed = accountUpdateSchema.safeParse(input);
      if (!parsed.success) throw new Error("VALIDATION");

      try {
        const updated = await repository.updateProfile({
          actorId: actor.id,
          targetId: id,
          fullName: parsed.data.fullName,
          username: parsed.data.username,
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
      } catch {
        return failure("DATABASE_FAILURE");
      }
    },

    async resetPassword(
      actor: { id: string },
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

      let updated;
      try {
        updated = await repository.markPasswordReset({
          actorId: actor.id,
          targetId: id,
          requestId: randomUUID(),
        });
      } catch {
        return failure("DATABASE_FAILURE");
      }

      try {
        await repository.updateAuthUser(id, { password: parsed.data.password });
      } catch {
        return { status: "failed", code: "PASSWORD_RESET_AUTH_FAILED", account: updated };
      }

      return { status: "success", code: "PASSWORD_RESET", account: updated };
    },

    async setActive(
      actor: { id: string },
      id: string,
      isActive: boolean,
    ): Promise<AccountOperationResult> {
      const target = await repository.getAccount(id);
      if (!target) throw new Error("NOT_FOUND");
      assertManagedTarget(actor.id, target);

      try {
        const updated = await repository.updateProfile({
          actorId: actor.id,
          targetId: id,
          fullName: target.fullName,
          username: target.username,
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
      } catch {
        return failure("DATABASE_FAILURE");
      }
    },

    async forceLogout(actor: { id: string }, id: string): Promise<AccountOperationResult> {
      const target = await repository.getAccount(id);
      if (!target) throw new Error("NOT_FOUND");
      assertManagedTarget(actor.id, target);
      return repository.revokeSessions(id);
    },

    async deleteAccount(actor: { id: string }, id: string): Promise<AccountOperationResult> {
      const target = await repository.getAccount(id);
      if (!target) throw new Error("NOT_FOUND");
      assertManagedTarget(actor.id, target);

      let tombstone = target;
      try {
        if (!isDeletedTombstone(target)) {
          tombstone = await repository.tombstoneProfile({
            actorId: actor.id,
            targetId: id,
            tombstoneUsername: tombstoneUsername(id),
            requestId: randomUUID(),
          });
        }
      } catch {
        return failure("DATABASE_FAILURE");
      }

      const password = `Aa1!${randomBytes(32).toString("base64url")}`;
      try {
        await repository.replaceAuthIdentity(id, tombstoneEmail());
        await repository.updateAuthUser(id, { password });
      } catch {
        return { status: "failed", code: "ACCOUNT_AUTH_CLEANUP_PENDING", account: tombstone };
      }

      return { status: "success", code: "ACCOUNT_DELETED", account: tombstone };
    },
  };
}
