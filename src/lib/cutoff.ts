import { addDays } from "@/lib/time";

export function submittedAfterCutoff(serviceYmd: string, cutoffTime = "21:00", now = new Date()): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(cutoffTime);
  if (!match) return true;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const cutoff = new Date(`${addDays(serviceYmd, -1)}T00:00:00.000Z`);
  cutoff.setUTCHours(hour - 7, minute, 0, 0);
  return now.getTime() > cutoff.getTime();
}
