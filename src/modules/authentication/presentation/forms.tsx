"use client";

import { useFormStatus } from "react-dom";

import { Button, FormError, FormField, Input, PasswordInput } from "@/shared/ui";

import { changePasswordAction, loginAction } from "./actions";

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
    <form action={changePasswordAction} className="grid gap-5">
      {error ? (
        <FormError>
          {error === "validation"
            ? "Password belum memenuhi ketentuan."
            : "Password tidak dapat diperbarui."}
        </FormError>
      ) : null}
      <FormField id="new-password" label="Password baru">
        <PasswordInput id="new-password" name="password" autoComplete="new-password" required />
      </FormField>
      <FormField id="password-confirmation" label="Konfirmasi password">
        <PasswordInput
          id="password-confirmation"
          name="confirmation"
          autoComplete="new-password"
          required
        />
      </FormField>
      <p className="text-xs text-slate-500">
        Minimal 12 karakter dengan huruf besar, huruf kecil, angka, dan simbol.
      </p>
      <SubmitButton>Simpan Password</SubmitButton>
    </form>
  );
}
