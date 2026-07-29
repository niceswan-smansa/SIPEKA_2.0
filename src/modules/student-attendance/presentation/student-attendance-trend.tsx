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
  const chartMinimumWidth = Math.max(640, data.length * 46 + 96);

  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">Tren bulanan per jam</h2>
      <div
        className="chart-scroll h-72"
        data-chart-label-count={data.length}
        data-chart-title="Tren bulanan per jam"
        aria-hidden="true"
      >
        <div className="chart-scroll__canvas" style={{ minWidth: chartMinimumWidth }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" interval={0} minTickGap={0} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="izin" name="Izin" fill="#2563eb" />
              <Bar dataKey="sakit" name="Sakit" fill="#d97706" />
              <Bar dataKey="tanpaKeterangan" name="Tanpa Keterangan" fill="#b91c1c" />
            </BarChart>
          </ResponsiveContainer>
        </div>
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
