import { z } from "zod";
export { todayJakarta } from "@/shared/domain/dates";

export type DashboardSummary = {
  total: number;
  izin: number;
  sakit: number;
  tanpaKeterangan: number;
};
export type CategoryPoint = {
  label: string;
  izin: number;
  sakit: number;
  tanpaKeterangan: number;
};
export type MonthlyPoint = { label: string; total: number };
export type DashboardData = {
  selectedDate: string;
  summary: DashboardSummary;
  daily: CategoryPoint[];
  weekly: CategoryPoint[];
  monthly: MonthlyPoint[];
};

export const dashboardDateSchema = z.iso.date();

export interface DashboardRepository {
  get(selectedDate: string): Promise<DashboardData>;
}

function parseMonth(date: string): [number, number] {
  const match = /^(\d{4})-(\d{2})/.exec(date);
  if (!match) throw new Error("INVALID_DASHBOARD_MONTH");
  return [Number(match[1]!), Number(match[2]!)];
}

export function monthGrid(date: string) {
  const [year, month] = parseMonth(date);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  return { year, month, days, mondayOffset };
}

export function moveMonth(date: string, delta: number) {
  const [year, month] = parseMonth(date);
  const target = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
