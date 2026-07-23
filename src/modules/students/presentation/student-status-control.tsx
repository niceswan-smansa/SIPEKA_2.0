"use client";

import { useState } from "react";

import { Button, ConfirmDialog } from "@/shared/ui";

export function StudentStatusControl({
  id,
  name,
  grade,
  classId,
  isActive,
  action,
}: {
  id: string;
  name: string;
  grade: "X" | "XI" | "XII";
  classId: string;
  isActive: boolean;
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        className={
          isActive ? "bg-amber-700 hover:bg-amber-800" : "bg-emerald-700 hover:bg-emerald-800"
        }
        onClick={() => setOpen(true)}
      >
        {isActive ? "Nonaktifkan siswa" : "Aktifkan siswa"}
      </Button>
      <ConfirmDialog
        open={open}
        title={isActive ? "Nonaktifkan siswa" : "Aktifkan siswa"}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          const data = new FormData();
          data.set("id", id);
          data.set("grade", grade);
          data.set("classId", classId);
          data.set("isActive", String(!isActive));
          setOpen(false);
          await action(data);
        }}
      >
        {isActive
          ? `${name} tidak akan muncul pada daftar operasional default. Histori tetap disimpan.`
          : `${name} akan diaktifkan kembali pada kelas yang dipilih.`}
      </ConfirmDialog>
    </>
  );
}
