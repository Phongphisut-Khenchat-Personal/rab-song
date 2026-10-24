import type { CheckpointKind, StudentRunStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { studentDisplayName, type RunPeriod } from "@/lib/labels";
import { requireRun } from "@/server/access";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/auth";
import { DomainError } from "@/server/errors";

const RESOLVED = new Set<StudentRunStatus>(["ALIGHTED", "NO_SHOW", "EXCUSED"]);

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
    .filter((state) => !isClear(state.status, kind))
    .map((state) => ({
      studentId: state.studentId,
      name: studentDisplayName(state.student),
      status: state.status,
    }));
  const passed = missing.length === 0;

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

function isClear(status: StudentRunStatus, kind: CheckpointKind): boolean {
  if (kind === "LEFT_SCHOOL") return status === "BOARDED" || status === "NO_SHOW" || status === "EXCUSED";
  return RESOLVED.has(status);
}
