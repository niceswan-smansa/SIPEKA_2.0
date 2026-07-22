import { describe, expect, it, vi } from "vitest";

import type { AccountProfile } from "@/shared/permissions";

import { authenticateUser } from "../application/authenticate-user";
import { changePassword } from "../application/change-password";
import { logoutUser } from "../application/logout-user";
import { GENERIC_LOGIN_ERROR, type AuthenticationGateway } from "../domain/authentication";

const activeUser: AccountProfile = {
  email: "user.test@sipeka.test",
  fullName: "User Sintetis",
  id: "user-id",
  isActive: true,
  mustChangePassword: false,
  role: "USER",
  username: "user.test",
};

function createGateway(overrides: Partial<AuthenticationGateway> = {}): AuthenticationGateway {
  return {
    completePasswordChange: vi.fn().mockResolvedValue(true),
    getProfile: vi.fn().mockResolvedValue(activeUser),
    recordLogin: vi.fn().mockResolvedValue(undefined),
    resolveEmail: vi.fn().mockResolvedValue(activeUser.email),
    signInWithPassword: vi.fn().mockResolvedValue(activeUser.id),
    signOut: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("authentication application service", () => {
  it("logs in with a normalized email without username lookup", async () => {
    const gateway = createGateway();
    const result = await authenticateUser(gateway, {
      identifier: " USER.TEST@SIPEKA.TEST ",
      password: "Disposable!123",
    });

    expect(result).toEqual({ ok: true, profile: activeUser });
    expect(gateway.resolveEmail).not.toHaveBeenCalled();
    expect(gateway.signInWithPassword).toHaveBeenCalledWith(
      "user.test@sipeka.test",
      "Disposable!123",
    );
  });

  it("resolves a lowercase username only on the server gateway", async () => {
    const gateway = createGateway();
    const result = await authenticateUser(gateway, {
      identifier: " USER.TEST ",
      password: "Disposable!123",
    });

    expect(result.ok).toBe(true);
    expect(gateway.resolveEmail).toHaveBeenCalledWith("user.test");
  });

  it("uses one generic error for missing account and wrong password", async () => {
    const missing = await authenticateUser(
      createGateway({ resolveEmail: vi.fn().mockResolvedValue(null) }),
      {
        identifier: "missing",
        password: "Disposable!123",
      },
    );
    const wrongPassword = await authenticateUser(
      createGateway({ signInWithPassword: vi.fn().mockResolvedValue(null) }),
      { identifier: activeUser.email!, password: "wrong" },
    );

    expect(missing).toEqual({ message: GENERIC_LOGIN_ERROR, ok: false });
    expect(wrongPassword).toEqual({ message: GENERIC_LOGIN_ERROR, ok: false });
  });

  it("rejects and signs out an inactive account", async () => {
    const gateway = createGateway({
      getProfile: vi.fn().mockResolvedValue({ ...activeUser, isActive: false }),
    });

    const result = await authenticateUser(gateway, {
      identifier: activeUser.email!,
      password: "Disposable!123",
    });

    expect(result).toEqual({ message: GENERIC_LOGIN_ERROR, ok: false });
    expect(gateway.signOut).toHaveBeenCalledOnce();
  });

  it("logs out through the gateway", async () => {
    const gateway = createGateway();
    await logoutUser(gateway);
    expect(gateway.signOut).toHaveBeenCalledOnce();
  });

  it("changes a strong password and clears the mandatory flag", async () => {
    const gateway = createGateway();
    const result = await changePassword(
      gateway,
      { ...activeUser, mustChangePassword: true },
      "Disposable!456",
      "Disposable!456",
    );

    expect(result).toEqual({ ok: true });
    expect(gateway.updatePassword).toHaveBeenCalledWith("Disposable!456");
    expect(gateway.completePasswordChange).toHaveBeenCalledOnce();
  });

  it("rejects weak or mismatched password changes", async () => {
    const gateway = createGateway();

    expect(await changePassword(gateway, activeUser, "weak", "weak")).toMatchObject({ ok: false });
    expect(
      await changePassword(gateway, activeUser, "Disposable!456", "Disposable!789"),
    ).toMatchObject({ ok: false });
    expect(gateway.updatePassword).not.toHaveBeenCalled();
  });
});
