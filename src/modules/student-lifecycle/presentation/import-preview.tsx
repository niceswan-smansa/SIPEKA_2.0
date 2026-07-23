"use client";

import { useState } from "react";

import { Button, Card, Input, Select } from "@/shared/ui";

import {
  csvTemplate,
  importStudentsAction,
  previewStudentCsv,
  type ImportPreviewRow,
} from "../client";

export function StudentImportPreview({ classes }: { classes: { id: string; label: string }[] }) {
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const valid = rows.length > 0 && rows.every((row) => row.errors.length === 0);

  return (
    <div className="grid gap-5">
      <Card>
        <a
          className="font-semibold text-[var(--brand)] underline"
          download="template-import-siswa.csv"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvTemplate())}`}
        >
          Download template CSV
        </a>
        <form action={importStudentsAction} className="mt-5 grid gap-4">
          <label className="grid gap-1 text-sm font-semibold">
            Kelas aktif
            <Select name="classId" required>
              <option value="">Pilih kelas</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Tahun masuk
            <Input name="yearEntered" type="number" min={2000} max={2200} required />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            File CSV
            <Input
              accept=".csv,text/csv"
              type="file"
              required
              onChange={async (event) => {
                const file = event.target.files?.[0];
                setRows([]);
                setError("");
                if (!file) return;
                if (file.size > 1_000_000) {
                  setError("Ukuran file maksimum 1 MB.");
                  return;
                }
                try {
                  setRows(previewStudentCsv(await file.text()));
                  setFileName(file.name);
                } catch {
                  setError("CSV tidak valid. Periksa header, kutip, dan jumlah baris.");
                }
              }}
            />
          </label>
          <input type="hidden" name="fileName" value={fileName} />
          <input
            type="hidden"
            name="rows"
            value={JSON.stringify(
              rows.map(({ nis, nisn, name, gender }) => ({ nis, nisn, name, gender })),
            )}
          />
          {error ? (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <Button disabled={!valid} type="submit">
            Konfirmasi import {valid ? `${rows.length} siswa` : ""}
          </Button>
        </form>
      </Card>
      {rows.length ? (
        <Card>
          <h2 className="font-bold">Preview per baris</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Baris</th>
                  <th>NIS</th>
                  <th>NISN</th>
                  <th>Nama</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.row} className="border-t">
                    <td>{row.row}</td>
                    <td>{row.nis}</td>
                    <td>{row.nisn}</td>
                    <td>{row.name}</td>
                    <td>{row.errors.length ? row.errors.join(" ") : "Valid"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
