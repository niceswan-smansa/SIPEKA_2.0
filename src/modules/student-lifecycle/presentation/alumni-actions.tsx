"use client";

import type { FormEvent } from "react";

import { archiveAlumniAction, tombstoneAlumniAction } from "../client";
import { Button } from "@/shared/ui";

export function AlumniActions({ studentId, archived }: { studentId: string; archived: boolean }) {
  const confirmAction = (message: string) => (event: FormEvent<HTMLFormElement>) => {
    if (!window.confirm(message)) event.preventDefault();
  };
  return archived ? (
    <form
      action={tombstoneAlumniAction}
      onSubmit={confirmAction(
        "Identitas alumni akan ditombstone dan histori tetap dipertahankan. Lanjutkan?",
      )}
    >
      <input type="hidden" name="studentId" value={studentId} />
      <Button type="submit">Hapus identitas permanen</Button>
    </form>
  ) : (
    <form
      action={archiveAlumniAction}
      onSubmit={confirmAction("Arsipkan alumni? Histori tetap dipertahankan.")}
    >
      <input type="hidden" name="studentId" value={studentId} />
      <Button type="submit">Arsipkan</Button>
    </form>
  );
}
