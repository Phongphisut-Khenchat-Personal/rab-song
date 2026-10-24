export const BANGKOK = "Asia/Bangkok";

export function bangkokYmd(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function dateFromYmd(ymd: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error("วันที่ไม่ถูกต้อง");
  }
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function ymdFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function bangkokDayOfWeek(ymd = bangkokYmd()): number {
  return dateFromYmd(ymd).getUTCDay();
}

export function addDays(ymd: string, days: number): string {
  const date = dateFromYmd(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return ymdFromDate(date);
}

export function todayYearMonth(date = new Date()): string {
  return bangkokYmd(date).slice(0, 7);
}

export function eachDate(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end && dates.length <= 61) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function formatThaiDate(ymd: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(dateFromYmd(ymd));
}

export function formatThaiDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: BANGKOK,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
