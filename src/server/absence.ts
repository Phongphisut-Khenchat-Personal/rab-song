import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { studentDisplayName } from "@/lib/labels";
import { bangkokYmd, dateFromYmd, eachDate } from "@/lib/time";
import { assertCanSeeStudent } from "@/server/access";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/auth";
import { DomainError, isUniqueViolation } from "@/server/errors";
import { notifyUsers, type NotificationReceipt } from "@/server/notifications";
import { ensureRunsForDate } from "@/server/runs";

export type AbsenceResult = {
  ok: true;
  confirmed: true;
  replayed: boolean;
  data: { id: string; status: string; unchangedRunIds: string[] };
  notification: NotificationReceipt;
};

export async function createAbsence(
  actor: Actor,
  input: {
    studentId: string;
    startDate: string;
    endDate: string;
    reason: string;
    affectsMorning: boolean;
    affectsEvening: boolean;
    idempotencyKey: string;
  },
): Promise<AbsenceResult> {
  if (actor.role === "DRIVER") throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์แจ้งหยุด");
  if (actor.role === "GUARDIAN") await assertCanSeeStudent(actor, input.studentId);
  if (!input.affectsMorning && !input.affectsEvening) {
    throw new DomainError(422, "PERIOD_REQUIRED", "เลือกอย่างน้อยหนึ่งรอบ");
  }
  const today = bangkokYmd();
  if (input.startDate < today) throw new DomainError(422, "PAST_DATE", "แจ้งหยุดย้อนหลังไม่ได้");
  if (input.endDate < input.startDate) throw new DomainError(422, "DATE_RANGE", "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม");
  if (eachDate(input.startDate, input.endDate).length > 60) {
    throw new DomainError(422, "DATE_RANGE", "แจ้งหยุดได้ไม่เกิน 60 วันต่อการยื่นหนึ่งครั้ง");
  }
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 500) {
    throw new DomainError(422, "INVALID_TEXT", "โปรดระบุเหตุผลอย่างน้อย 3 ตัวอักษร");
  }

  const existing = await prisma.absenceRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.studentId !== input.studentId || existing.reason !== reason) {
      throw new DomainError(409, "IDEMPOTENCY_CONFLICT", "คีย์นี้ถูกใช้กับรายการคนละอย่าง");
    }
    return {
      ok: true,
      confirmed: true,
      replayed: true,
      data: { id: existing.id, status: existing.status, unchangedRunIds: [] },
      notification: { inApp: "recorded", push: "not_configured" },
    };
  }

  const start = dateFromYmd(input.startDate);
  const end = dateFromYmd(input.endDate);
  const overlap = await prisma.absenceRequest.findFirst({
    where: {
      studentId: input.studentId,
      status: { not: "CANCELLED" },
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });
  if (overlap) throw new DomainError(409, "ABSENCE_OVERLAP", "มีคำขอหยุดที่ทับวันที่นี้อยู่แล้ว");

  const guardian = await resolveGuardian(actor, input.studentId);
  for (const ymd of eachDate(input.startDate, input.endDate)) {
    await ensureRunsForDate(ymd);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const absence = await tx.absenceRequest.create({
        data: {
          studentId: input.studentId,
          guardianId: guardian.id,
          startDate: start,
          endDate: end,
          reason,
          affectsMorning: input.affectsMorning,
          affectsEvening: input.affectsEvening,
          idempotencyKey: input.idempotencyKey,
          createdByUserId: actor.userId,
        },
      });
      const runs = await tx.scheduleRun.findMany({
        where: { serviceDate: { gte: start, lte: end }, status: { not: "CANCELLED" } },
        include: {
          schedule: true,
          states: { where: { studentId: input.studentId }, include: { student: true } },
          driver: true,
        },
      });
      const unchangedRunIds: string[] = [];
      const driverUserIds: string[] = [];
      for (const run of runs) {
        const periodMatches =
          (run.schedule.period === "MORNING" && input.affectsMorning) ||
          (run.schedule.period === "EVENING" && input.affectsEvening);
        const state = run.states[0];
        if (!periodMatches || !state) continue;
        driverUserIds.push(run.driver.userId);
        if (state.status === "BOARDED" || state.status === "ALIGHTED") {
          unchangedRunIds.push(run.id);
          continue;
        }
        if (state.status === "EXCUSED") continue;
        await tx.studentRunState.update({ where: { id: state.id }, data: { status: "EXCUSED" } });
        try {
          await tx.attendanceEvent.create({
            data: {
              runId: run.id,
              studentId: input.studentId,
              eventType: "EXCUSE",
              idempotencyKey: `${input.idempotencyKey}:${run.id}`,
              note: reason,
              previousStatus: state.status,
              nextStatus: "EXCUSED",
              recordedByUserId: actor.userId,
            },
          });
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
        }
        await writeAudit(tx, {
          actorUserId: actor.userId,
          action: "ABSENCE_APPLIED",
          entityType: "StudentRunState",
          entityId: state.id,
          previous: { status: state.status },
          next: { status: "EXCUSED", absenceId: absence.id },
        });
      }
      await writeAudit(tx, {
        actorUserId: actor.userId,
        action: "ABSENCE_CREATED",
        entityType: "AbsenceRequest",
        entityId: absence.id,
        next: {
          studentId: input.studentId,
          startDate: input.startDate,
          endDate: input.endDate,
          reason,
          unchangedRunIds,
        },
      });
      const student = await tx.student.findUniqueOrThrow({ where: { id: input.studentId } });
      const notification = await notifyUsers(tx, {
        userIds: driverUserIds,
        studentId: input.studentId,
        type: "ABSENCE",
        title: "ผู้ปกครองแจ้งหยุด",
        body:
          unchangedRunIds.length > 0
            ? `${studentDisplayName(student)} มีคำขอหยุด แต่มีรอบที่บันทึกว่าขึ้นรถแล้ว สถานะรอบนั้นไม่ถูกเปลี่ยน`
            : `${studentDisplayName(student)} งดใช้รถ ${input.startDate} ถึง ${input.endDate}`,
      });
      return {
        ok: true as const,
        confirmed: true as const,
        replayed: false,
        data: { id: absence.id, status: absence.status, unchangedRunIds },
        notification,
      };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await prisma.absenceRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (!raced) throw error;
    return {
      ok: true,
      confirmed: true,
      replayed: true,
      data: { id: raced.id, status: raced.status, unchangedRunIds: [] },
      notification: { inApp: "recorded", push: "not_configured" },
    };
  }
}

async function resolveGuardian(actor: Actor, studentId: string) {
  if (actor.role === "GUARDIAN" && actor.guardianId) {
    const guardian = await prisma.guardian.findUnique({ where: { id: actor.guardianId } });
    if (!guardian) throw new DomainError(404, "NOT_FOUND", "ไม่พบข้อมูล");
    return guardian;
  }
  const link = await prisma.studentGuardian.findFirst({
    where: { studentId },
    orderBy: { isPrimary: "desc" },
    include: { guardian: true },
  });
  if (!link) throw new DomainError(422, "GUARDIAN_REQUIRED", "เด็กคนนี้ยังไม่ได้ผูกผู้ปกครอง");
  return link.guardian;
}

export async function cancelAbsence(actor: Actor, absenceId: string) {
  const absence = await prisma.absenceRequest.findUnique({ where: { id: absenceId } });
  if (!absence) throw new DomainError(404, "NOT_FOUND", "ไม่พบคำขอ");
  if (actor.role === "DRIVER") throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  if (actor.role === "GUARDIAN" && actor.guardianId !== absence.guardianId) {
    throw new DomainError(404, "NOT_FOUND", "ไม่พบคำขอ");
  }
  if (absence.status === "CANCELLED") {
    return { ok: true as const, confirmed: true as const, replayed: true, data: { id: absence.id, status: absence.status } };
  }
  const today = dateFromYmd(bangkokYmd());
  if (absence.startDate < today && actor.role !== "OWNER") {
    throw new DomainError(422, "PAST_DATE", "ยกเลิกคำขอที่เริ่มไปแล้วไม่ได้");
  }

  await prisma.$transaction(async (tx) => {
    await tx.absenceRequest.update({ where: { id: absence.id }, data: { status: "CANCELLED" } });
    const runs = await tx.scheduleRun.findMany({
      where: {
        serviceDate: { gte: absence.startDate, lte: absence.endDate },
        states: { some: { studentId: absence.studentId, status: "EXCUSED" } },
      },
      include: { schedule: true, states: { where: { studentId: absence.studentId } } },
    });
    for (const run of runs) {
      const state = run.states[0];
      if (!state) continue;
      const periodMatches =
        (run.schedule.period === "MORNING" && absence.affectsMorning) ||
        (run.schedule.period === "EVENING" && absence.affectsEvening);
      if (!periodMatches) continue;
      const other = await tx.absenceRequest.findFirst({
        where: {
          id: { not: absence.id },
          studentId: absence.studentId,
          status: { not: "CANCELLED" },
          startDate: { lte: run.serviceDate },
          endDate: { gte: run.serviceDate },
          ...(run.schedule.period === "MORNING" ? { affectsMorning: true } : { affectsEvening: true }),
        },
      });
      if (other) continue;
      const boarded = await tx.attendanceEvent.findFirst({
        where: { runId: run.id, studentId: absence.studentId, eventType: "BOARD" },
      });
      if (boarded) continue;
      await tx.studentRunState.update({ where: { id: state.id }, data: { status: "WAITING" } });
      await writeAudit(tx, {
        actorUserId: actor.userId,
        action: "ABSENCE_CANCELLED",
        entityType: "StudentRunState",
        entityId: state.id,
        previous: { status: "EXCUSED", absenceId: absence.id },
        next: { status: "WAITING" },
      });
    }
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "ABSENCE_CANCELLED",
      entityType: "AbsenceRequest",
      entityId: absence.id,
      previous: { status: absence.status },
      next: { status: "CANCELLED" },
    });
  });
  return { ok: true as const, confirmed: true as const, replayed: false, data: { id: absence.id, status: "CANCELLED" } };
}

export async function acknowledgeAbsence(actor: Actor, absenceId: string) {
  const absence = await prisma.absenceRequest.findUnique({
    where: { id: absenceId },
    include: { student: { include: { assignments: { include: { route: { include: { vehicle: true } } } } } } },
  });
  if (!absence || absence.status === "CANCELLED") throw new DomainError(404, "NOT_FOUND", "ไม่พบคำขอ");
  if (actor.role === "GUARDIAN") throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  if (actor.role === "DRIVER") {
    const assigned = absence.student.assignments.some((item) => item.route.vehicle.driverId === actor.driverId);
    if (!assigned) throw new DomainError(404, "NOT_FOUND", "ไม่พบคำขอ");
  }
  if (absence.status === "ACKNOWLEDGED") {
    return { ok: true as const, confirmed: true as const, replayed: true };
  }
  await prisma.$transaction(async (tx) => {
    await tx.absenceRequest.update({ where: { id: absence.id }, data: { status: "ACKNOWLEDGED" } });
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "ABSENCE_ACKNOWLEDGED",
      entityType: "AbsenceRequest",
      entityId: absence.id,
      previous: { status: "SUBMITTED" },
      next: { status: "ACKNOWLEDGED" },
    });
  });
  return { ok: true as const, confirmed: true as const, replayed: false };
}

export async function listAbsences(actor: Actor) {
  const where: Prisma.AbsenceRequestWhereInput =
    actor.role === "OWNER"
      ? {}
      : actor.role === "GUARDIAN" && actor.guardianId
        ? { guardianId: actor.guardianId }
        : actor.role === "DRIVER" && actor.driverId
          ? { student: { assignments: { some: { route: { vehicle: { driverId: actor.driverId } } } } } }
          : { id: "none" };
  const rows = await prisma.absenceRequest.findMany({
    where,
    include: { student: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((row) => ({
    id: row.id,
    studentId: row.studentId,
    studentName: studentDisplayName(row.student),
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    reason: row.reason,
    affectsMorning: row.affectsMorning,
    affectsEvening: row.affectsEvening,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));
}
