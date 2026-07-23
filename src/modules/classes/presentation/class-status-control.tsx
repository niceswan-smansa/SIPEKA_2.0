"use client";

import { useState } from "react";

import { Button, ConfirmDialog } from "@/shared/ui";

export function ClassStatusControl({
  id,
  label,
  academicYearId,
  homeroomTeacher,
  notes,
  isActive,
  action,
}: {
  id: string;
  label: string;
  academicYearId: string;
  homeroomTeacher: string;
  notes: string;
  isActive: boolean;
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        className="bg-slate-200 text-slate-800 hover:bg-slate-300"
        onClick={() => setOpen(true)}
      >
        {isActive ? "Nonaktifkan" : "Aktifkan"}
      </Button>
      <ConfirmDialog
        open={open}
        title={`${isActive ? "Nonaktifkan" : "Aktifkan"} ${label}`}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          const data = new FormData();
          data.set("id", id);
          data.set("academicYearId", academicYearId);
          data.set("homeroomTeacher", homeroomTeacher);
          data.set("notes", notes);
          data.set("isActive", String(!isActive));
          setOpen(false);
          await action(data);
        }}
      >
        Kelas hanya dapat dinonaktifkan bila tidak mempunyai siswa aktif/current enrollment.
      </ConfirmDialog>
    </>
  );
}
