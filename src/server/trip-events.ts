import type { TripDisposition } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRun } from "@/server/access";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/auth";
import { DomainError, isUniqueViolation } from "@/server/errors";

const ALLOWED = new Set<TripDisposition>(["UNKNOWN", "NOT_BOARDED", "NOT_PRESENT"]);

export async function markDisposition(
  actor: Actor,
  input: { runId: string; studentId: string; disposition: TripDisposition; idempotencyKey: string; note?: string | null },
) {
  if (!ALLOWED.has(input.disposition)) throw new DomainError(422, "INVALID_DISPOSITION", "สถานะนี้บันทึกจากปุ่มรับส่งหลัก");
  await requireRun(actor, input.runId);
  const existing = await prisma.studentTripEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.runId !== input.runId || existing.studentId !== input.studentId || existing.disposition !== input.disposition) {
      throw new DomainError(409, "IDEMPOTENCY_CONFLICT", "คีย์นี้ถูกใช้กับรายการคนละอย่าง");
    }
    return { ok: true as const, confirmed: true as const, replayed: true, disposition: existing.nextDisposition };
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const run = await tx.scheduleRun.findUnique({
        where: { id: input.runId },
        include: { states: { where: { studentId: input.studentId } } },
      });
      if (!run) throw new DomainError(404, "NOT_FOUND", "ไม่พบรอบรถ");
      if (run.status === "COMPLETED" || run.status === "CANCELLED") {
        throw new DomainError(409, "RUN_CLOSED", "รอบนี้ปิดแล้ว");
      }
      const state = run.states[0];
      if (!state) throw new DomainError(404, "NOT_FOUND", "ไม่พบเด็กในรอบนี้");
      if (input.disposition !== "UNKNOWN" && state.status !== "WAITING" && state.disposition !== "UNKNOWN") {
        throw new DomainError(422, "INVALID_TRANSITION", "บันทึกสถานะนี้ได้เมื่อเด็กยังไม่ถูกยืนยันว่าขึ้นรถ");
      }
      const event = await tx.studentTripEvent.create({
        data: {
          runId: input.runId,
          studentId: input.studentId,
          disposition: input.disposition,
          idempotencyKey: input.idempotencyKey,
          note: input.note?.trim() || null,
          previousDisposition: state.disposition,
          nextDisposition: input.disposition,
          recordedByUserId: actor.userId,
        },
      });
      await tx.studentRunState.update({
        where: { id: state.id },
        data: {
          disposition: input.disposition,
          status: input.disposition === "NOT_PRESENT" ? "NO_SHOW" : state.status,
        },
      });
      await writeAudit(tx, {
        actorUserId: actor.userId,
        action: "DISPOSITION_RECORDED",
        entityType: "StudentRunState",
        entityId: state.id,
        previous: { disposition: state.disposition, status: state.status },
        next: { disposition: input.disposition, eventId: event.id },
      });
      return { ok: true as const, confirmed: true as const, replayed: false, disposition: input.disposition };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const replay = await prisma.studentTripEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (!replay) throw error;
    return { ok: true as const, confirmed: true as const, replayed: true, disposition: replay.nextDisposition };
  }
}
