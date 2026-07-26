"use client";

import { useMemo, useState } from "react";

import { Button, Card, EmptyState, Input, Select } from "@/shared/ui";

import {
  csvTemplate,
  importStudentsAction,
  previewStudentCsv,
  type ImportPreviewRow,
} from "../client";

type AcademicYearOption = {
  id: string;
  name: string;
};

type ClassOption = {
  id: string;
  academicYearId: string;
  label: string;
};

type DraftBatch = {
  id: string;
  academicYearId: string;
  classId: string;
  fileName: string;
  rows: ImportPreviewRow[];
  error: string;
};

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export function StudentImportPreview({
  academicYears,
  classes,
}: {
  academicYears: AcademicYearOption[];
  classes: ClassOption[];
}) {
  const [selectedYearId, setSelectedYearId] = useState(academicYears[0]?.id ?? "");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [batches, setBatches] = useState<DraftBatch[]>([]);
  const [builderError, setBuilderError] = useState("");

  const availableClasses = classes.filter((item) => item.academicYearId === selectedYearId);

  const identifiers = useMemo(() => {
    const nis = new Map<string, number>();
    const nisn = new Map<string, number>();

    for (const batch of batches) {
      for (const row of batch.rows) {
        if (row.nis) nis.set(row.nis, (nis.get(row.nis) ?? 0) + 1);
        if (row.nisn) nisn.set(row.nisn, (nisn.get(row.nisn) ?? 0) + 1);
      }
    }

    return {
      duplicateNis: new Set(
        [...nis.entries()].filter(([, count]) => count > 1).map(([value]) => value),
      ),
      duplicateNisn: new Set(
        [...nisn.entries()].filter(([, count]) => count > 1).map(([value]) => value),
      ),
    };
  }, [batches]);

  const rowErrors = (row: ImportPreviewRow) => {
    const errors = [...row.errors];
    if (row.nis && identifiers.duplicateNis.has(row.nis)) {
      errors.push("NIS duplikat lintas file.");
    }
    if (row.nisn && identifiers.duplicateNisn.has(row.nisn)) {
      errors.push("NISN duplikat lintas file.");
    }
    return errors;
  };

  const totalRows = batches.reduce((total, batch) => total + batch.rows.length, 0);
  const valid =
    batches.length > 0 &&
    totalRows <= 5000 &&
    batches.every(
      (batch) =>
        batch.fileName &&
        batch.rows.length > 0 &&
        !batch.error &&
        batch.rows.every((row) => rowErrors(row).length === 0),
    );

  const classLabel = (classId: string) =>
    classes.find((item) => item.id === classId)?.label ?? "Kelas tidak ditemukan";
  const yearLabel = (yearId: string) =>
    academicYears.find((item) => item.id === yearId)?.name ?? "Tahun tidak ditemukan";

  const addBatch = () => {
    setBuilderError("");

    if (!selectedYearId || !selectedClassId) {
      setBuilderError("Pilih tahun ajaran aktif dan kelas tujuan.");
      return;
    }

    if (batches.length >= 30) {
      setBuilderError("Maksimum 30 file dalam satu bulk import.");
      return;
    }

    if (
      batches.some(
        (batch) => batch.academicYearId === selectedYearId && batch.classId === selectedClassId,
      )
    ) {
      setBuilderError("Kelas tersebut sudah memiliki bar upload.");
      return;
    }

    setBatches((current) => [
      ...current,
      {
        id: newId(),
        academicYearId: selectedYearId,
        classId: selectedClassId,
        fileName: "",
        rows: [],
        error: "",
      },
    ]);
    setSelectedClassId("");
  };

  const updateBatch = (id: string, update: Partial<DraftBatch>) => {
    setBatches((current) =>
      current.map((batch) => (batch.id === id ? { ...batch, ...update } : batch)),
    );
  };

  if (academicYears.length === 0) {
    return (
      <Card>
        <EmptyState>
          Belum ada tahun ajaran aktif. Selesaikan Pengaturan Awal atau promotion terlebih dahulu.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="grid gap-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Siapkan file per kelas</h2>
            <p className="mt-1 text-sm text-slate-600">
              Pilih tahun ajaran aktif dan kelas, klik Tambah file, lalu unggah CSV pada bar yang
              muncul. Tahun masuk dihitung otomatis dari tahun ajaran dan grade kelas. Seluruh file
              disimpan dalam satu transaksi all-or-none.
            </p>
          </div>
          <a
            className="font-semibold text-[var(--brand)] underline"
            download="template-import-siswa.csv"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvTemplate())}`}
          >
            Download template CSV
          </a>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-1 text-sm font-semibold">
            Tahun ajaran aktif
            <Select
              value={selectedYearId}
              onChange={(event) => {
                setSelectedYearId(event.target.value);
                setSelectedClassId("");
                setBuilderError("");
              }}
            >
              {academicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-1 text-sm font-semibold">
            Kelas tujuan
            <Select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
            >
              <option value="">Pilih kelas</option>
              {availableClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </Select>
          </label>

          <div className="flex items-end">
            <Button type="button" onClick={addBatch}>
              Tambah file
            </Button>
          </div>
        </div>

        {builderError ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {builderError}
          </p>
        ) : null}
      </Card>

      {batches.map((batch, index) => (
        <Card key={batch.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--brand)]">File {index + 1}</p>
              <h2 className="text-lg font-bold">
                {yearLabel(batch.academicYearId)} · {classLabel(batch.classId)}
              </h2>
            </div>
            <Button
              type="button"
              className="bg-red-700 hover:bg-red-800"
              onClick={() =>
                setBatches((current) => current.filter((item) => item.id !== batch.id))
              }
            >
              Hapus bar
            </Button>
          </div>

          <label
            htmlFor={`bulk-file-${batch.id}`}
            className="mt-4 grid gap-1 text-sm font-semibold"
          >
            File CSV
            <Input
              id={`bulk-file-${batch.id}`}
              accept=".csv,text/csv"
              type="file"
              required
              onChange={async (event) => {
                const file = event.target.files?.[0];
                updateBatch(batch.id, { rows: [], fileName: "", error: "" });
                if (!file) return;

                if (file.size > 1_000_000) {
                  updateBatch(batch.id, { error: "Ukuran file maksimum 1 MB." });
                  return;
                }

                try {
                  updateBatch(batch.id, {
                    rows: previewStudentCsv(await file.text()),
                    fileName: file.name,
                    error: "",
                  });
                } catch {
                  updateBatch(batch.id, {
                    error: "CSV tidak valid. Periksa header, kutip, dan jumlah baris.",
                  });
                }
              }}
            />
          </label>

          {batch.error ? (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {batch.error}
            </p>
          ) : null}

          {batch.rows.length ? (
            <p className="mt-3 text-sm text-slate-600">{batch.rows.length} baris dipreview.</p>
          ) : null}
        </Card>
      ))}

      {batches.length ? (
        <form action={importStudentsAction}>
          <input
            type="hidden"
            name="batches"
            value={JSON.stringify(
              batches.map((batch) => ({
                academicYearId: batch.academicYearId,
                classId: batch.classId,
                fileName: batch.fileName,
                rows: batch.rows.map(({ nis, nisn, name, gender }) => ({
                  nis,
                  nisn,
                  name,
                  gender,
                })),
              })),
            )}
          />
          <Button disabled={!valid} type="submit">
            Simpan bulk import {totalRows} siswa dari {batches.length} file
          </Button>
          {totalRows > 5000 ? (
            <p role="alert" className="mt-2 text-sm text-red-700">
              Jumlah seluruh baris maksimum 5000.
            </p>
          ) : null}
        </form>
      ) : null}

      {batches.some((batch) => batch.rows.length > 0) ? (
        <Card>
          <h2 className="font-bold">Preview seluruh file</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Kelas</th>
                  <th>Baris</th>
                  <th>NIS</th>
                  <th>NISN</th>
                  <th>Nama</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.flatMap((batch) =>
                  batch.rows.map((row) => {
                    const errors = rowErrors(row);
                    return (
                      <tr key={`${batch.id}-${row.row}`} className="border-t">
                        <td>{batch.fileName}</td>
                        <td>{classLabel(batch.classId)}</td>
                        <td>{row.row}</td>
                        <td>{row.nis}</td>
                        <td>{row.nisn}</td>
                        <td>{row.name}</td>
                        <td>{errors.length ? errors.join(" ") : "Valid"}</td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
