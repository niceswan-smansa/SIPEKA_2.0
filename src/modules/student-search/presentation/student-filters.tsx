"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button, FormField, Input, Select } from "@/shared/ui";

export function StudentFilters({
  classes,
  defaultStatus = "active",
}: {
  classes: { id: string; grade: "X" | "XI" | "XII"; classNumber: number }[];
  defaultStatus?: "active" | "inactive" | "";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [query, setQuery] = useState(current.get("q") ?? "");

  const update = (values: Record<string, string>) => {
    const params = new URLSearchParams(current.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (query !== (current.get("q") ?? "")) update({ q: query });
    }, 300);
    return () => window.clearTimeout(timeout);
    // Search params intentionally trigger synchronization with URL state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, current]);

  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      <FormField id="student-search" label="Cari nama, NIS, atau NISN">
        <Input
          id="student-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Contoh: nabil"
        />
      </FormField>
      <FormField id="student-grade" label="Grade">
        <Select
          id="student-grade"
          value={current.get("grade") ?? ""}
          onChange={(event) => update({ grade: event.target.value, classId: "" })}
        >
          <option value="">Semua grade</option>
          <option value="X">X</option>
          <option value="XI">XI</option>
          <option value="XII">XII</option>
        </Select>
      </FormField>
      <FormField id="student-class" label="Kelas">
        <Select
          id="student-class"
          value={current.get("classId") ?? ""}
          onChange={(event) => update({ classId: event.target.value })}
        >
          <option value="">Semua kelas</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.grade}-{item.classNumber}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField id="student-status" label="Status">
        <Select
          id="student-status"
          value={current.get("status") ?? defaultStatus}
          onChange={(event) => update({ status: event.target.value })}
        >
          <option value="">Semua status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </Select>
      </FormField>
      <FormField id="student-year-entered" label="Tahun masuk">
        <Input
          id="student-year-entered"
          type="number"
          min={1900}
          max={2200}
          defaultValue={current.get("yearEntered") ?? ""}
          onBlur={(event) => update({ yearEntered: event.target.value })}
        />
      </FormField>
      <div className="flex items-end">
        <Button
          type="button"
          className="w-full bg-slate-200 text-slate-800 hover:bg-slate-300"
          onClick={() => {
            setQuery("");
            router.replace(pathname);
          }}
        >
          Reset filter
        </Button>
      </div>
    </div>
  );
}
