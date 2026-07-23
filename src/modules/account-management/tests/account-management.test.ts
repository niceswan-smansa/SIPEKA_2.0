import { describe, expect, it } from "vitest";

import { createAccountService } from "../application/account-service";
import {
  accountInputSchema,
  assertManagedTarget,
  normalizeUsername,
  type AccountRecord,
  type AccountRepository,
} from "../domain/accounts";

const password = `Aa1!${"x".repeat(9)}`;
const target: AccountRecord = {
  id: "target",
  username: "operator",
  fullName: "Operator Sintetis",
  role: "USER",
  isActive: true,
  mustChangePassword: false,
  lastLoginAt: null,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

function repository(overrides: Partial<AccountRepository> = {}): AccountRepository {
  return {
    listAccounts: async () => ({ items: [], page: 1, pageSize: 20, total: 0 }),
    getAccount: async () => target,
    createAuthUser: async () => ({ id: "new-user" }),
    deleteAuthUser: async () => undefined,
    updateAuthUser: async () => undefined,
    insertProfileWithAudit: async (input) => ({
      ...target,
      id: input.id,
      username: input.username,
      fullName: input.fullName,
      role: input.role,
      isActive: input.isActive,
      mustChangePassword: input.mustChangePassword,
    }),
    updateProfileWithAudit: async (input) => ({
      ...target,
      fullName: input.fullName,
      username: input.username,
      role: input.role,
      isActive: input.isActive,
    }),
    markPasswordResetWithAudit: async () => ({ ...target, mustChangePassword: true }),
    tombstoneProfileWithAudit: async (input) => ({
      ...target,
      username: input.tombstoneUsername,
      isActive: false,
      mustChangePassword: true,
    }),
    insertAudit: async () => undefined,
    listAccountAudit: async () => ({ items: [], page: 1, pageSize: 25, total: 0 }),
    revokeSessions: async () => ({ status: "unsupported", code: "SESSION_REVOCATION_UNSUPPORTED" }),
    replaceAuthIdentity: async () => undefined,
    ...overrides,
  };
}

describe("account-management", () => {
  it("normalizes usernames and rejects SUPER_ADMIN input", () => {
    expect(normalizeUsername("  Admin.User ")).toBe("admin.user");
    expect(
      accountInputSchema.safeParse({
        fullName: "Akun",
        username: "admin",
        role: "SUPER_ADMIN",
        password,
        confirmation: password,
        isActive: true,
      }).success,
    ).toBe(false);
  });

  it("protects the actor and every SUPER_ADMIN target", () => {
    expect(() => assertManagedTarget(target.id, target)).toThrow("TARGET_SELF");
    expect(() => assertManagedTarget("actor", { ...target, role: "SUPER_ADMIN" })).toThrow(
      "TARGET_PROTECTED",
    );
  });

  it("compensates the Auth user when profile creation fails", async () => {
    let deleted = "";
    const service = createAccountService(
      repository({
        insertProfileWithAudit: async () => {
          throw new Error("PROFILE_FAILED");
        },
        deleteAuthUser: async (id) => {
          deleted = id;
        },
      }),
    );
    const result = await service.createAccount(
      { id: "actor", fullName: "Super Admin" },
      {
        fullName: "Akun Baru",
        username: "akun.baru",
        role: "USER",
        password,
        confirmation: password,
        isActive: true,
      },
    );
    expect(result).toEqual({ status: "failed", code: "DATABASE_FAILURE" });
    expect(deleted).toBe("new-user");
  });

  it("does not report create success when the atomic audit transaction fails", async () => {
    const service = createAccountService(
      repository({
        insertProfileWithAudit: async () => {
          throw new Error("AUDIT_FAILURE");
        },
      }),
    );
    await expect(
      service.createAccount(
        { id: "actor", fullName: "Super Admin" },
        {
          fullName: "Akun Baru",
          username: "akun.audit",
          role: "USER",
          password,
          confirmation: password,
          isActive: true,
        },
      ),
    ).resolves.toEqual({ status: "failed", code: "AUDIT_FAILURE" });
  });

  it("redacts the password from reset audit metadata", async () => {
    let resetInput: { actorId: string; targetId: string; requestId: string } | null = null;
    const service = createAccountService(
      repository({
        markPasswordResetWithAudit: async (input) => {
          resetInput = input;
          return { ...target, mustChangePassword: true };
        },
      }),
    );
    await service.resetPassword(
      { id: "actor", fullName: "Super Admin" },
      target.id,
      password,
      password,
    );
    expect(resetInput).toMatchObject({ actorId: "actor", targetId: target.id });
    expect(JSON.stringify(resetInput)).not.toContain(password);
  });

  it("blocks the account before changing its Auth password", async () => {
    const calls: string[] = [];
    const service = createAccountService(
      repository({
        markPasswordResetWithAudit: async () => {
          calls.push("database");
          return { ...target, mustChangePassword: true };
        },
        updateAuthUser: async () => {
          calls.push("auth");
        },
      }),
    );
    await service.resetPassword(
      { id: "actor", fullName: "Super Admin" },
      target.id,
      password,
      password,
    );
    expect(calls).toEqual(["database", "auth"]);
  });

  it("keeps must-change enforced when the Auth password update fails", async () => {
    const service = createAccountService(
      repository({
        updateAuthUser: async () => {
          throw new Error("provider");
        },
      }),
    );
    const result = await service.resetPassword(
      { id: "actor", fullName: "Super Admin" },
      target.id,
      password,
      password,
    );
    expect(result).toMatchObject({
      status: "failed",
      code: "PASSWORD_RESET_AUTH_FAILED",
      account: { mustChangePassword: true },
    });
  });

  it("uses an access tombstone and never records the randomized credential", async () => {
    const updates: Record<string, unknown>[] = [];
    const audits: Parameters<AccountRepository["insertAudit"]>[0][] = [];
    let randomizedCredential = "";
    const service = createAccountService(
      repository({
        tombstoneProfileWithAudit: async (input) => {
          updates.push(input);
          return {
            ...target,
            username: input.tombstoneUsername,
            isActive: false,
            mustChangePassword: true,
          };
        },
        updateAuthUser: async (_id, input) => {
          randomizedCredential = input.password ?? "";
        },
        insertAudit: async (input) => {
          audits.push(input);
        },
      }),
    );
    await service.deleteAccount({ id: "actor", fullName: "Super Admin" }, target.id);
    expect(updates[0]).toMatchObject({ tombstoneUsername: expect.stringMatching(/^deleted_/) });
    expect(randomizedCredential).not.toBe("");
    expect(randomizedCredential).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])/);
    expect(JSON.stringify(audits)).not.toContain(randomizedCredential);
    expect(JSON.stringify(audits)).not.toContain("@invalid.local");
  });

  it("does not claim force logout when Supabase cannot revoke without a target JWT", async () => {
    const audits: Parameters<AccountRepository["insertAudit"]>[0][] = [];
    const service = createAccountService(
      repository({
        insertAudit: async (input) => {
          audits.push(input);
        },
      }),
    );
    const result = await service.forceLogout({ id: "actor", fullName: "Super Admin" }, target.id);
    expect(result).toEqual({ status: "unsupported", code: "SESSION_REVOCATION_UNSUPPORTED" });
    expect(audits[0]?.action).toBe("FORCE_LOGOUT_FAILED");
    expect(audits[0]?.metadata).toMatchObject({
      code: "SESSION_REVOCATION_UNSUPPORTED",
      status: "FAILED",
    });
  });

  it("does not report profile update success when the audit transaction fails", async () => {
    const service = createAccountService(
      repository({
        updateProfileWithAudit: async () => {
          throw new Error("AUDIT_FAILURE");
        },
      }),
    );
    const result = await service.updateAccount(
      { id: "actor", fullName: "Super Admin" },
      target.id,
      {
        fullName: "Nama Baru",
        username: "operator-baru",
        role: "USER",
        isActive: true,
      },
    );
    expect(result).toEqual({ status: "failed", code: "AUDIT_FAILURE" });
  });

  it("does not change Auth identity when username changes", async () => {
    let authTouched = false;
    const service = createAccountService(
      repository({
        updateAuthUser: async () => {
          authTouched = true;
        },
        replaceAuthIdentity: async () => {
          authTouched = true;
        },
      }),
    );
    const result = await service.updateAccount(
      { id: "actor", fullName: "Super Admin" },
      target.id,
      {
        fullName: target.fullName,
        username: "operator.changed",
        role: "USER",
        isActive: true,
      },
    );
    expect(result.status).toBe("success");
    expect(authTouched).toBe(false);
  });

  it("does not report reset or delete success when audit-backed RPC fails", async () => {
    const service = createAccountService(
      repository({
        markPasswordResetWithAudit: async () => {
          throw new Error("AUDIT_FAILURE");
        },
        tombstoneProfileWithAudit: async () => {
          throw new Error("AUDIT_FAILURE");
        },
      }),
    );
    await expect(
      service.resetPassword(
        { id: "actor", fullName: "Super Admin" },
        target.id,
        password,
        password,
      ),
    ).resolves.toEqual({ status: "failed", code: "AUDIT_FAILURE" });
    await expect(
      service.deleteAccount({ id: "actor", fullName: "Super Admin" }, target.id),
    ).resolves.toEqual({ status: "failed", code: "AUDIT_FAILURE" });
  });

  it("records force logout success only after confirmed revocation", async () => {
    const actions: string[] = [];
    const service = createAccountService(
      repository({
        revokeSessions: async () => ({ status: "success", code: "SESSIONS_REVOKED" }),
        insertAudit: async (input) => {
          actions.push(input.action);
        },
      }),
    );
    await expect(
      service.forceLogout({ id: "actor", fullName: "Super Admin" }, target.id),
    ).resolves.toEqual({ status: "success", code: "SESSIONS_REVOKED" });
    expect(actions).toEqual(["FORCE_LOGOUT"]);
  });

  it("retries Auth cleanup for an existing tombstone", async () => {
    let identityCleanups = 0;
    const service = createAccountService(
      repository({
        getAccount: async () => ({
          ...target,
          username: "deleted_0123456789abcdef0123456789abcdef",
          isActive: false,
          mustChangePassword: true,
        }),
        replaceAuthIdentity: async () => {
          identityCleanups += 1;
        },
      }),
    );
    await expect(
      service.deleteAccount({ id: "actor", fullName: "Super Admin" }, target.id),
    ).resolves.toMatchObject({ status: "success", code: "ACCOUNT_DELETED" });
    expect(identityCleanups).toBe(1);
  });
});
