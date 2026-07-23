"use client";

import { useState } from "react";

import { Button, ConfirmDialog } from "@/shared/ui";

import { promoteStudentsAction, rollbackPromotionAction } from "./actions";

type PromotionSummary = {
  toYearId: string;
  fromYearName: string;
  toYearName: string;
  total: number;
  xToXi: number;
  xiToXii: number;
  xiiToAlumni: number;
};

export function PromotionApplyControl({ summary }: { summary: PromotionSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Konfirmasi dan jalankan promotion
      </Button>

      <ConfirmDialog
        open={open}
        title="Jalankan promotion"
        confirmLabel="Ya, jalankan promotion"
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          const formData = new FormData();
          formData.set("academicYearId", summary.toYearId);
          await promoteStudentsAction(formData);
        }}
      >
        {summary.fromYearName} → {summary.toYearName}. Total {summary.total} siswa: {summary.xToXi}{" "}
        siswa X → XI, {summary.xiToXii} siswa XI → XII, dan {summary.xiiToAlumni} siswa XII →
        Alumni.
      </ConfirmDialog>
    </>
  );
}

export function PromotionRollbackControl({
  batchId,
  fromYear,
  toYear,
}: {
  batchId: string;
  fromYear: string;
  toYear: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Rollback snapshot batch
      </Button>

      <ConfirmDialog
        open={open}
        title="Rollback promotion"
        confirmLabel="Ya, rollback batch"
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          const formData = new FormData();
          formData.set("batchId", batchId);
          await rollbackPromotionAction(formData);
        }}
      >
        Kembalikan snapshot promotion {fromYear} → {toYear}. Operasi ini hanya memakai snapshot
        batch yang tersimpan.
      </ConfirmDialog>
    </>
  );
}
