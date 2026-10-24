import { prisma } from "@/lib/db";
import {
  allowedDriverActions,
  periodLabel,
  statusLabel,
  studentDisplayName,
  type RunPeriod,
  type StudentRunStatus,
} from "@/lib/labels";
import { bangkokDayOfWeek, bangkokYmd, dateFromYmd } from "@/lib/time";
import { requireRun, type LoadedRun } from "@/server/access";
import type { Actor } from "@/server/auth";
import { DomainError, isUniqueViolation } from "@/server/errors";

export async function ensureRunsForDate(ymd = bangkokYmd()): Promise<void> {
  const serviceDate = dateFromYmd(ymd);
  const schedules = await prisma.schedule.findMany({
    where: { active: true, dayOfWeek: bangkokDayOfWeek(ymd), route: { active: true } },
    include: {
      route: {
        include: {
          vehicle: true,
          assignments: {
            where: { active: true, student: { active: true } },
            select: { studentId: true },
          },
        },
      },
    },
  });

  for (const schedule of schedules) {
    const studentIds = schedule.route.assignments.map((assignment) => assignment.studentId);
    const absences = await prisma.absenceRequest.findMany({
      where: {
        studentId: { in: studentIds },
        status: { not: "CANCELLED" },
        startDate: { lte: serviceDate },
        endDate: { gte: serviceDate },
        ...(schedule.period === "MORNING" ? { affectsMorning: true } : { affectsEvening: true }),
      },
      select: { studentId: true },
    });
    const excused = new Set(absences.map((absence) => absence.studentId));
    let run = await prisma.scheduleRun.findUnique({
      where: { scheduleId_serviceDate: { scheduleId: schedule.id, serviceDate } },
    });
    if (!run) {
      try {
        run = await prisma.scheduleRun.create({
          data: {
            scheduleId: schedule.id,
            serviceDate,
            driverId: schedule.route.vehicle.driverId,
            status: "PLANNED",
          },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        run = await prisma.scheduleRun.findUniqueOrThrow({
          where: { scheduleId_serviceDate: { scheduleId: schedule.id, serviceDate } },
        });
      }
    }
    for (const studentId of studentIds) {
      try {
        await prisma.studentRunState.create({
          data: {
            runId: run.id,
            studentId,
            status: excused.has(studentId) ? "EXCUSED" : "WAITING",
          },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
  }
}

export async function getDriverToday(actor: Actor, ymd = bangkokYmd()) {
  if (actor.role === "GUARDIAN") throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  await ensureRunsForDate(ymd);
  const runs = await prisma.scheduleRun.findMany({
    where: {
      serviceDate: dateFromYmd(ymd),
      ...(actor.role === "DRIVER" ? { driverId: actor.driverId ?? "missing-driver" } : {}),
    },
    include: {
      schedule: { include: { route: { include: { vehicle: true } } } },
      states: true,
    },
  });
  return runs
    .map((run) => ({
      id: run.id,
      period: run.schedule.period,
      periodLabel: periodLabel(run.schedule.period),
      plannedStartTime: run.schedule.plannedStartTime,
      routeName: run.schedule.route.name,
      vehiclePlate: run.schedule.route.vehicle.plateNumber,
      status: run.status,
      counts: countStatuses(run.states.map((state) => state.status)),
    }))
    .sort((a, b) => a.period.localeCompare(b.period) * -1);
}

export async function getRunDetail(actor: Actor, runId: string) {
  await ensureRunsForDate();
  const run = await requireRun(actor, runId);
  return serializeRun(run);
}

function serializeRun(run: LoadedRun) {
  const period = run.schedule.period as RunPeriod;
  const assignments = new Map(
    run.schedule.route.stops.map((stop) => [stop.id, stop]),
  );
  return loadAssignments(run, period, assignments);
}

async function loadAssignments(run: LoadedRun, period: RunPeriod, _stops: Map<string, LoadedRun["schedule"]["route"]["stops"][number]>) {
  const assignments = await prisma.studentRouteAssignment.findMany({
    where: { routeId: run.schedule.routeId, active: true },
    include: { pickupStop: true, dropoffStop: true },
  });
  const assignmentByStudent = new Map(assignments.map((assignment) => [assignment.studentId, assignment]));
  const students = run.states
    .map((state) => {
      const assignment = assignmentByStudent.get(state.studentId);
      const stop = period === "MORNING" ? assignment?.pickupStop : assignment?.dropoffStop;
      return {
        id: state.student.id,
        displayName: studentDisplayName(state.student),
        nickname: state.student.nickname,
        status: state.status,
        statusLabel: statusLabel(state.status, period),
        stopName: stop?.name ?? "ยังไม่กำหนดจุด",
        sequence: stop?.sequence ?? 999,
        address: stop?.address ?? "",
        latitude: coord(stop?.latitude),
        longitude: coord(stop?.longitude),
        emergencyContactName: state.student.emergencyContactName,
        emergencyContactPhone: state.student.emergencyContactPhone,
        allergyNote: state.student.allergyNote,
        alternateReceiverName: state.alternateReceiverName,
        allowedActions: run.status === "COMPLETED" || run.status === "CANCELLED" ? [] : allowedDriverActions(state.status),
      };
    })
    .sort((a, b) => a.sequence - b.sequence || a.nickname.localeCompare(b.nickname, "th"));

  const passed = new Set(run.checkpoints.filter((item) => item.passed).map((item) => item.kind));
  return {
    id: run.id,
    serviceDate: run.serviceDate.toISOString().slice(0, 10),
    period,
    periodLabel: periodLabel(period),
    status: run.status,
    routeName: run.schedule.route.name,
    schoolName: run.schedule.route.school.name,
    vehiclePlate: run.schedule.route.vehicle.plateNumber,
    driverName: run.driver.user.name,
    driverPhone: run.driver.user.phone,
    counts: countStatuses(students.map((student) => student.status)),
    checkpoints: {
      arrivedSchool: passed.has("ARRIVED_SCHOOL"),
      leftSchool: passed.has("LEFT_SCHOOL"),
      finished: passed.has("RUN_FINISHED"),
    },
    students,
  };
}

export async function getGuardianToday(actor: Actor, ymd = bangkokYmd()) {
  if (actor.role !== "GUARDIAN" || !actor.guardianId) throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  await ensureRunsForDate(ymd);
  const links = await prisma.studentGuardian.findMany({
    where: { guardianId: actor.guardianId },
    include: { student: { include: { school: true } } },
  });
  const states = await prisma.studentRunState.findMany({
    where: { studentId: { in: links.map((link) => link.studentId) }, run: { serviceDate: dateFromYmd(ymd) } },
    include: {
      run: {
        include: {
          schedule: true,
          driver: { include: { user: true } },
        },
      },
      student: true,
    },
  });
  const vehicleIds = new Set<string>();
  const schedules = await prisma.schedule.findMany({
    where: { id: { in: states.map((state) => state.run.scheduleId) } },
    include: { route: { include: { vehicle: true } } },
  });
  const scheduleById = new Map(schedules.map((schedule) => [schedule.id, schedule]));
  for (const schedule of schedules) vehicleIds.add(schedule.route.vehicleId);

  return links.map((link) => {
    const own = states.filter((state) => state.studentId === link.studentId);
    const slice = (period: RunPeriod) => {
      const state = own.find((item) => item.run.schedule.period === period);
      if (!state) return null;
      const schedule = scheduleById.get(state.run.scheduleId);
      return {
        runId: state.runId,
        status: state.status,
        statusLabel: statusLabel(state.status, period),
        driverName: state.run.driver.user.name,
        driverPhone: state.run.driver.user.phone,
        vehiclePlate: schedule?.route.vehicle.plateNumber ?? "",
        alternateReceiverName: state.alternateReceiverName,
      };
    };
    return {
      studentId: link.studentId,
      displayName: studentDisplayName(link.student),
      nickname: link.student.nickname,
      schoolName: link.student.school.name,
      allergyNote: link.student.allergyNote,
      morning: slice("MORNING"),
      evening: slice("EVENING"),
    };
  });
}

export async function getGuardianHistory(actor: Actor) {
  if (actor.role !== "GUARDIAN" || !actor.guardianId) throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  const links = await prisma.studentGuardian.findMany({
    where: { guardianId: actor.guardianId },
    select: { studentId: true },
  });
  const events = await prisma.attendanceEvent.findMany({
    where: {
      studentId: { in: links.map((link) => link.studentId) },
      eventType: { in: ["BOARD", "ALIGHT", "NO_SHOW", "EXCUSE", "DELAY", "ALTERNATE_RECEIVER"] },
    },
    include: { student: true, run: { include: { schedule: true } } },
    orderBy: { recordedAt: "desc" },
    take: 100,
  });
  return events.map((event) => ({
    id: event.id,
    studentName: studentDisplayName(event.student),
    period: event.run.schedule.period,
    periodLabel: periodLabel(event.run.schedule.period),
    eventType: event.eventType,
    label: statusLabel(
      event.nextStatus ?? "WAITING",
      event.run.schedule.period,
    ),
    note: event.note,
    alternateReceiverName: event.alternateReceiverName,
    recordedAt: event.recordedAt.toISOString(),
  }));
}

export async function listNotifications(actor: Actor) {
  const rows = await prisma.notification.findMany({
    where: { recipientUserId: actor.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    delivery: row.delivery,
    pushDelivery: row.pushDelivery,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getOwnerSummary(actor: Actor, ymd = bangkokYmd()) {
  if (actor.role !== "OWNER") throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  await ensureRunsForDate(ymd);
  const [runs, pendingAbsences, unpaidInvoices, exceptions, audits] = await Promise.all([
    getDriverToday(actor, ymd),
    prisma.absenceRequest.count({ where: { status: "SUBMITTED" } }),
    prisma.invoice.count({ where: { status: { in: ["UNPAID", "PARTIAL"] } } }),
    prisma.attendanceEvent.findMany({
      where: {
        eventType: { in: ["NO_SHOW", "DELAY", "ALTERNATE_RECEIVER"] },
        run: { serviceDate: dateFromYmd(ymd) },
      },
      include: { student: true, run: { include: { schedule: true } } },
      orderBy: { recordedAt: "desc" },
      take: 20,
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true, role: true } } },
    }),
  ]);
  return {
    runs,
    pendingAbsences,
    unpaidInvoices,
    exceptions: exceptions.map((event) => ({
      id: event.id,
      studentName: studentDisplayName(event.student),
      periodLabel: periodLabel(event.run.schedule.period),
      eventType: event.eventType,
      note: event.note,
      recordedAt: event.recordedAt.toISOString(),
    })),
    audits: audits.map(serializeAudit),
  };
}

export async function listAudit(actor: Actor) {
  if (actor.role !== "OWNER") throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { name: true, role: true } } },
  });
  return rows.map(serializeAudit);
}

function serializeAudit(row: {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  previousJson: unknown;
  nextJson: unknown;
  createdAt: Date;
  actor: { name: string; role: string } | null;
}) {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    previous: row.previousJson,
    next: row.nextJson,
    actorName: row.actor?.name ?? "ระบบ",
    actorRole: row.actor?.role ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function countStatuses(statuses: StudentRunStatus[]) {
  return {
    total: statuses.length,
    boarded: statuses.filter((status) => status === "BOARDED" || status === "ALIGHTED").length,
    unconfirmed: statuses.filter((status) => status === "WAITING").length,
    onBoard: statuses.filter((status) => status === "BOARDED").length,
    alighted: statuses.filter((status) => status === "ALIGHTED").length,
    noShow: statuses.filter((status) => status === "NO_SHOW").length,
    excused: statuses.filter((status) => status === "EXCUSED").length,
  };
}

function coord(value: { toString(): string } | null | undefined): number | null {
  if (!value) return null;
  const number = Number(value.toString());
  return Number.isFinite(number) ? number : null;
}
