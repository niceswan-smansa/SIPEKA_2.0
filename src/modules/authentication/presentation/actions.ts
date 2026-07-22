"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { defaultPathForRole, requirePageAccess, sanitizeRedirect } from "@/modules/authorization";

import { authenticateUser } from "../application/authenticate-user";
import { changePassword } from "../application/change-password";
import { logoutUser } from "../application/logout-user";
import { createSupabaseAuthenticationGateway } from "../infrastructure/supabase-authentication.gateway";

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

  if (!parsed.success) redirect("/change-password?error=validation");

  const result = await changePassword(
    await createSupabaseAuthenticationGateway(),
    profile,
    parsed.data.password,
    parsed.data.confirmation,
  );

  if (!result.ok) redirect("/change-password?error=validation");
  redirect(defaultPathForRole(profile.role));
}
