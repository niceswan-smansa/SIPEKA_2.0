"use server";

import { redirect } from "next/navigation";

import { requirePageAccess } from "@/modules/authorization";

import { createAccountService } from "../application/account-service";
import {
  accountInputSchema,
  accountUpdateSchema,
  passwordResetSchema,
  type AccountOperationResult,
} from "../domain/accounts";
import { createSupabaseAccountRepository } from "../infrastructure/supabase-account.repository";

function service() {
  return createAccountService(createSupabaseAccountRepository());
}

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function bool(value: FormDataEntryValue | null) {
  return value === "on" || value === "true";
}

function genericError(path: string, code = "operation"): never {
  redirect(`${path}?error=${encodeURIComponent(code)}`);
}

function logFailure(operation: string, result?: AccountOperationResult, targetId?: string) {
  console.error(
    JSON.stringify({
      event: "account_operation_failed",
      operation,
      requestId: crypto.randomUUID(),
      ...(result ? { status: result.status, code: result.code } : {}),
      ...(targetId ? { targetId } : {}),
    }),
  );
}

function requireSuccess(
  path: string,
  operation: string,
  result: AccountOperationResult,
  targetId?: string,
) {
  if (result.status === "success") return;
  logFailure(operation, result, targetId);
  genericError(path, result.code);
}

export async function createAccountAction(formData: FormData) {
  const actor = await requirePageAccess("SUPER_ADMIN");
  const input = {
    fullName: text(formData.get("fullName")),
    username: text(formData.get("username")),
    role: text(formData.get("role")),
    password: text(formData.get("password")),
    confirmation: text(formData.get("confirmation")),
    isActive: bool(formData.get("isActive")),
  };
  const parsed = accountInputSchema.safeParse(input);

  if (!parsed.success) {
    genericError(
      "/super-admin/accounts/new",
      input.password !== input.confirmation ? "confirmation" : "policy",
    );
  }

  let result: AccountOperationResult;
  try {
    result = await service().createAccount(actor, parsed.data);
  } catch {
    logFailure("CREATE");
    genericError("/super-admin/accounts/new");
  }

  const createdAccountId = "account" in result ? result.account?.id : undefined;
  requireSuccess("/super-admin/accounts/new", "CREATE", result, createdAccountId);
  redirect("/super-admin/accounts?success=created");
}

export async function updateAccountAction(formData: FormData) {
  const actor = await requirePageAccess("SUPER_ADMIN");
  const id = text(formData.get("id"));
  const input = {
    fullName: text(formData.get("fullName")),
    username: text(formData.get("username")),
    role: text(formData.get("role")),
    isActive: bool(formData.get("isActive")),
  };
  const parsed = accountUpdateSchema.safeParse(input);

  if (!id || !parsed.success) genericError(`/super-admin/accounts/${id}`);

  let result: AccountOperationResult;
  try {
    result = await service().updateAccount(actor, id, parsed.data);
  } catch {
    logFailure("UPDATE", undefined, id);
    genericError(`/super-admin/accounts/${id}`);
  }

  requireSuccess(`/super-admin/accounts/${id}`, "UPDATE", result, id);
  redirect(`/super-admin/accounts/${id}?success=updated`);
}

export async function resetPasswordAction(formData: FormData) {
  const actor = await requirePageAccess("SUPER_ADMIN");
  const id = text(formData.get("id"));
  const input = {
    password: text(formData.get("password")),
    confirmation: text(formData.get("confirmation")),
  };
  const parsed = passwordResetSchema.safeParse(input);

  if (!id || !parsed.success) {
    genericError(
      `/super-admin/accounts/${id}`,
      input.password !== input.confirmation ? "confirmation" : "policy",
    );
  }

  let result: AccountOperationResult;
  try {
    result = await service().resetPassword(
      actor,
      id,
      parsed.data.password,
      parsed.data.confirmation,
    );
  } catch {
    logFailure("RESET_PASSWORD", undefined, id);
    genericError(`/super-admin/accounts/${id}`);
  }

  requireSuccess(`/super-admin/accounts/${id}`, "RESET_PASSWORD", result, id);
  redirect(`/super-admin/accounts/${id}?success=reset`);
}

export async function setAccountActiveAction(formData: FormData) {
  const actor = await requirePageAccess("SUPER_ADMIN");
  const id = text(formData.get("id"));

  let result: AccountOperationResult;
  try {
    result = await service().setActive(actor, id, bool(formData.get("isActive")));
  } catch {
    logFailure("SET_ACTIVE", undefined, id);
    genericError(`/super-admin/accounts/${id}`);
  }

  requireSuccess(`/super-admin/accounts/${id}`, "SET_ACTIVE", result, id);
  redirect(`/super-admin/accounts/${id}?success=status`);
}

export async function forceLogoutAction(formData: FormData) {
  const actor = await requirePageAccess("SUPER_ADMIN");
  const id = text(formData.get("id"));

  let result: AccountOperationResult;
  try {
    result = await service().forceLogout(actor, id);
  } catch {
    logFailure("FORCE_LOGOUT", undefined, id);
    genericError(`/super-admin/accounts/${id}`);
  }

  requireSuccess(`/super-admin/accounts/${id}`, "FORCE_LOGOUT", result, id);
  redirect(`/super-admin/accounts/${id}?success=logout`);
}

export async function deleteAccountAction(formData: FormData) {
  const actor = await requirePageAccess("SUPER_ADMIN");
  const id = text(formData.get("id"));

  let result: AccountOperationResult;
  try {
    result = await service().deleteAccount(actor, id);
  } catch {
    logFailure("DELETE", undefined, id);
    genericError(`/super-admin/accounts/${id}`);
  }

  requireSuccess("/super-admin/accounts", "DELETE", result, id);
  redirect("/super-admin/accounts?success=deleted");
}
