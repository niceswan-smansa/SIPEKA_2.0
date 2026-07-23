"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { z } from "zod";

import { defaultPathForRole, requirePageAccess, sanitizeRedirect } from "@/modules/authorization";

import { authenticateUser } from "../application/authenticate-user";
import { changePassword } from "../application/change-password";
import { logoutUser } from "../application/logout-user";
import { createSupabaseAuthenticationGateway } from "../infrastructure/supabase-authentication.gateway";
import { allowRateLimited } from "@/shared/security/rate-limit";
import { createSignedState, verifySignedState } from "@/shared/security/signed-state";

const COMPLETION_COOKIE = "sipeka-password-completion";
const COMPLETION_PURPOSE = "password-completion";
const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(256),
  redirectTo: z.string().optional(),
});

const passwordSchema = z.object({
  confirmation: z.string().max(128),
  password: z.string().max(128),
});

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") || undefined,
  });

  if (!parsed.success) redirect("/login?error=invalid");
  const requestHeaders = await headers();
  const address = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const accountKey = parsed.data.identifier.trim().toLowerCase();
  if (
    !allowRateLimited(`login-address:${address}`, 50) ||
    !allowRateLimited(`login-account:${address}:${accountKey}`)
  ) {
    redirect("/login?error=invalid");
  }

  const result = await authenticateUser(await createSupabaseAuthenticationGateway(), parsed.data);
  if (!result.ok) redirect("/login?error=invalid");

  if (result.profile.mustChangePassword) redirect("/change-password");

  redirect(sanitizeRedirect(parsed.data.redirectTo, defaultPathForRole(result.profile.role)));
}

export async function logoutAction() {
  await logoutUser(await createSupabaseAuthenticationGateway());
  redirect("/login");
}

export async function changePasswordAction(formData: FormData) {
  const profile = await requirePageAccess("AUTHENTICATED");
  const parsed = passwordSchema.safeParse({
    confirmation: formData.get("confirmation"),
    password: formData.get("password"),
  });

  if (!parsed.success) redirect("/change-password?error=policy");

  const result = await changePassword(
    await createSupabaseAuthenticationGateway(),
    profile,
    parsed.data.password,
    parsed.data.confirmation,
  );

  if (!result.ok) {
    if (result.passwordUpdated) {
      const secret = process.env.RATE_LIMIT_SECRET;
      if (secret) {
        (await cookies()).set(
          COMPLETION_COOKIE,
          createSignedState(profile.id, COMPLETION_PURPOSE, secret),
          {
            httpOnly: true,
            maxAge: 600,
            path: "/change-password",
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
          },
        );
      }
    }
    redirect(`/change-password?error=${result.code}`);
  }
  (await cookies()).delete(COMPLETION_COOKIE);
  redirect(defaultPathForRole(profile.role));
}

export async function retryPasswordCompletionAction() {
  const profile = await requirePageAccess("AUTHENTICATED");
  const cookieStore = await cookies();
  const token = cookieStore.get(COMPLETION_COOKIE)?.value;
  const secret = process.env.RATE_LIMIT_SECRET;
  if (
    !token ||
    !secret ||
    !verifySignedState(token, { purpose: COMPLETION_PURPOSE, userId: profile.id }, secret)
  )
    redirect("/change-password?error=completion-pending");

  const gateway = await createSupabaseAuthenticationGateway();
  if (!(await gateway.completePasswordChange(profile)))
    redirect("/change-password?error=completion-pending");
  cookieStore.delete(COMPLETION_COOKIE);
  redirect(defaultPathForRole(profile.role));
}
