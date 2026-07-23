"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/shared/ui";

import { monthGrid, moveMonth, todayJakarta } from "../domain/dashboard";

export function DashboardCalendar({
  selectedDate,
  visibleMonth,
}: {
  selectedDate: string;
  visibleMonth: string;
}) {
  const router = useRouter();
  const grid = monthGrid(visibleMonth);
  const today = todayJakarta();
  const monthLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(grid.year, grid.month - 1, 1)));
  const navigate = (month: string, date = selectedDate) =>
    router.push(`/dashboard?date=${encodeURIComponent(date)}&month=${encodeURIComponent(month)}`);

  return (
    <section aria-label="Kalender dashboard">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button
          type="button"
          className="bg-slate-200 text-slate-800 hover:bg-slate-300"
          aria-label="Bulan sebelumnya"
          onClick={() => navigate(moveMonth(visibleMonth, -1))}
        >
          ←
        </Button>
        <h2 className="font-bold capitalize">{monthLabel}</h2>
        <Button
          type="button"
          className="bg-slate-200 text-slate-800 hover:bg-slate-300"
          aria-label="Bulan berikutnya"
          onClick={() => navigate(moveMonth(visibleMonth, 1))}
        >
          →
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
        {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
          <span key={day}>{day}</span>
        ))}
        {Array.from({ length: grid.mondayOffset }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}
        {Array.from({ length: grid.days }, (_, index) => {
          const day = index + 1;
          const date = `${grid.year}-${String(grid.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const selected = date === selectedDate;
          const current = date === today;
          return (
            <button
              key={date}
              type="button"
              aria-current={selected ? "date" : undefined}
              aria-label={`${date}${current ? ", hari ini" : ""}`}
              onClick={() => navigate(visibleMonth, date)}
              className={`min-h-10 rounded-lg border text-sm ${selected ? "border-[var(--brand)] bg-[var(--brand)] text-white" : current ? "border-[var(--brand)] bg-white text-[var(--brand)]" : "border-transparent hover:bg-slate-100"}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </section>
  );
}
