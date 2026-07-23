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

import { Table } from "@/shared/ui";

import type { StudentAttendanceData } from "../domain/student-attendance";

export function StudentAttendanceTrend({ data }: { data: StudentAttendanceData["trend"] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">Tren bulanan per jam</h2>
      <div className="h-72" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="izin" name="Izin" fill="#2563eb" />
            <Bar dataKey="sakit" name="Sakit" fill="#d97706" />
            <Bar dataKey="tanpaKeterangan" name="Tanpa Keterangan" fill="#b91c1c" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer font-semibold">Tabel alternatif tren</summary>
        <Table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Izin</th>
              <th>Sakit</th>
              <th>Tanpa Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr key={item.date}>
                <td>{item.day}</td>
                <td>{item.izin}</td>
                <td>{item.sakit}</td>
                <td>{item.tanpaKeterangan}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </details>
    </section>
  );
}
