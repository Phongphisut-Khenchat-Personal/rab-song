export type CloseStudent = {
  nickname: string;
  status: string;
  disposition: string;
};

export function closeBlockers(input: {
  period: "MORNING" | "EVENING";
  schoolDone: boolean;
  preTrip: boolean;
  sweep: boolean;
  students: CloseStudent[];
}): string[] {
  const steps: string[] = [];
  if (!input.preTrip) steps.push("ตรวจความพร้อมคนขับ รถ และรายชื่อ แล้วส่งผลการตรวจ");
  if (!input.schoolDone) {
    steps.push(input.period === "MORNING" ? "ยืนยันว่าถึงโรงเรียนและตรวจเด็กลงทีละคน" : "ยืนยันว่าออกจากโรงเรียนหลังตรวจจำนวนเด็กแล้ว");
  }
  for (const student of input.students) {
    if (student.disposition === "UNKNOWN" || student.status === "WAITING") {
      steps.push(`${student.nickname}: ยังไม่ทราบสถานะ — จอดรถแล้วเลือกขึ้นรถ ไม่อยู่ หรือผู้ปกครองแจ้งหยุด`);
    } else if (student.disposition === "BOARDED" || student.status === "BOARDED") {
      steps.push(`${student.nickname}: ยังอยู่บนรถ — ยืนยันลงที่จุดหมาย หรือส่งให้ผู้รับที่ได้รับอนุญาต`);
    }
  }
  if (!input.sweep) steps.push("ตรวจทางเดิน ทุกที่นั่ง พื้นรถ และประตูหลัง แล้วส่งผลว่าไม่มีเด็กค้าง");
  return steps;
}
