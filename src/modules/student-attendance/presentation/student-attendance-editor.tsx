"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  applyAttendanceAction,
  attendanceFailureMessage,
  ATTENDANCE_STATUSES,
  buildOperations,
  previewAttendanceAction,
  type AttendancePreview,
  type AttendanceStatus,
} from "@/modules/attendance/client";
import { Alert, Button, FormField, Input, Select } from "@/shared/ui";

import type { StudentPeriodAttendance } from "../domain/student-attendance";

type Draft = Record<number, { status: AttendanceStatus; note: string } | null>;
type Message = { tone: "success" | "error" | "info"; text: string };
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
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() =>
    Object.fromEntries(
      periods.map((item) => [item.periodNumber, { status: item.status, note: item.note ?? "" }]),
    ),
  );
  const [preview, setPreview] = useState<AttendancePreview | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, startTransition] = useTransition();
  const existing = useMemo(
    () =>
      periods.map((item) => ({
        id: item.id,
        periodNumber: item.periodNumber,
        status: item.status,
        note: item.note,
        version: 1,
      })),
    [periods],
  );
  const operations = useMemo(
    () => buildOperations(studentId, draft, existing),
    [draft, existing, studentId],
  );
  const payload = () => ({
    classId,
    attendanceDate,
    operations,
  });
  const previewNow = () => {
    setMessage(null);
    if (operations.length === 0) {
      setPreview(null);
      setMessage({ tone: "info", text: "Tidak ada perubahan presensi yang perlu dipreview." });
      return;
    }
    startTransition(async () => {
      const response = await previewAttendanceAction(payload());
      if (!response.ok) {
        setPreview(null);
        setMessage(attendanceFailureMessage(response.code, response.referenceId));
        return;
      }
      setPreview(response.data);
    });
  };
  const applyNow = () => {
    if (!preview) return;
    startTransition(async () => {
      const response = await applyAttendanceAction(payload(), preview.token);
      if (!response.ok) {
        setPreview(null);
        setMessage(attendanceFailureMessage(response.code, response.referenceId));
        return;
      }
      setPreview(null);
      setMessage({
        tone: "success",
        text: `Koreksi tersimpan: ${response.data.new} baru, ${response.data.update} diperbarui, ${response.data.delete} dihapus.`,
      });
      router.refresh();
    });
  };
  return (
    <div className="grid gap-3">
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
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
                  onChange={(event) => {
                    setPreview(null);
                    setDraft((current) => ({
                      ...current,
                      [period]: event.target.value
                        ? {
                            status: event.target.value as AttendanceStatus,
                            note: value?.note ?? "",
                          }
                        : null,
                    }));
                  }}
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
                    maxLength={500}
                    value={value.note}
                    onChange={(event) => {
                      setPreview(null);
                      setDraft((current) => ({
                        ...current,
                        [period]: { ...value, note: event.target.value },
                      }));
                    }}
                  />
                </FormField>
              ) : null}
            </div>
          );
        })}
      </div>
      <Button type="button" disabled={pending || operations.length === 0} onClick={previewNow}>
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
