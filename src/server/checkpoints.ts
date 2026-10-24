import type { CheckpointKind, StudentRunStatus, TripDisposition } from "@prisma/client";
import { prisma } from "@/lib/db";
import { studentDisplayName, type RunPeriod } from "@/lib/labels";
import { requireRun } from "@/server/access";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/auth";
import { DomainError } from "@/server/errors";

const RESOLVED = new Set<StudentRunStatus>(["ALIGHTED", "NO_SHOW", "EXCUSED"]);
const TERMINAL = new Set<TripDisposition>(["NOT_PRESENT", "ABSENCE_CONFIRMED", "NOT_BOARDED", "DROPPED_OFF", "HANDED_TO_AUTHORIZED_PERSON"]);

export async function recordCheckpoint(actor: Actor, runId: string, kind: CheckpointKind) {
  const run = await requireRun(actor, runId);
  const period = run.schedule.period as RunPeriod;
  if (period === "MORNING" && kind === "LEFT_SCHOOL") {
    throw new DomainError(422, "WRONG_CHECKPOINT", "รอบเช้าใช้การตรวจลงรถที่โรงเรียน");
  }
  if (period === "EVENING" && kind === "ARRIVED_SCHOOL") {
    throw new DomainError(422, "WRONG_CHECKPOINT", "รอบเย็นใช้การตรวจขึ้นรถที่โรงเรียน");
  }
  if (run.status === "COMPLETED" && kind === "RUN_FINISHED") {
    return { ok: true as const, confirmed: true as const, replayed: true, passed: true, missing: [] };
  }
  if (kind === "RUN_FINISHED") {
    const prior = period === "MORNING" ? "ARRIVED_SCHOOL" : "LEFT_SCHOOL";
    if (!run.checkpoints.some((item) => item.kind === prior && item.passed)) {
      throw new DomainError(422, "CHECKPOINT_REQUIRED", "ต้องตรวจเด็กครบที่โรงเรียนก่อนปิดรอบ");
    }
  }

  const missing = run.states
    .filter((state) => !isClear(state, kind))
    .map((state) => ({
      studentId: state.studentId,
      name: studentDisplayName(state.student),
      status: state.status,
      disposition: state.disposition,
    }));
  const passed = missing.length === 0;
  if (passed && kind === "RUN_FINISHED") {
    const inspections = await prisma.vehicleInspection.findMany({ where: { runId, passed: true }, select: { kind: true } });
    const kinds = new Set(inspections.map((item) => item.kind));
    if (!kinds.has("PRE_TRIP")) throw new DomainError(422, "PRETRIP_REQUIRED", "ต้องตรวจความพร้อมคนขับและรถก่อนปิดรอบ");
    if (!kinds.has("EMPTY_SWEEP")) throw new DomainError(422, "SWEEP_REQUIRED", "ต้องตรวจว่ารถว่างและไม่มีเด็กค้างก่อนปิดรอบ");
  }

  await prisma.$transaction(async (tx) => {
    const checkpoint = await tx.runCheckpoint.create({
      data: {
        runId,
        kind,
        passed,
        missingJson: missing,
        checkedByUserId: actor.userId,
      },
    });
    if (passed && kind === "RUN_FINISHED") {
      await tx.scheduleRun.update({
        where: { id: runId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    } else if (passed && run.status === "PLANNED") {
      await tx.scheduleRun.update({
        where: { id: runId },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
      });
    }
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: passed ? "CHECKPOINT_PASSED" : "CHECKPOINT_FAILED",
      entityType: "ScheduleRun",
      entityId: runId,
      previous: { status: run.status },
      next: { kind, passed, missing, checkpointId: checkpoint.id },
    });
  });

  if (!passed) {
    throw new DomainError(422, "CHILDREN_UNRESOLVED", "ยังมีเด็กที่สถานะไม่ครบ รอบนี้ยังไม่ปิด", { missing });
  }
  return { ok: true as const, confirmed: true as const, replayed: false, passed: true, missing: [] };
}

function isClear(state: { status: StudentRunStatus; disposition: TripDisposition }, kind: CheckpointKind): boolean {
  if (kind === "LEFT_SCHOOL") {
    if (state.disposition === "UNKNOWN") return false;
    if (state.disposition === "BOARDED" || state.disposition === "NOT_PRESENT" || state.disposition === "ABSENCE_CONFIRMED" || state.disposition === "NOT_BOARDED") {
      return true;
    }
    return state.status === "BOARDED" || state.status === "NO_SHOW" || state.status === "EXCUSED";
  }
  if (state.disposition === "UNKNOWN" || state.disposition === "BOARDED") return false;
  if (TERMINAL.has(state.disposition)) return true;
  return RESOLVED.has(state.status);
}
