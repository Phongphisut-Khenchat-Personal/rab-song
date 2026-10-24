import { prisma } from "@/lib/db";
import { isThaiMobile, normalizePhone } from "@/lib/phone";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/auth";
import { DomainError } from "@/server/errors";

export async function changeServiceStatus(actor: Actor, studentId: string, to: "NEEDS_VERIFICATION" | "VERIFIED" | "ACTIVE" | "SUSPENDED" | "ENDED", reason?: string) {
  if (actor.role !== "OWNER") throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      guardians: true,
      authorizedReceivers: { where: { active: true } },
      assignments: { where: { active: true }, include: { pickupStop: { include: { place: true } } } },
    },
  });
  if (!student) throw new DomainError(404, "NOT_FOUND", "ไม่พบนักเรียน");
  const allowed: Record<string, string[]> = {
    DRAFT: ["NEEDS_VERIFICATION"],
    NEEDS_VERIFICATION: ["VERIFIED", "DRAFT"],
    VERIFIED: ["ACTIVE", "NEEDS_VERIFICATION"],
    ACTIVE: ["SUSPENDED", "ENDED"],
    SUSPENDED: ["ACTIVE", "ENDED"],
    ENDED: [],
  };
  if (!allowed[student.serviceStatus]?.includes(to)) {
    throw new DomainError(422, "INVALID_TRANSITION", "เปลี่ยนสถานะนักเรียนแบบนี้ไม่ได้");
  }
  if ((to === "SUSPENDED" || to === "ENDED") && (reason?.trim().length ?? 0) < 5) {
    throw new DomainError(422, "REASON_REQUIRED", "โปรดระบุเหตุผลอย่างน้อย 5 ตัวอักษร");
  }
  if (to === "VERIFIED" || (to === "ACTIVE" && student.serviceStatus === "VERIFIED")) {
    const place = student.assignments[0]?.pickupStop.place;
    const placeOk = place && (place.status === "PARENT_CONFIRMED" || place.status === "FIELD_VERIFIED");
    if (!student.consentAt || !student.gradeLevel || !student.serviceStart || student.guardians.length === 0 || student.authorizedReceivers.length === 0 || student.assignments.length === 0 || !placeOk) {
      throw new DomainError(422, "PROFILE_INCOMPLETE", "ข้อมูลผู้ปกครอง จุดรับที่คนยืนยันแล้ว ผู้รับเด็ก ชั้นเรียน วันเริ่มบริการ และการยินยอมต้องครบก่อนเปิดใช้");
    }
  }
  await prisma.$transaction(async (tx) => {
    await tx.student.update({ where: { id: studentId }, data: { serviceStatus: to, active: to !== "ENDED" } });
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "SERVICE_STATUS_CHANGED",
      entityType: "Student",
      entityId: studentId,
      previous: { serviceStatus: student.serviceStatus },
      next: { serviceStatus: to, reason: reason?.trim() || null },
    });
  });
  return { id: studentId, serviceStatus: to };
}
