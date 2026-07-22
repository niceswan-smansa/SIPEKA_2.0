import type { AccountProfile } from "@/shared/permissions";

import type { AuthenticationGateway } from "../domain/authentication";

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;

export type ChangePasswordResult = { ok: true } | { ok: false; message: string };

export async function changePassword(
  gateway: AuthenticationGateway,
  profile: AccountProfile,
  password: string,
  confirmation: string,
): Promise<ChangePasswordResult> {
  if (password !== confirmation) {
    return { message: "Konfirmasi password tidak cocok.", ok: false };
  }

  if (!STRONG_PASSWORD.test(password)) {
    return {
      message:
        "Password minimal 12 karakter dan memuat huruf besar, huruf kecil, angka, serta simbol.",
      ok: false,
    };
  }

  if (!(await gateway.updatePassword(password))) {
    return { message: "Password tidak dapat diperbarui.", ok: false };
  }

  if (!(await gateway.completePasswordChange(profile))) {
    return { message: "Password tidak dapat diperbarui.", ok: false };
  }

  return { ok: true };
}
