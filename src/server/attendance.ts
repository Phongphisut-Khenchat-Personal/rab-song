import type { AttendanceEventType, Prisma, StudentRunStatus, TripDisposition } from "@prisma/client";
import { prisma } from "@/lib/db";
import { actionLabel, studentDisplayName, type RunPeriod } from "@/lib/labels";
import { requireRun } from "@/server/access";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/auth";
import { DomainError, isUniqueViolation } from "@/server/errors";
import { guardianUserIds, notifyUsers, type NotificationReceipt } from "@/server/notifications";
import { assertAuthorizedReceiver } from "@/server/receivers";

type Rule = {
  from: StudentRunStatus[];
  to: StudentRunStatus | null;
  note: boolean;
  name: boolean;
  notify: boolean;
};

const RULES: Record<Exclude<AttendanceEventType, "CORRECTION">, Rule> = {
  BOARD: { from: ["WAITING", "EXCUSED"], to: "BOARDED", note: false, name: false, notify: true },
  ALIGHT: { from: ["BOARDED"], to: "ALIGHTED", note: false, name: false, notify: true },
  NO_SHOW: { from: ["WAITING"], to: "NO_SHOW", note: false, name: false, notify: true },
  EXCUSE: { from: ["WAITING"], to: "EXCUSED", note: true, name: false, notify: false },
  DELAY: { from: ["WAITING", "BOARDED", "EXCUSED"], to: null, note: true, name: false, notify: true },
  ALTERNATE_RECEIVER: { from: ["BOARDED", "ALIGHTED"], to: null, note: false, name: true, notify: true },
};

export type AttendanceResult = {
  ok: true;
  confirmed: true;
  replayed: boolean;
  data: {
    id: string;
    runId: string;
    studentId: string;
    eventType: AttendanceEventType;
    previousStatus: StudentRunStatus | null;
    nextStatus: StudentRunStatus | null;
    recordedAt: string;
  };
  notification: NotificationReceipt;
};

type AttendanceInput = {
  actor: Actor;
  runId: string;
  studentId: string;
  eventType: Exclude<AttendanceEventType, "CORRECTION">;
  idempotencyKey: string;
  note?: string | null;
  alternateReceiverName?: string | null;
  clientRecordedAt?: string | null;
};

export async function recordAttendance(input: AttendanceInput): Promise<AttendanceResult> {
  const rule = RULES[input.eventType];
  const note = cleanText(input.note, rule.note, 3, 500, "โปรดระบุรายละเอียดอย่างน้อย 3 ตัวอักษร");
  const alternateReceiverName = cleanText(
    input.alternateReceiverName,
    rule.name,
    2,
    80,
    "โปรดระบุชื่อผู้รับแทน",
  );
  const clientRecordedAt = parseClientTime(input.clientRecordedAt);
  await requireRun(input.actor, input.runId);

  try {
    return await prisma.$transaction((tx) =>
      writeEvent(tx, { ...input, note, alternateReceiverName, clientRecordedAt, rule }),
    );
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await prisma.attendanceEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return replay(existing, input);
    const state = await prisma.studentRunState.findUnique({
      where: { runId_studentId: { runId: input.runId, studentId: input.studentId } },
    });
    throw new DomainError(409, "ALREADY_RECORDED", "สถานะนี้ถูกบันทึกแล้ว", { status: state?.status ?? null });
  }
}

async function writeEvent(
  tx: Prisma.TransactionClient,
  input: Omit<AttendanceInput, "note" | "alternateReceiverName" | "clientRecordedAt"> & {
    note: string | null;
    alternateReceiverName: string | null;
    clientRecordedAt: Date | null;
    rule: Rule;
  },
): Promise<AttendanceResult> {
  const existing = await tx.attendanceEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return replay(existing, input);

  const run = await tx.scheduleRun.findUnique({
    where: { id: input.runId },
    include: { schedule: true, states: { where: { studentId: input.studentId }, include: { student: true } } },
  });
  if (!run) throw new DomainError(404, "NOT_FOUND", "ไม่พบรอบรถ");
  if (run.status === "COMPLETED" || run.status === "CANCELLED") {
    throw new DomainError(409, "RUN_CLOSED", "รอบนี้ปิดแล้ว คนขับแก้ไขเองไม่ได้");
  }
  const state = run.states[0];
  if (!state) throw new DomainError(404, "NOT_FOUND", "ไม่พบเด็กในรอบนี้");
  if (input.rule.to) {
    const prior = await tx.attendanceEvent.findFirst({
      where: { runId: input.runId, studentId: input.studentId, eventType: input.eventType },
    });
    if (prior) throw new DomainError(409, "ALREADY_RECORDED", "สถานะนี้ถูกบันทึกแล้ว", { status: state.status });
  }
  if (!input.rule.from.includes(state.status)) {
    throw new DomainError(422, "INVALID_TRANSITION", "สถานะปัจจุบันทำรายการนี้ไม่ได้", { status: state.status });
  }

  const nextStatus = input.rule.to ?? state.status;
  const disposition = await dispositionFor(tx, {
    eventType: input.eventType,
    studentId: input.studentId,
    period: run.schedule.period as RunPeriod,
    alternateReceiverName: input.alternateReceiverName,
  });
  const event = await tx.attendanceEvent.create({
    data: {
      runId: input.runId,
      studentId: input.studentId,
      eventType: input.eventType,
      idempotencyKey: input.idempotencyKey,
      note: input.note,
      alternateReceiverName: input.alternateReceiverName,
      previousStatus: state.status,
      nextStatus,
      recordedByUserId: input.actor.userId,
      clientRecordedAt: input.clientRecordedAt,
    },
  });
  await tx.studentRunState.update({
    where: { id: state.id },
    data: {
      status: nextStatus,
      ...(disposition ? { disposition } : {}),
      alternateReceiverName: input.alternateReceiverName ?? state.alternateReceiverName,
    },
  });
  if (run.status === "PLANNED") {
    await tx.scheduleRun.update({
      where: { id: run.id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });
  }
  await writeAudit(tx, {
    actorUserId: input.actor.userId,
    action: `ATTENDANCE_${input.eventType}`,
    entityType: "StudentRunState",
    entityId: state.id,
    previous: { status: state.status },
    next: { status: nextStatus, eventId: event.id, eventType: input.eventType },
  });

  const period = run.schedule.period as RunPeriod;
  const notification = input.rule.notify
    ? await notifyUsers(tx, {
        userIds: await guardianUserIds(tx, input.studentId),
        studentId: input.studentId,
        type: input.eventType,
        title: actionLabel(input.eventType, period),
        body: `${studentDisplayName(state.student)}: ${actionLabel(input.eventType, period)}`,
        sourceEventId: event.id,
      })
    : { inApp: "not_applicable" as const, push: "not_configured" as const, sms: "not_configured" as const };

  return {
    ok: true,
    confirmed: true,
    replayed: false,
    data: toData(event),
    notification,
  };
}

function replay(
  existing: {
    id: string;
    runId: string;
    studentId: string;
    eventType: AttendanceEventType;
    idempotencyKey: string;
    note: string | null;
    alternateReceiverName: string | null;
    previousStatus: StudentRunStatus | null;
    nextStatus: StudentRunStatus | null;
    recordedAt: Date;
  },
  input: {
    runId: string;
    studentId: string;
    eventType: AttendanceEventType;
    note?: string | null;
    alternateReceiverName?: string | null;
  },
): AttendanceResult {
  const same =
    existing.runId === input.runId &&
    existing.studentId === input.studentId &&
    existing.eventType === input.eventType &&
    (existing.note ?? "") === (input.note?.trim() ?? "") &&
    (existing.alternateReceiverName ?? "") === (input.alternateReceiverName?.trim() ?? "");
  if (!same) throw new DomainError(409, "IDEMPOTENCY_CONFLICT", "คีย์นี้ถูกใช้กับรายการคนละอย่าง");
  const rule = input.eventType === "CORRECTION" ? undefined : RULES[input.eventType];
  return {
    ok: true,
    confirmed: true,
    replayed: true,
    data: toData(existing),
    notification: {
      inApp: rule?.notify ? "recorded" : "not_applicable",
      push: "not_configured",
      sms: "not_configured",
    },
  };
}

async function dispositionFor(
  tx: Prisma.TransactionClient,
  input: {
    eventType: Exclude<AttendanceEventType, "CORRECTION">;
    studentId: string;
    period: RunPeriod;
    alternateReceiverName: string | null;
  },
): Promise<TripDisposition | null> {
  if (input.eventType === "BOARD") return "BOARDED";
  if (input.eventType === "NO_SHOW") return "NOT_PRESENT";
  if (input.eventType === "EXCUSE") return "ABSENCE_CONFIRMED";
  if (input.eventType === "DELAY") return null;
  if (input.eventType === "ALIGHT" && input.period === "MORNING") return "DROPPED_OFF";
  if (!input.alternateReceiverName) {
    throw new DomainError(422, "AUTHORIZED_RECEIVER_REQUIRED", "รอบนี้ต้องระบุผู้รับที่ได้รับอนุญาต ระบบจะไม่ปล่อยเด็กเอง");
  }
  await assertAuthorizedReceiver(tx, input.studentId, input.alternateReceiverName);
  return "HANDED_TO_AUTHORIZED_PERSON";
}

function toData(event: {
  id: string;
  runId: string;
  studentId: string;
  eventType: AttendanceEventType;
  previousStatus: StudentRunStatus | null;
  nextStatus: StudentRunStatus | null;
  recordedAt: Date;
}): AttendanceResult["data"] {
  return {
    id: event.id,
    runId: event.runId,
    studentId: event.studentId,
    eventType: event.eventType,
    previousStatus: event.previousStatus,
    nextStatus: event.nextStatus,
    recordedAt: event.recordedAt.toISOString(),
  };
}

export async function correctAttendance(input: {
  actor: Actor;
  runId: string;
  studentId: string;
  toStatus: StudentRunStatus;
  reason: string;
  idempotencyKey: string;
}): Promise<AttendanceResult> {
  if (input.actor.role !== "OWNER") throw new DomainError(404, "NOT_FOUND", "ไม่พบรอบรถ");
  const reason = input.reason.trim();
  if (reason.length < 10) throw new DomainError(422, "REASON_REQUIRED", "โปรดระบุเหตุผลอย่างน้อย 10 ตัวอักษร");
  await requireRun(input.actor, input.runId);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.attendanceEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      return replay(existing, {
        runId: input.runId,
        studentId: input.studentId,
        eventType: "CORRECTION",
        note: reason,
      });
    }
    const state = await tx.studentRunState.findUnique({
      where: { runId_studentId: { runId: input.runId, studentId: input.studentId } },
    });
    if (!state) throw new DomainError(404, "NOT_FOUND", "ไม่พบเด็กในรอบนี้");
    const event = await tx.attendanceEvent.create({
      data: {
        runId: input.runId,
        studentId: input.studentId,
        eventType: "CORRECTION",
        idempotencyKey: input.idempotencyKey,
        note: reason,
        previousStatus: state.status,
        nextStatus: input.toStatus,
        recordedByUserId: input.actor.userId,
      },
    });
    await tx.studentRunState.update({
      where: { id: state.id },
      data: { status: input.toStatus, disposition: dispositionFromStatus(input.toStatus) },
    });
    await tx.scheduleRun.update({
      where: { id: input.runId },
      data: { status: "IN_PROGRESS", completedAt: null },
    });
    await writeAudit(tx, {
      actorUserId: input.actor.userId,
      action: "ATTENDANCE_CORRECTION",
      entityType: "StudentRunState",
      entityId: state.id,
      previous: { status: state.status },
      next: { status: input.toStatus, reason, eventId: event.id },
    });
    return {
      ok: true,
      confirmed: true,
      replayed: false,
      data: toData(event),
      notification: { inApp: "not_applicable", push: "not_configured", sms: "not_configured" },
    };
  });
}

function dispositionFromStatus(status: StudentRunStatus): TripDisposition {
  if (status === "BOARDED") return "BOARDED";
  if (status === "ALIGHTED") return "DROPPED_OFF";
  if (status === "NO_SHOW") return "NOT_PRESENT";
  if (status === "EXCUSED") return "ABSENCE_CONFIRMED";
  return "UNKNOWN";
}

function cleanText(
  value: string | null | undefined,
  required: boolean,
  min: number,
  max: number,
  requiredMessage: string,
): string | null {
  const text = value?.trim() ?? "";
  if (!text && !required) return null;
  if (text.length < min || text.length > max) throw new DomainError(422, "INVALID_TEXT", requiredMessage);
  return text;
}

function parseClientTime(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new DomainError(422, "INVALID_TIME", "เวลาที่เครื่องบันทึกไม่ถูกต้อง");
  return date;
}
