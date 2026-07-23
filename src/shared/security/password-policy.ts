import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_POLICY_MESSAGE =
  "Password harus 12–128 karakter dan memuat huruf besar, huruf kecil, angka, serta simbol.";

export type PasswordPolicyReason = "LENGTH" | "LOWERCASE" | "UPPERCASE" | "NUMBER" | "SYMBOL";

export function passwordPolicyReasons(password: string): PasswordPolicyReason[] {
  const reasons: PasswordPolicyReason[] = [];
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH)
    reasons.push("LENGTH");
  if (!/[a-z]/.test(password)) reasons.push("LOWERCASE");
  if (!/[A-Z]/.test(password)) reasons.push("UPPERCASE");
  if (!/[0-9]/.test(password)) reasons.push("NUMBER");
  if (!/[!-/:-@[-`{-~]/.test(password)) reasons.push("SYMBOL");
  return reasons;
}

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE)
  .max(PASSWORD_MAX_LENGTH, PASSWORD_POLICY_MESSAGE)
  .refine((password) => passwordPolicyReasons(password).length === 0, PASSWORD_POLICY_MESSAGE);
