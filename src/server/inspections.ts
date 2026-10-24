import type { InspectionKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRun } from "@/server/access";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/auth";
import { DomainError } from "@/server/errors";

const REQUIRED: Record<InspectionKind, string[]> = {
  PRE_TRIP: ["driverReady", "vehicleReady", "rosterReviewed"],
  EMPTY_SWEEP: ["aisle", "seats", "floor", "rearDoor"],
};

export async function recordInspection(
  actor: Actor,
  input: { runId: string; kind: InspectionKind; items: Record<string, boolean>; idempotencyKey: string; note?: string | null },
) {
  await requireRun(actor, input.runId);
  const required = REQUIRED[input.kind];
  const items = Object.fromEntries(required.map((key) => [key, input.items[key] === true]));
  const passed = required.every((key) => items[key]);
  const existing = await prisma.vehicleInspection.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.runId !== input.runId || existing.kind !== input.kind) {
      throw new DomainError(409, "IDEMPOTENCY_CONFLICT", "คีย์นี้ถูกใช้กับรายการคนละอย่าง");
    }
    if (!existing.passed) {
      throw new DomainError(422, "INSPECTION_FAILED", "รายการตรวจนี้ไม่ผ่าน และรอบยังไม่ถูกปิด");
    }
    return { ok: true as const, confirmed: true as const, replayed: true, passed: true };
  }

  const saved = await prisma.$transaction(async (tx) => {
    const row = await tx.vehicleInspection.create({
      data: {
        runId: input.runId,
        kind: input.kind,
        items,
        passed,
        idempotencyKey: input.idempotencyKey,
        note: input.note?.trim() || null,
        checkedByUserId: actor.userId,
      },
    });
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: passed ? "INSPECTION_PASSED" : "INSPECTION_FAILED",
      entityType: "VehicleInspection",
      entityId: row.id,
      next: { runId: input.runId, kind: input.kind, passed, items },
    });
    return row;
  });
  if (!saved.passed) {
    const message = input.kind === "EMPTY_SWEEP"
      ? "ตรวจรถแล้วยังไม่ว่าง ห้ามปิดรอบจนกว่าจะตรวจครบอีกครั้ง"
      : "ตรวจความพร้อมก่อนออกยังไม่ครบ";
    throw new DomainError(422, "INSPECTION_FAILED", message);
  }
  return { ok: true as const, confirmed: true as const, replayed: false, passed: true };
}
