"use client";

import { useState } from "react";

import { ConfirmDialog, Button, Dialog, FormField, PasswordInput } from "@/shared/ui";

type Action = (formData: FormData) => Promise<void>;
export function AccountMutationControls({
  id,
  fullName,
  isActive,
  resetAction,
  statusAction,
  forceLogoutAction,
  deleteAction,
}: {
  id: string;
  fullName: string;
  isActive: boolean;
  resetAction: Action;
  statusAction: Action;
  forceLogoutAction: Action;
  deleteAction: Action;
}) {
  const [dialog, setDialog] = useState<"reset" | "deactivate" | "logout" | "delete" | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const submit = async (action: Action, values: Record<string, string>) => {
    const data = new FormData();
    data.set("id", id);
    Object.entries(values).forEach(([key, value]) => data.set(key, value));
    await action(data);
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
      <Button
        type="button"
        className="bg-slate-200 text-slate-800 hover:bg-slate-300"
        onClick={() => setDialog("logout")}
      >
        Force Logout (jika didukung)
      </Button>
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
      <Dialog open={dialog === "reset"} title="Password sementara" onClose={() => setDialog(null)}>
        <div className="grid gap-4">
          <FormField id="reset-password" label="Password baru">
            <PasswordInput
              id="reset-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>
          <FormField id="reset-confirmation" label="Konfirmasi password">
            <PasswordInput
              id="reset-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </FormField>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            className="bg-slate-200 text-slate-800"
            onClick={() => setDialog(null)}
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={async () => {
              setDialog(null);
              await submit(resetAction, { password, confirmation });
            }}
          >
            Simpan
          </Button>
        </div>
      </Dialog>
      <ConfirmDialog
        open={dialog === "deactivate"}
        title={isActive ? "Nonaktifkan akun" : "Aktifkan akun"}
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          setDialog(null);
          await submit(statusAction, { isActive: String(!isActive) });
        }}
      >
        {isActive
          ? `Akun ${fullName} akan ditolak dari aplikasi.`
          : `Akun ${fullName} akan dapat digunakan kembali.`}
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === "logout"}
        title="Force logout"
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          setDialog(null);
          await submit(forceLogoutAction, {});
        }}
      >
        Penyedia autentikasi harus mengonfirmasi pencabutan semua sesi. Jika tidak didukung, operasi
        akan dilaporkan gagal dan tidak menampilkan pesan berhasil.
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === "delete"}
        title="Hapus akses akun"
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          setDialog(null);
          await submit(deleteAction, {});
        }}
      >
        Akses {fullName} akan dihapus melalui tombstone. Riwayat audit tetap dipertahankan.
      </ConfirmDialog>
    </div>
  );
}
