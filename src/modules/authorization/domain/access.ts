import type { AccountProfile, AppRole } from "@/shared/permissions";

export type AccessKind = "AUTHENTICATED" | "OPERATIONAL" | "SUPER_ADMIN" | "ADMIN_MUTATION";

export type AccessContext = {
  profile: AccountProfile | null;
  authenticated: boolean;
};

export type AccessDecision =
  | { type: "ALLOW" }
  | { type: "FORBIDDEN" }
  | { type: "LOGOUT"; redirectTo: string }
  | { type: "REDIRECT"; redirectTo: string };

export function defaultPathForRole(role: AppRole) {
  return role === "SUPER_ADMIN" ? "/super-admin/accounts" : "/dashboard";
}

export function sanitizeRedirect(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "http://sipeka.local");
    if (parsed.origin !== "http://sipeka.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function decideAccess(context: AccessContext, kind: AccessKind): AccessDecision {
  if (!context.authenticated) {
    return { redirectTo: "/login", type: "REDIRECT" };
  }
  if (!context.profile) return { redirectTo: "/login", type: "LOGOUT" };

  if (!context.profile.isActive) {
    return { redirectTo: "/login", type: "LOGOUT" };
  }

  if (context.profile.mustChangePassword && kind !== "AUTHENTICATED") {
    return { redirectTo: "/change-password", type: "REDIRECT" };
  }

  if (kind === "AUTHENTICATED") return { type: "ALLOW" };

  if (kind === "OPERATIONAL") {
    return context.profile.role === "SUPER_ADMIN"
      ? { redirectTo: "/super-admin/accounts", type: "REDIRECT" }
      : { type: "ALLOW" };
  }

  if (kind === "SUPER_ADMIN") {
    return context.profile.role === "SUPER_ADMIN"
      ? { type: "ALLOW" }
      : { redirectTo: "/dashboard", type: "REDIRECT" };
  }

  return context.profile.role === "ADMIN" ? { type: "ALLOW" } : { type: "FORBIDDEN" };
}
