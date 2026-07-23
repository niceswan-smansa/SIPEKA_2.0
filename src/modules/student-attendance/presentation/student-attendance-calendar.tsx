"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/shared/ui";

import { monthStart, moveMonth, type StudentAttendanceData } from "../domain/student-attendance";

const tone = {
  IZIN: "bg-blue-100 text-blue-800",
  SAKIT: "bg-amber-100 text-amber-900",
  TANPA_KETERANGAN: "bg-red-100 text-red-800",
};

export function StudentAttendanceCalendar({
  selectedDate,
  month,
  calendar,
}: {
  selectedDate: string;
  month: string;
  calendar: StudentAttendanceData["calendar"];
}) {
  const router = useRouter();
  const normalizedMonth = monthStart(month);
  const [year, value] = normalizedMonth.split("-").map(Number) as [number, number, number];
  const first = new Date(Date.UTC(year, value - 1, 1));
  const days = new Date(Date.UTC(year, value, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const detailByDate = new Map(calendar.map((item) => [item.date.slice(0, 10), item.statuses]));
  const navigate = (nextMonth: string, nextDate = selectedDate) =>
    router.push(`?date=${nextDate}&month=${nextMonth}`);
  const label = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(first);
  return (
    <section aria-label="Kalender presensi siswa">
      <div className="mb-3 flex items-center justify-between">
        <Button
          type="button"
          aria-label="Bulan sebelumnya"
          className="bg-slate-200 text-slate-800 hover:bg-slate-300"
          onClick={() => navigate(moveMonth(normalizedMonth, -1))}
        >
          ←
        </Button>
        <h2 className="font-bold capitalize">{label}</h2>
        <Button
          type="button"
          aria-label="Bulan berikutnya"
          className="bg-slate-200 text-slate-800 hover:bg-slate-300"
          onClick={() => navigate(moveMonth(normalizedMonth, 1))}
        >
          →
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        <>
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
            <span key={day} className="font-semibold text-slate-500">
              {day}
            </span>
          ))}
        </>
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1;
          const date = `${year}-${String(value).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const statuses = detailByDate.get(date) ?? [];
          return (
            <button
              key={date}
              type="button"
              onClick={() => navigate(normalizedMonth, date)}
              aria-current={date === selectedDate ? "date" : undefined}
              className={`min-h-12 rounded-lg border p-1 ${date === selectedDate ? "border-[var(--brand)] ring-2 ring-[var(--brand)]" : "border-slate-200 hover:bg-slate-50"}`}
            >
              <span>{day}</span>
              <span className="mt-1 flex justify-center gap-0.5">
                {statuses.map((status) => (
                  <span
                    key={status}
                    title={status}
                    className={`h-1.5 w-1.5 rounded-full ${tone[status].split(" ")[0]}`}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-600">
        Titik: Izin, Sakit, Tanpa Keterangan. Jam tanpa record berarti Hadir.
      </p>
    </section>
  );
}
