"use client";

import { useState } from "react";

import { Button, ConfirmDialog, Dialog, FormField, PasswordInput } from "@/shared/ui";

type Action = (formData: FormData) => Promise<void>;

export function AccountMutationControls({
  id,
  fullName,
  isActive,
  resetAction,
  statusAction,
  deleteAction,
}: {
  id: string;
  fullName: string;
  isActive: boolean;
  resetAction: Action;
  statusAction: Action;
  deleteAction: Action;
}) {
  const [dialog, setDialog] = useState<"reset" | "deactivate" | "delete" | null>(null);
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const submit = async (action: Action, values: Record<string, string>) => {
    const data = new FormData();
    data.set("id", id);
    Object.entries(values).forEach(([key, value]) => data.set(key, value));

    setPending(true);
    try {
      await action(data);
    } finally {
      setPassword("");
      setConfirmation("");
      setPending(false);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        className="bg-slate-700 hover:bg-slate-800"
        onClick={() => setDialog("reset")}
      >
        Reset Password
      </Button>

      <p className="self-center text-xs text-slate-500">
        Pencabutan seluruh sesi belum didukung penyedia autentikasi.
      </p>

      <Button
        type="button"
        className="bg-amber-600 hover:bg-amber-700"
        onClick={() => setDialog("deactivate")}
      >
        {isActive ? "Nonaktifkan" : "Aktifkan"}
      </Button>

      <Button
        type="button"
        className="bg-red-700 hover:bg-red-800"
        onClick={() => setDialog("delete")}
      >
        Hapus Akses
      </Button>

      <Dialog
        open={dialog === "reset"}
        title="Password sementara"
        onClose={() => {
          if (!pending) setDialog(null);
        }}
      >
        <div className="grid gap-4">
          <FormField id="reset-password" label="Password baru">
            <PasswordInput
              id="reset-password"
              name="password"
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>

          <FormField id="reset-confirmation" label="Konfirmasi password">
            <PasswordInput
              id="reset-confirmation"
              name="confirmation"
              required
              minLength={12}
              maxLength={128}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </FormField>
        </div>

        <p className="mt-3 text-xs text-slate-500">
          12–128 karakter dengan huruf besar, huruf kecil, angka, dan simbol.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            disabled={pending}
            className="bg-slate-200 text-slate-800"
            onClick={() => setDialog(null)}
          >
            Batal
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => submit(resetAction, { password, confirmation })}
          >
            {pending ? "Memproses…" : "Simpan"}
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={dialog === "deactivate"}
        title={isActive ? "Nonaktifkan akun" : "Aktifkan akun"}
        onCancel={() => setDialog(null)}
        onConfirm={() => submit(statusAction, { isActive: String(!isActive) })}
      >
        {isActive
          ? `Akun ${fullName} akan ditolak dari aplikasi.`
          : `Akun ${fullName} akan dapat digunakan kembali.`}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "delete"}
        title="Hapus akses akun"
        onCancel={() => setDialog(null)}
        onConfirm={() => submit(deleteAction, {})}
      >
        Akses {fullName} akan dihapus melalui tombstone. Riwayat audit tetap dipertahankan.
      </ConfirmDialog>
    </div>
  );
}
