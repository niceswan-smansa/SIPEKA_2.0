"use client";

import { useState, useTransition } from "react";

import {
  applyAttendanceAction,
  ATTENDANCE_STATUSES,
  buildOperations,
  previewAttendanceAction,
  type AttendancePreview,
  type AttendanceStatus,
} from "@/modules/attendance/client";
import { Alert, Button, FormField, Input, Select } from "@/shared/ui";

import type { StudentPeriodAttendance } from "../domain/student-attendance";

type Draft = Record<number, { status: AttendanceStatus; note: string } | null>;
const labels: Record<AttendanceStatus, string> = {
  IZIN: "Izin",
  SAKIT: "Sakit",
  TANPA_KETERANGAN: "Tanpa Keterangan",
};

export function StudentAttendanceEditor({
  studentId,
  classId,
  attendanceDate,
  periods,
}: {
  studentId: string;
  classId: string;
  attendanceDate: string;
  periods: StudentPeriodAttendance[];
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    Object.fromEntries(
      periods.map((item) => [item.periodNumber, { status: item.status, note: item.note ?? "" }]),
    ),
  );
  const [preview, setPreview] = useState<AttendancePreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const existing = periods.map((item) => ({
    id: item.id,
    periodNumber: item.periodNumber,
    status: item.status,
    note: item.note,
    version: 1,
  }));
  const payload = () => ({
    classId,
    attendanceDate,
    operations: buildOperations(studentId, draft, existing),
  });
  const previewNow = () =>
    startTransition(async () => {
      try {
        setMessage(null);
        setPreview(await previewAttendanceAction(payload()));
      } catch {
        setMessage("Preview koreksi presensi gagal.");
      }
    });
  const applyNow = () =>
    preview &&
    startTransition(async () => {
      try {
        const result = await applyAttendanceAction(payload(), preview.token);
        setPreview(null);
        setMessage(
          `Koreksi tersimpan: ${result.new} baru, ${result.update} diperbarui, ${result.delete} dihapus.`,
        );
      } catch {
        setMessage("Koreksi presensi gagal atau data sudah berubah.");
      }
    });
  return (
    <div className="grid gap-3">
      {message ? (
        <Alert tone={message.startsWith("Koreksi tersimpan") ? "success" : "error"}>
          {message}
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 10 }, (_, index) => {
          const period = index + 1;
          const value = draft[period] ?? null;
          return (
            <div key={period} className="rounded-lg border border-slate-200 p-3">
              <strong>Jam {period}</strong>
              <FormField id={`student-period-${period}`} label="Status" className="mt-2">
                <Select
                  id={`student-period-${period}`}
                  value={value?.status ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [period]: event.target.value
                        ? {
                            status: event.target.value as AttendanceStatus,
                            note: value?.note ?? "",
                          }
                        : null,
                    }))
                  }
                >
                  <option value="">Hadir (tanpa record)</option>
                  {ATTENDANCE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {labels[status]}
                    </option>
                  ))}
                </Select>
              </FormField>
              {value ? (
                <FormField id={`student-note-${period}`} label="Catatan" className="mt-2">
                  <Input
                    id={`student-note-${period}`}
                    value={value.note}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [period]: { ...value, note: event.target.value },
                      }))
                    }
                  />
                </FormField>
              ) : null}
            </div>
          );
        })}
      </div>
      <Button type="button" disabled={pending} onClick={previewNow}>
        Preview koreksi
      </Button>
      {preview ? (
        <div className="rounded-lg border border-slate-200 p-3 text-sm">
          Baru {preview.summary.new} · Diperbarui {preview.summary.update} · Dihapus{" "}
          {preview.summary.delete}
          <Button
            type="button"
            className="mt-3"
            disabled={pending || preview.summary.invalid > 0 || preview.summary.stale > 0}
            onClick={applyNow}
          >
            Konfirmasi koreksi
          </Button>
        </div>
      ) : null}
    </div>
  );
}
