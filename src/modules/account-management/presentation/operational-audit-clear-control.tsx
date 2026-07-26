"use client";

import { useState } from "react";

import { Button, Dialog, FormField, Input } from "@/shared/ui";

type Action = (formData: FormData) => Promise<void>;

const CONFIRMATION = "HAPUS SEMUA RIWAYAT OPERASIONAL";

export function OperationalAuditClearControl({ action, count }: { action: Action; count: number }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);

  const close = () => {
    if (pending) return;
    setOpen(false);
    setConfirmation("");
  };

  const submit = async () => {
    const data = new FormData();
    data.set("confirmation", confirmation);
    setPending(true);
    try {
      await action(data);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        className="bg-red-700 hover:bg-red-800"
        disabled={count === 0}
        onClick={() => setOpen(true)}
      >
        Hapus riwayat operasional
      </Button>

      <Dialog open={open} title="Hapus semua riwayat operasional" onClose={close}>
        <p className="text-sm text-slate-600">
          Sebanyak {count} catatan aktivitas operasional akan dihapus permanen. Data siswa,
          presensi, histori enrollment, histori koreksi presensi, dan riwayat akun tidak ikut
          dihapus.
        </p>

        <div className="mt-4">
          <FormField
            id="operational-audit-confirmation"
            label={`Ketik ${CONFIRMATION} untuk melanjutkan`}
          >
            <Input
              id="operational-audit-confirmation"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </FormField>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            className="bg-slate-200 text-slate-800 hover:bg-slate-300"
            disabled={pending}
            onClick={close}
          >
            Batal
          </Button>
          <Button
            type="button"
            className="bg-red-700 hover:bg-red-800"
            disabled={pending || confirmation !== CONFIRMATION}
            onClick={submit}
          >
            {pending ? "Menghapus…" : "Hapus permanen"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
