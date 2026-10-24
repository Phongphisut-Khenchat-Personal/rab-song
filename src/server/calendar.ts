import type { ServiceExceptionKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dateFromYmd } from "@/lib/time";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/auth";
import { DomainError, isUniqueViolation } from "@/server/errors";
import { ensureRunsForDate } from "@/server/runs";

export async function addServiceException(
  actor: Actor,
  input: { serviceDate: string; kind: ServiceExceptionKind; affectsMorning: boolean; affectsEvening: boolean; note: string },
) {
  if (actor.role !== "OWNER") throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  if (!input.affectsMorning && !input.affectsEvening) throw new DomainError(422, "PERIOD_REQUIRED", "เลือกอย่างน้อยหนึ่งรอบ");
  if (input.note.trim().length < 3) throw new DomainError(422, "INVALID_TEXT", "โปรดระบุรายละเอียดอย่างน้อย 3 ตัวอักษร");
  try {
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceException.create({
        data: {
          serviceDate: dateFromYmd(input.serviceDate),
          kind: input.kind,
          affectsMorning: input.affectsMorning,
          affectsEvening: input.affectsEvening,
          note: input.note.trim(),
          createdByUserId: actor.userId,
        },
      });
      await writeAudit(tx, {
        actorUserId: actor.userId,
        action: "SERVICE_EXCEPTION_CREATED",
        entityType: "ServiceException",
        entityId: created.id,
        next: input,
      });
      return created;
    });
    await ensureRunsForDate(input.serviceDate);
    return { id: row.id };
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError(409, "DUPLICATE_EXCEPTION", "วันนี้มีรายการประเภทนี้แล้ว");
    throw error;
  }
}
