export type GuardianStatus = "WAITING" | "BOARDED" | "ALIGHTED" | "NO_SHOW" | "EXCUSED";

export function approximateArrival(plannedStart: string, durationSeconds: number | null): string | null {
  if (durationSeconds == null || durationSeconds < 0) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(plannedStart);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]) + Math.round(durationSeconds / 60);
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function guardianMoment(input: {
  period: "MORNING" | "EVENING";
  status: GuardianStatus;
  runStatus: string;
  othersRemaining: number;
  plannedStart: string;
  durationSeconds: number | null;
}): { headline: string; note: string | null } {
  if (input.status === "EXCUSED") return { headline: "แจ้งหยุดแล้ว", note: null };
  if (input.status === "NO_SHOW") return { headline: "ไม่พบที่จุดรับ", note: null };
  if (input.status === "ALIGHTED") {
    return { headline: input.period === "MORNING" ? "ถึงโรงเรียนแล้ว" : "ส่งถึงบ้านแล้ว", note: null };
  }
  if (input.status === "BOARDED") {
    const place = input.period === "MORNING" ? "ก่อนถึงโรงเรียน" : "ก่อนถึงบ้าน";
    const count = input.othersRemaining > 0 ? `อีก ${input.othersRemaining} คน${place}` : input.period === "MORNING" ? "กำลังไปโรงเรียน" : "กำลังไปส่งที่บ้าน";
    const arrival = approximateArrival(input.plannedStart, input.durationSeconds);
    const note = arrival ? `${count} · คาดว่าถึงประมาณ ${arrival} ไม่รับประกันเวลา` : count;
    return { headline: "ขึ้นรถแล้ว", note };
  }
  if (input.runStatus === "PLANNED" || input.runStatus === "CANCELLED") {
    return { headline: input.period === "MORNING" ? "รอรับ" : "รอบเย็นยังไม่เริ่ม", note: null };
  }
  if (input.period === "MORNING" && input.othersRemaining > 0) {
    return { headline: "รอรับ", note: `รถยังไปรับอีก ${input.othersRemaining} คนก่อนถึงจุดนี้` };
  }
  return { headline: input.period === "MORNING" ? "รอรับ" : "รอขึ้นรถที่โรงเรียน", note: null };
}
