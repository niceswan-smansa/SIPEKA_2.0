import { describe, expect, it } from "vitest";

import type { AccountProfile } from "@/shared/permissions";

import { decideAccess, sanitizeRedirect } from "../domain/access";

const profile: AccountProfile = {
  fullName: "User Sintetis",
  id: "user-id",
  isActive: true,
  mustChangePassword: false,
  role: "USER",
  username: "user.test",
};

describe("server access decisions", () => {
  it("redirects anonymous requests to login", () => {
    expect(decideAccess({ authenticated: false, profile: null }, "OPERATIONAL")).toEqual({
      redirectTo: "/login",
      type: "REDIRECT",
    });
  });

  it("logs out inactive sessions", () => {
    expect(
      decideAccess(
        { authenticated: true, profile: { ...profile, isActive: false } },
        "OPERATIONAL",
      ),
    ).toEqual({ redirectTo: "/login", type: "LOGOUT" });
  });

  it("forces password change before every protected area", () => {
    expect(
      decideAccess(
        { authenticated: true, profile: { ...profile, mustChangePassword: true } },
        "OPERATIONAL",
      ),
    ).toEqual({ redirectTo: "/change-password", type: "REDIRECT" });
  });

  it("isolates SUPER_ADMIN from operational routes", () => {
    expect(
      decideAccess(
        { authenticated: true, profile: { ...profile, role: "SUPER_ADMIN" } },
        "OPERATIONAL",
      ),
    ).toEqual({ redirectTo: "/super-admin/accounts", type: "REDIRECT" });
  });

  it("isolates ADMIN from the Super Admin portal", () => {
    expect(
      decideAccess({ authenticated: true, profile: { ...profile, role: "ADMIN" } }, "SUPER_ADMIN"),
    ).toEqual({ redirectTo: "/dashboard", type: "REDIRECT" });
  });

  it("allows USER read routes but forbids mutation routes", () => {
    expect(decideAccess({ authenticated: true, profile }, "OPERATIONAL")).toEqual({
      type: "ALLOW",
    });
    expect(decideAccess({ authenticated: true, profile }, "ADMIN_MUTATION")).toEqual({
      type: "FORBIDDEN",
    });
  });
});

describe("redirect validation", () => {
  it("keeps local paths", () => {
    expect(sanitizeRedirect("/dashboard?date=2026-07-23", "/dashboard")).toBe(
      "/dashboard?date=2026-07-23",
    );
  });

  it.each(["https://example.test", "//example.test", "/\\example.test", "javascript:alert(1)"])(
    "rejects unsafe redirect %s",
    (value) => {
      expect(sanitizeRedirect(value, "/dashboard")).toBe("/dashboard");
    },
  );
});
