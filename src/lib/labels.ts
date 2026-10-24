export type RunPeriod = "MORNING" | "EVENING";
export type StudentRunStatus = "WAITING" | "BOARDED" | "ALIGHTED" | "NO_SHOW" | "EXCUSED";
export type AttendanceEventType =
  | "BOARD"
  | "ALIGHT"
  | "NO_SHOW"
  | "EXCUSE"
  | "DELAY"
  | "ALTERNATE_RECEIVER"
  | "CORRECTION";
export type UserRole = "OWNER" | "DRIVER" | "GUARDIAN";
export type CheckpointKind = "ARRIVED_SCHOOL" | "LEFT_SCHOOL" | "RUN_FINISHED";

export function roleLabel(role: UserRole): string {
  if (role === "GUARDIAN") return "ผู้ปกครอง";
  return "คนขับ";
}

export function invoiceStatusLabel(status: string): string {
  if (status === "UNPAID") return "ยังไม่จ่าย";
  if (status === "PARTIAL") return "จ่ายบางส่วน";
  if (status === "PAID") return "จ่ายแล้ว";
  if (status === "WAIVED") return "ยกเว้น";
  return status;
}

export function absenceStatusLabel(status: string): string {
  if (status === "SUBMITTED") return "รอรับทราบ";
  if (status === "ACKNOWLEDGED") return "รับทราบแล้ว";
  if (status === "CANCELLED") return "ยกเลิกแล้ว";
  return status;
}

export function periodLabel(period: RunPeriod): string {
  return period === "MORNING" ? "รอบเช้า" : "รอบเย็น";
}

export function studentDisplayName(student: { prefix: string; firstName: string; lastName: string }): string {
  return [student.prefix, student.firstName, student.lastName].filter(Boolean).join(" ");
}

export function statusLabel(status: StudentRunStatus, period: RunPeriod): string {
  if (status === "WAITING") return "ยังไม่ยืนยัน";
  if (status === "BOARDED") return period === "MORNING" ? "รับขึ้นรถแล้ว" : "รับกลับขึ้นรถแล้ว";
  if (status === "ALIGHTED") return period === "MORNING" ? "ส่งถึงโรงเรียนแล้ว" : "ส่งถึงบ้านแล้ว";
  if (status === "NO_SHOW") return "เด็กไม่อยู่";
  return "ผู้ปกครองแจ้งหยุด";
}

export function actionLabel(eventType: AttendanceEventType, period: RunPeriod): string {
  if (eventType === "BOARD") return period === "MORNING" ? "รับขึ้นรถ" : "รับกลับขึ้นรถ";
  if (eventType === "ALIGHT") return period === "MORNING" ? "ส่งถึงโรงเรียน" : "ส่งถึงบ้าน";
  if (eventType === "NO_SHOW") return "เด็กไม่อยู่";
  if (eventType === "EXCUSE") return "ผู้ปกครองแจ้งหยุด";
  if (eventType === "DELAY") return "รถล่าช้า";
  if (eventType === "ALTERNATE_RECEIVER") return "มีผู้รับแทน";
  return "แก้ไขสถานะ";
}

export function allowedDriverActions(status: StudentRunStatus): AttendanceEventType[] {
  if (status === "WAITING") return ["BOARD", "NO_SHOW", "EXCUSE", "DELAY"];
  if (status === "EXCUSED") return ["BOARD", "DELAY"];
  if (status === "BOARDED") return ["ALIGHT", "DELAY", "ALTERNATE_RECEIVER"];
  if (status === "ALIGHTED") return ["ALTERNATE_RECEIVER"];
  return [];
}

export function checkpointLabel(kind: CheckpointKind, period: RunPeriod): string {
  if (kind === "ARRIVED_SCHOOL") return "ตรวจว่าเด็กลงครบที่โรงเรียน";
  if (kind === "LEFT_SCHOOL") return "ตรวจว่าเด็กขึ้นรถกลับครบ";
  return period === "MORNING" ? "ปิดรอบเช้า" : "ปิดรอบเย็น";
}
