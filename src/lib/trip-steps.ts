export const MORNING_STEPS = ["ยังไม่เดินทาง", "กำลังรับ", "ถึงโรงเรียน", "ปิดรอบ"] as const;
export const EVENING_STEPS = ["ยังไม่เดินทาง", "ออกจากโรงเรียน", "กำลังส่ง", "ส่งครบ"] as const;

export function runStepIndex(input: {
  status: string;
  arrivedSchool: boolean;
  leftSchool: boolean;
  boarded: number;
}): number {
  if (input.status === "COMPLETED") return 3;
  if (input.status === "CANCELLED") return 0;
  if (input.arrivedSchool || input.leftSchool) return 2;
  if (input.status === "IN_PROGRESS" || input.boarded > 0) return 1;
  return 0;
}

export function childStepIndex(period: "MORNING" | "EVENING", status: string): number {
  if (status === "NO_SHOW" || status === "EXCUSED") return -1;
  if (status === "ALIGHTED") return period === "MORNING" ? 2 : 3;
  if (status === "BOARDED") return 1;
  return 0;
}
