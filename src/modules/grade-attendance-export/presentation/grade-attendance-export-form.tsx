"use client";

import { useState } from "react";

import { Button, FormField, Input, Select } from "@/shared/ui";

export function GradeAttendanceExportForm({
  activeYear,
  today,
}: {
  activeYear: {
    name: string;
    startDate: string;
    endDate: string;
  };
  today: string;
}) {
  const maximumDate = activeYear.endDate < today ? activeYear.endDate : today;
  const currentMonthStart = `${maximumDate.slice(0, 7)}-01`;
  const defaultFrom =
    currentMonthStart < activeYear.startDate ? activeYear.startDate : currentMonthStart;
  const [mode, setMode] = useState<"monthly" | "custom">("monthly");

  return (
    <form action="/api/reports/grade-attendance" className="grid gap-4" method="get">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField id="export-period-mode" label="Jenis periode">
          <Select
            id="export-period-mode"
            name="mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as "monthly" | "custom")}
          >
            <option value="monthly">Bulanan</option>
            <option value="custom">Rentang tanggal</option>
          </Select>
        </FormField>

        <FormField id="export-grade" label="Grade">
          <Select id="export-grade" name="grade" defaultValue="X" required>
            <option value="X">Grade X</option>
            <option value="XI">Grade XI</option>
            <option value="XII">Grade XII</option>
          </Select>
        </FormField>
      </div>

      {mode === "monthly" ? (
        <FormField id="export-month" label="Bulan">
          <Input
            id="export-month"
            type="month"
            name="month"
            min={activeYear.startDate.slice(0, 7)}
            max={maximumDate.slice(0, 7)}
            defaultValue={maximumDate.slice(0, 7)}
            required
          />
        </FormField>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <FormField id="export-from" label="Tanggal mulai">
            <Input
              id="export-from"
              type="date"
              name="from"
              min={activeYear.startDate}
              max={maximumDate}
              defaultValue={defaultFrom}
              required
            />
          </FormField>

          <FormField id="export-to" label="Tanggal akhir">
            <Input
              id="export-to"
              type="date"
              name="to"
              min={activeYear.startDate}
              max={maximumDate}
              defaultValue={maximumDate}
              required
            />
          </FormField>
        </div>
      )}

      <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Tahun ajaran aktif: <strong>{activeYear.name}</strong>. Satu file akan berisi tab Ringkasan
        dan satu tab untuk setiap kelas pada grade yang dipilih.
      </div>

      <div>
        <Button type="submit">Export Excel</Button>
      </div>
    </form>
  );
}
