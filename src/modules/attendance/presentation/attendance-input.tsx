"use client";

import { useMemo, useState, useTransition } from "react";

import { Alert, Badge, Button, Card, Checkbox, FormField, Input, Select } from "@/shared/ui";

import {
  ATTENDANCE_STATUSES,
  buildOperations,
  type AttendancePreview,
  type AttendanceStatus,
  type AttendanceStudent,
  type ClassAttendance,
} from "../domain/attendance";
import { applyAttendanceAction, previewAttendanceAction } from "./actions";

type Draft = Record<number, { status: AttendanceStatus; note: string } | null>;

function initialDraft(student: AttendanceStudent): Draft {
  const result: Draft = {};
  for (const item of student.attendance) {
    result[item.periodNumber] = { status: item.status, note: item.note ?? "" };
  }
  return result;
}

function label(status: AttendanceStatus) {
  return { IZIN: "Izin", SAKIT: "Sakit", TANPA_KETERANGAN: "Tanpa Keterangan" }[status];
}

export function AttendanceInput({ initial }: { initial: ClassAttendance }) {
  const items = initial.items;
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(initial.items.map((student) => [student.id, initialDraft(student)])),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>("IZIN");
  const [bulkPeriod, setBulkPeriod] = useState("all");
  const [preview, setPreview] = useState<AttendancePreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      `${item.fullName} ${item.nis} ${item.nisn}`.toLowerCase().includes(needle),
    );
  }, [items, search]);

  const updateDraft = (studentId: string, period: number, value: Draft[number]) => {
    setDrafts((current) => ({
      ...current,
      [studentId]: { ...current[studentId], [period]: value },
    }));
  };
  const applyBulk = () => {
    const periods =
      bulkPeriod === "all" ? Array.from({ length: 10 }, (_, i) => i + 1) : [Number(bulkPeriod)];
    setDrafts((current) => {
      const next = { ...current };
      for (const id of selected) {
        next[id] = { ...next[id] };
        for (const period of periods)
          next[id][period] = { status: bulkStatus, note: next[id][period]?.note ?? "" };
      }
      return next;
    });
  };
  const clearBulk = () => {
    const periods =
      bulkPeriod === "all" ? Array.from({ length: 10 }, (_, i) => i + 1) : [Number(bulkPeriod)];
    setDrafts((current) => {
      const next = { ...current };
      for (const id of selected) {
        next[id] = { ...next[id] };
        for (const period of periods) next[id][period] = null;
      }
      return next;
    });
  };
  const payload = () => ({
    classId: initial.classId,
    attendanceDate: initial.attendanceDate,
    operations: items.flatMap((student) =>
      buildOperations(student.id, drafts[student.id] ?? {}, student.attendance),
    ),
  });
  const previewNow = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await previewAttendanceAction(payload());
        setPreview(result);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Preview presensi gagal.");
      }
    });
  };
  const applyNow = () => {
    if (!preview || preview.summary.invalid > 0 || preview.summary.stale > 0) return;
    startTransition(async () => {
      try {
        const result = await applyAttendanceAction(payload(), preview.token);
        setMessage(
          `Presensi berhasil disimpan. Data baru: ${result.new}, diperbarui: ${result.update}, dihapus: ${result.delete}.`,
        );
        setPreview(null);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Penyimpanan presensi gagal.");
      }
    });
  };

  return (
    <div className="grid gap-5">
      {message ? <Alert tone="error">{message}</Alert> : null}
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <FormField id="attendance-search" label="Cari siswa">
            <Input
              id="attendance-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nama, NIS, atau NISN"
            />
          </FormField>
          <FormField id="bulk-status" label="Status terpilih">
            <Select
              id="bulk-status"
              value={bulkStatus}
              onChange={(event) => setBulkStatus(event.target.value as AttendanceStatus)}
            >
              {ATTENDANCE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {label(status)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="bulk-period" label="Jam terpilih">
            <Select
              id="bulk-period"
              value={bulkPeriod}
              onChange={(event) => setBulkPeriod(event.target.value)}
            >
              <option value="all">Semua Jam</option>
              {Array.from({ length: 10 }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  Jam {index + 1}
                </option>
              ))}
            </Select>
          </FormField>
          <Button type="button" onClick={applyBulk} disabled={selected.size === 0}>
            Terapkan Status
          </Button>
          <Button
            type="button"
            onClick={clearBulk}
            disabled={selected.size === 0}
            className="bg-slate-700 hover:bg-slate-800"
          >
            Clear Jam Terpilih
          </Button>
          <Button
            type="button"
            onClick={() => setSelected(new Set())}
            className="bg-slate-200 text-slate-800 hover:bg-slate-300"
          >
            Batalkan Semua
          </Button>
        </div>
      </Card>
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <Checkbox
              checked={visible.length > 0 && visible.every((student) => selected.has(student.id))}
              onChange={(event) =>
                setSelected(
                  event.target.checked ? new Set(visible.map((student) => student.id)) : new Set(),
                )
              }
            />{" "}
            Pilih Semua Siswa
          </label>
          <Badge>{visible.length} siswa</Badge>
        </div>
        <div className="divide-y divide-slate-200">
          {visible.map((student) => (
            <div
              key={student.id}
              className="grid gap-3 p-4 lg:grid-cols-[220px_1fr_180px] lg:items-start"
            >
              <label className="flex items-start gap-2">
                <Checkbox
                  checked={selected.has(student.id)}
                  onChange={(event) =>
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(student.id);
                      else next.delete(student.id);
                      return next;
                    })
                  }
                />
                <span>
                  <strong>{student.fullName}</strong>
                  <br />
                  <span className="text-xs text-slate-500">
                    {student.nis} · {student.nisn}
                  </span>
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {Array.from({ length: 10 }, (_, index) => {
                  const period = index + 1;
                  const value = drafts[student.id]?.[period] ?? null;
                  return (
                    <label key={period} className="grid gap-1 text-xs font-semibold text-slate-600">
                      <span>Jam {period}</span>
                      <Select
                        aria-label={`${student.fullName} Jam ${period}`}
                        value={value?.status ?? ""}
                        onChange={(event) =>
                          updateDraft(
                            student.id,
                            period,
                            event.target.value
                              ? {
                                  status: event.target.value as AttendanceStatus,
                                  note: value?.note ?? "",
                                }
                              : null,
                          )
                        }
                      >
                        <option value="">Hadir</option>
                        {ATTENDANCE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {label(status)}
                          </option>
                        ))}
                      </Select>
                    </label>
                  );
                })}
              </div>
              <Input
                aria-label={`Catatan ${student.fullName}`}
                placeholder="Catatan"
                value={Object.values(drafts[student.id] ?? {}).find(Boolean)?.note ?? ""}
                onChange={(event) => {
                  const next = { ...(drafts[student.id] ?? {}) };
                  for (const period of Object.keys(next))
                    if (next[Number(period)])
                      next[Number(period)] = { ...next[Number(period)]!, note: event.target.value };
                  setDrafts((current) => ({ ...current, [student.id]: next }));
                }}
              />
            </div>
          ))}
          {visible.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Tidak ada siswa yang sesuai.</p>
          ) : null}
        </div>
      </Card>
      <div className="flex justify-end">
        <Button type="button" onClick={previewNow} disabled={pending}>
          Preview Presensi
        </Button>
      </div>
      {preview ? (
        <Card>
          <h2 className="mb-3 text-lg font-bold">Preview perubahan</h2>
          <p className="mb-3 text-sm text-slate-600">
            Baru {preview.summary.new} · Diperbarui {preview.summary.update} · Dihapus{" "}
            {preview.summary.delete} · Tidak berubah {preview.summary.unchanged} · Invalid{" "}
            {preview.summary.invalid} · Stale {preview.summary.stale}
          </p>
          <Button
            type="button"
            onClick={applyNow}
            disabled={pending || preview.summary.invalid > 0 || preview.summary.stale > 0}
          >
            Konfirmasi dan Simpan
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
