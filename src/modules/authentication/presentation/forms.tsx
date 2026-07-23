"use client";

import { useFormStatus } from "react-dom";

import { Button, FormError, FormField, Input, PasswordInput } from "@/shared/ui";

import { changePasswordAction, loginAction, retryPasswordCompletionAction } from "./actions";

const passwordErrors: Record<string, string> = {
  mismatch: "Konfirmasi password tidak cocok.",
  policy:
    "Password harus 12–128 karakter dan memuat huruf besar, huruf kecil, angka, serta simbol.",
  "same-password": "Password baru harus berbeda dari password sementara atau password saat ini.",
  "weak-password":
    "Password harus 12–128 karakter dan memuat huruf besar, huruf kecil, angka, serta simbol.",
  "session-expired": "Sesi Anda telah berakhir. Silakan masuk kembali.",
  provider: "Password belum dapat diperbarui. Silakan coba kembali.",
  "completion-pending":
    "Password sudah berubah, tetapi status akun belum terselesaikan. Coba selesaikan kembali tanpa mengganti password lagi.",
};

function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Memproses…" : children}
    </Button>
  );
}

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  return (
    <form action={loginAction} className="grid gap-5">
      <FormField id="identifier" label="Username">
        <Input id="identifier" name="identifier" autoComplete="username" required />
      </FormField>
      <FormField id="password" label="Password">
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </FormField>
      {redirectTo ? <input name="redirectTo" type="hidden" value={redirectTo} /> : null}
      <SubmitButton>Masuk</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm({ error }: { error?: string }) {
  return (
    <div className="grid gap-4">
      <form action={changePasswordAction} className="grid gap-5">
        {error ? <FormError>{passwordErrors[error] ?? passwordErrors.provider}</FormError> : null}
        <FormField id="new-password" label="Password baru">
          <PasswordInput
            id="new-password"
            name="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </FormField>
        <FormField id="password-confirmation" label="Konfirmasi password">
          <PasswordInput
            id="password-confirmation"
            name="confirmation"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </FormField>
        <p className="text-xs text-slate-500">
          12–128 karakter dengan huruf besar, huruf kecil, angka, dan simbol.
        </p>
        <SubmitButton>Simpan Password</SubmitButton>
      </form>

      {error === "completion-pending" ? (
        <form action={retryPasswordCompletionAction}>
          <SubmitButton>Coba selesaikan status akun</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
