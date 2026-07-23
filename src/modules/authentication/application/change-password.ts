import type { AccountProfile } from "@/shared/permissions";
import { passwordPolicyReasons } from "@/shared/security/password-policy";

import type { AuthenticationGateway } from "../domain/authentication";

export type ChangePasswordErrorCode =
  | "mismatch"
  | "policy"
  | "same-password"
  | "weak-password"
  | "session-expired"
  | "provider"
  | "completion-pending";
export type ChangePasswordResult =
  { ok: true } | { ok: false; code: ChangePasswordErrorCode; passwordUpdated?: true };

export async function changePassword(
  gateway: AuthenticationGateway,
  profile: AccountProfile,
  password: string,
  confirmation: string,
): Promise<ChangePasswordResult> {
  if (password !== confirmation) {
    return { code: "mismatch", ok: false };
  }

  if (passwordPolicyReasons(password).length) return { code: "policy", ok: false };

  const update = await gateway.updatePassword(password);
  if (!update.ok) {
    const code = {
      PROVIDER_FAILURE: "provider",
      REAUTHENTICATION_REQUIRED: "provider",
      SAME_PASSWORD: "same-password",
      SESSION_EXPIRED: "session-expired",
      WEAK_PASSWORD: "weak-password",
    }[update.reason] as ChangePasswordErrorCode;
    return { code, ok: false };
  }

  if (!(await gateway.completePasswordChange(profile))) {
    return { code: "completion-pending", ok: false, passwordUpdated: true };
  }

  return { ok: true };
}
