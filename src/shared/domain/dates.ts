export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isMonthStart(value: string | null | undefined): value is string {
  return isIsoDate(value) && value.endsWith("-01");
}

export function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export function monthStart(value: string) {
  if (!isIsoDate(value)) throw new Error("INVALID_DATE");
  return `${value.slice(0, 7)}-01`;
}

export function moveMonth(value: string, delta: number) {
  if (!isIsoDate(value)) throw new Error("INVALID_DATE");
  const [year, month, selectedDay] = value.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 + delta, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const day = Math.min(selectedDay, lastDay);
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatJakartaDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function isReportRangeWithinDays(start: string, end: string, maximumDays = 366) {
  if (!isIsoDate(start) || !isIsoDate(end)) return false;
  const duration = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;
  return duration >= 0 && duration < maximumDays;
}
