import { prisma } from "@/lib/db";
import { isThaiMobile, normalizePhone } from "@/lib/phone";
import { studentDisplayName } from "@/lib/labels";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/auth";
import { DomainError, isUniqueViolation } from "@/server/errors";
import { recordRouteImpact, refreshPlannedSnapshots } from "@/server/route-versions";

function ownerOnly(actor: Actor): void {
  if (actor.role !== "OWNER") throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
}

function studentData(input: {
  prefix: "เด็กชาย" | "เด็กหญิง";
  firstName: string;
  lastName: string;
  nickname: string;
  schoolId: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  allergyNote?: string;
}) {
  const phone = normalizePhone(input.emergencyContactPhone);
  if (!isThaiMobile(phone)) throw new DomainError(422, "INVALID_PHONE", "เบอร์ฉุกเฉินต้องมี 10 หลักขึ้นต้นด้วย 0");
  return {
    prefix: input.prefix,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    nickname: input.nickname.trim(),
    schoolId: input.schoolId,
    emergencyContactName: input.emergencyContactName.trim(),
    emergencyContactPhone: phone,
    allergyNote: input.allergyNote?.trim() || null,
  };
}

export async function createStudent(actor: Actor, input: Parameters<typeof studentData>[0]) {
  ownerOnly(actor);
  const data = studentData(input);
  const student = await prisma.$transaction(async (tx) => {
    const created = await tx.student.create({ data: { ...data, serviceStatus: "DRAFT" } });
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "STUDENT_CREATED",
      entityType: "Student",
      entityId: created.id,
      next: data,
    });
    return created;
  });
  return { id: student.id };
}

export async function updateStudent(
  actor: Actor,
  studentId: string,
  input: Parameters<typeof studentData>[0] & { active?: boolean },
) {
  ownerOnly(actor);
  const data = studentData(input);
  const previous = await prisma.student.findUnique({ where: { id: studentId } });
  if (!previous) throw new DomainError(404, "NOT_FOUND", "ไม่พบนักเรียน");
  await prisma.$transaction(async (tx) => {
    await tx.student.update({
      where: { id: studentId },
      data: { ...data, active: input.active ?? previous.active },
    });
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "STUDENT_UPDATED",
      entityType: "Student",
      entityId: studentId,
      previous: {
        prefix: previous.prefix,
        firstName: previous.firstName,
        lastName: previous.lastName,
        nickname: previous.nickname,
        emergencyContactName: previous.emergencyContactName,
        emergencyContactPhone: previous.emergencyContactPhone,
        allergyNote: previous.allergyNote,
        active: previous.active,
      },
      next: { ...data, active: input.active ?? previous.active },
    });
  });
  return { id: studentId };
}

export async function listStudents(actor: Actor) {
  ownerOnly(actor);
  const students = await prisma.student.findMany({
    orderBy: [{ active: "desc" }, { nickname: "asc" }],
    include: {
      school: true,
      guardians: { include: { guardian: { include: { user: true } } } },
      assignments: { include: { route: true, pickupStop: true, dropoffStop: true } },
    },
  });
  return students.map((student) => ({
    id: student.id,
    displayName: studentDisplayName(student),
    prefix: student.prefix,
    firstName: student.firstName,
    lastName: student.lastName,
    nickname: student.nickname,
    schoolId: student.schoolId,
    schoolName: student.school.name,
    emergencyContactName: student.emergencyContactName,
    emergencyContactPhone: student.emergencyContactPhone,
    allergyNote: student.allergyNote,
    serviceStatus: student.serviceStatus,
    active: student.active,
    guardians: student.guardians.map((link) => ({
      id: link.guardianId,
      name: link.guardian.user.name,
      phone: link.guardian.user.phone,
      relationship: link.relationship,
      isPrimary: link.isPrimary,
    })),
    assignments: student.assignments.map((assignment) => ({
      routeId: assignment.routeId,
      routeName: assignment.route.name,
      pickupStopId: assignment.pickupStopId,
      dropoffStopId: assignment.dropoffStopId,
      active: assignment.active,
    })),
  }));
}

export async function createSchool(actor: Actor, input: { name: string; address: string }) {
  ownerOnly(actor);
  const school = await prisma.$transaction(async (tx) => {
    const created = await tx.school.create({ data: { name: input.name.trim(), address: input.address.trim() } });
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "SCHOOL_CREATED",
      entityType: "School",
      entityId: created.id,
      next: { name: created.name, address: created.address },
    });
    return created;
  });
  return { id: school.id, name: school.name };
}

export async function listSchools(actor: Actor) {
  ownerOnly(actor);
  return prisma.school.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export async function listRoutes(actor: Actor) {
  ownerOnly(actor);
  const routes = await prisma.route.findMany({
    where: { active: true },
    include: {
      school: true,
      vehicle: { include: { driver: { include: { user: true } } } },
      stops: { orderBy: { sequence: "asc" } },
      schedules: { where: { active: true } },
    },
    orderBy: { name: "asc" },
  });
  return routes.map((route) => ({
    id: route.id,
    name: route.name,
    schoolName: route.school.name,
    vehicleId: route.vehicleId,
    vehiclePlate: route.vehicle.plateNumber,
    vehicleLabel: route.vehicle.label,
    capacity: route.vehicle.capacity,
    driverName: route.vehicle.driver.user.name,
    stops: route.stops.map((stop) => ({
      id: stop.id,
      name: stop.name,
      sequence: stop.sequence,
      address: stop.address,
      latitude: stop.latitude ? Number(stop.latitude.toString()) : null,
      longitude: stop.longitude ? Number(stop.longitude.toString()) : null,
    })),
    schedules: route.schedules.map((schedule) => ({
      id: schedule.id,
      period: schedule.period,
      dayOfWeek: schedule.dayOfWeek,
      plannedStartTime: schedule.plannedStartTime,
    })),
  }));
}

export async function addStop(actor: Actor, routeId: string, input: { name: string; address: string }) {
  ownerOnly(actor);
  const route = await prisma.route.findUnique({ where: { id: routeId }, include: { stops: true } });
  if (!route) throw new DomainError(404, "NOT_FOUND", "ไม่พบเส้นทาง");
  const sequence = Math.max(0, ...route.stops.map((stop) => stop.sequence)) + 1;
  const stop = await prisma.$transaction(async (tx) => {
    const created = await tx.routeStop.create({
      data: { routeId, name: input.name.trim(), address: input.address.trim(), sequence },
    });
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "STOP_CREATED",
      entityType: "RouteStop",
      entityId: created.id,
      next: { routeId, name: created.name, sequence },
    });
    return created;
  });
  return { id: stop.id, sequence: stop.sequence };
}

export async function updateStopLocation(actor: Actor, routeId: string, stopId: string, input: { latitude: number; longitude: number }) {
  ownerOnly(actor);
  const stop = await prisma.routeStop.findFirst({ where: { id: stopId, routeId } });
  if (!stop) throw new DomainError(404, "NOT_FOUND", "ไม่พบจุดนี้");
  await prisma.$transaction(async (tx) => {
    await tx.routeStop.update({
      where: { id: stop.id },
      data: { latitude: input.latitude, longitude: input.longitude },
    });
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "STOP_LOCATION",
      entityType: "RouteStop",
      entityId: stop.id,
      previous: { latitude: stop.latitude?.toString() ?? null, longitude: stop.longitude?.toString() ?? null },
      next: { latitude: input.latitude, longitude: input.longitude },
    });
  });
  return { ok: true as const, confirmed: true as const };
}

export async function moveStop(actor: Actor, routeId: string, stopId: string, direction: -1 | 1) {
  ownerOnly(actor);
  const stops = await prisma.routeStop.findMany({ where: { routeId }, orderBy: { sequence: "asc" } });
  const index = stops.findIndex((stop) => stop.id === stopId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= stops.length) {
    throw new DomainError(422, "INVALID_MOVE", "เลื่อนจุดนี้ต่อไม่ได้");
  }
  const current = stops[index];
  const other = stops[target];
  await prisma.$transaction(async (tx) => {
    await tx.routeStop.update({ where: { id: current.id }, data: { sequence: 1000 + current.sequence } });
    await tx.routeStop.update({ where: { id: other.id }, data: { sequence: current.sequence } });
    await tx.routeStop.update({ where: { id: current.id }, data: { sequence: other.sequence } });
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "STOP_REORDERED",
      entityType: "Route",
      entityId: routeId,
      previous: { stopId: current.id, sequence: current.sequence },
      next: { stopId: current.id, sequence: other.sequence },
    });
  });
  await refreshPlannedSnapshots(routeId);
  await recordRouteImpact(actor, routeId, "STOP_REORDERED");
  return { ok: true as const, confirmed: true as const };
}

export async function assignStudent(
  actor: Actor,
  input: { studentId: string; routeId: string; pickupStopId: string; dropoffStopId: string },
) {
  ownerOnly(actor);
  const route = await prisma.route.findUnique({
    where: { id: input.routeId },
    include: { vehicle: true, stops: true, assignments: { where: { active: true } } },
  });
  if (!route) throw new DomainError(404, "NOT_FOUND", "ไม่พบเส้นทาง");
  if (!route.stops.some((stop) => stop.id === input.pickupStopId) || !route.stops.some((stop) => stop.id === input.dropoffStopId)) {
    throw new DomainError(422, "STOP_ROUTE", "จุดรับและจุดส่งต้องอยู่บนเส้นทางนี้");
  }
  const existing = route.assignments.find((item) => item.studentId === input.studentId);
  if (!existing && route.assignments.length >= route.vehicle.capacity) {
    throw new DomainError(422, "CAPACITY", "จำนวนเด็กเกินความจุรถ");
  }
  const saved = existing
    ? await prisma.studentRouteAssignment.update({
        where: { id: existing.id },
        data: { pickupStopId: input.pickupStopId, dropoffStopId: input.dropoffStopId, active: true },
      })
    : await prisma.studentRouteAssignment.create({ data: { ...input, active: true } });
  await prisma.$transaction((tx) =>
    writeAudit(tx, {
      actorUserId: actor.userId,
      action: "ASSIGNMENT_SAVED",
      entityType: "StudentRouteAssignment",
      entityId: saved.id,
      previous: existing ? { pickupStopId: existing.pickupStopId, dropoffStopId: existing.dropoffStopId } : null,
      next: { studentId: input.studentId, routeId: input.routeId, pickupStopId: input.pickupStopId, dropoffStopId: input.dropoffStopId },
    }),
  );
  await recordRouteImpact(actor, input.routeId, "ASSIGNMENT_CHANGED");
  return { id: saved.id };
}

export async function updateVehicle(
  actor: Actor,
  vehicleId: string,
  input: { plateNumber: string; label: string; capacity: number },
) {
  ownerOnly(actor);
  const previous = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!previous) throw new DomainError(404, "NOT_FOUND", "ไม่พบรถ");
  const activeRiders = await prisma.studentRouteAssignment.count({
    where: { active: true, route: { vehicleId, active: true } },
  });
  if (input.capacity < activeRiders) throw new DomainError(422, "CAPACITY", "ความจุน้อยกว่าจำนวนเด็กที่อยู่บนเส้นทาง");
  try {
    await prisma.$transaction(async (tx) => {
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: { plateNumber: input.plateNumber.trim(), label: input.label.trim(), capacity: input.capacity },
      });
      await writeAudit(tx, {
        actorUserId: actor.userId,
        action: "VEHICLE_UPDATED",
        entityType: "Vehicle",
        entityId: vehicleId,
        previous: { plateNumber: previous.plateNumber, label: previous.label, capacity: previous.capacity },
        next: input,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError(409, "DUPLICATE_PLATE", "ทะเบียนนี้มีแล้ว");
    throw error;
  }
  return { id: vehicleId };
}
