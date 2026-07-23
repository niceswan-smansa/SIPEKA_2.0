"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, EmptyState, Table } from "@/shared/ui";

import type { CategoryPoint, MonthlyPoint } from "../domain/dashboard";

const colors = { izin: "#2563eb", sakit: "#d97706", tanpaKeterangan: "#b91c1c" };

function CategoryTable({ data }: { data: CategoryPoint[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <th>Kategori</th>
          <th>Izin</th>
          <th>Sakit</th>
          <th>Tanpa Keterangan</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={item.label}>
            <th>{item.label}</th>
            <td>{item.izin}</td>
            <td>{item.sakit}</td>
            <td>{item.tanpaKeterangan}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

export function CategoryChart({ title, data }: { title: string; data: CategoryPoint[] }) {
  const hasData = data.some((item) => item.izin + item.sakit + item.tanpaKeterangan > 0);
  return (
    <Card>
      <h2 className="mb-4 text-lg font-bold">{title}</h2>
      {!hasData ? (
        <EmptyState>Tidak ada ketidakhadiran pada periode ini.</EmptyState>
      ) : (
        <div className="h-80" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="izin" name="Izin" fill={colors.izin} />
              <Bar dataKey="sakit" name="Sakit" fill={colors.sakit} />
              <Bar
                dataKey="tanpaKeterangan"
                name="Tanpa Keterangan"
                fill={colors.tanpaKeterangan}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer font-semibold">Tabel data grafik</summary>
        <CategoryTable data={data} />
      </details>
    </Card>
  );
}

export function MonthlyChart({ data }: { data: MonthlyPoint[] }) {
  const hasData = data.some((item) => item.total > 0);
  return (
    <Card>
      <h2 className="mb-4 text-lg font-bold">Ketidakhadiran bulanan</h2>
      {!hasData ? (
        <EmptyState>Tidak ada ketidakhadiran pada bulan ini.</EmptyState>
      ) : (
        <div className="h-80" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" name="Siswa tidak hadir" fill="#0f766e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer font-semibold">Tabel data grafik</summary>
        <Table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Siswa tidak hadir</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.label}>
                <th>{item.label}</th>
                <td>{item.total}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </details>
    </Card>
  );
}
