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
    replaceAuthIdentity: async () => undefined,
    insertProfile: async (input) => ({
      ...target,
      id: input.id,
      username: input.username,
      fullName: input.fullName,
      role: input.role,
      isActive: input.isActive,
      mustChangePassword: input.mustChangePassword,
    }),
    updateProfile: async (input) => ({
      ...target,
      fullName: input.fullName,
      username: input.username,
      role: input.role,
      isActive: input.isActive,
    }),
    markPasswordReset: async () => ({ ...target, mustChangePassword: true }),
    tombstoneProfile: async (input) => ({
      ...target,
      username: input.tombstoneUsername,
      isActive: false,
      mustChangePassword: true,
    }),
    revokeSessions: async () => ({
      status: "unsupported",
      code: "SESSION_REVOCATION_UNSUPPORTED",
    }),
    ...overrides,
  };
}

describe("account-management without history storage", () => {
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
        insertProfile: async () => {
          throw new Error("PROFILE_FAILED");
        },
        deleteAuthUser: async (id) => {
          deleted = id;
        },
      }),
    );

    const result = await service.createAccount(
      { id: "actor" },
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

  it("blocks the profile before changing its Auth password", async () => {
    const calls: string[] = [];
    const service = createAccountService(
      repository({
        markPasswordReset: async () => {
          calls.push("database");
          return { ...target, mustChangePassword: true };
        },
        updateAuthUser: async () => {
          calls.push("auth");
        },
      }),
    );

    await service.resetPassword({ id: "actor" }, target.id, password, password);
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

    await expect(
      service.resetPassword({ id: "actor" }, target.id, password, password),
    ).resolves.toMatchObject({
      status: "failed",
      code: "PASSWORD_RESET_AUTH_FAILED",
      account: { mustChangePassword: true },
    });
  });

  it("uses an access tombstone and randomizes the Auth credential", async () => {
    let randomizedCredential = "";
    const service = createAccountService(
      repository({
        updateAuthUser: async (_id, input) => {
          randomizedCredential = input.password ?? "";
        },
      }),
    );

    await expect(service.deleteAccount({ id: "actor" }, target.id)).resolves.toMatchObject({
      status: "success",
      code: "ACCOUNT_DELETED",
      account: {
        username: expect.stringMatching(/^deleted_/),
        isActive: false,
        mustChangePassword: true,
      },
    });
    expect(randomizedCredential).toMatch(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])/);
  });

  it("returns the provider session-revocation capability directly", async () => {
    const service = createAccountService(repository());
    await expect(service.forceLogout({ id: "actor" }, target.id)).resolves.toEqual({
      status: "unsupported",
      code: "SESSION_REVOCATION_UNSUPPORTED",
    });
  });

  it("does not touch Auth identity when only profile fields change", async () => {
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

    const result = await service.updateAccount({ id: "actor" }, target.id, {
      fullName: target.fullName,
      username: "operator.changed",
      role: "USER",
      isActive: true,
    });

    expect(result.status).toBe("success");
    expect(authTouched).toBe(false);
  });
});
