import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/auth";
import { DomainError } from "@/server/errors";
import { assessTiming, estimateRoute, type RouteEstimate } from "@/server/routing";

type Estimator = typeof estimateRoute;

export async function recordRouteImpact(actor: Actor, routeId: string, reason: string) {
  const running = await prisma.scheduleRun.findMany({
    where: { status: "IN_PROGRESS", schedule: { routeId } },
    select: { id: true },
  });
  await prisma.routeImpact.create({
    data: { routeId, reason, unchangedRunIds: running.map((run) => run.id), actorUserId: actor.userId },
  });
  const published = await prisma.routeVersion.findFirst({ where: { routeId, status: "PUBLISHED" } });
  if (!published) return running.map((run) => run.id);
  const open = await prisma.routeVersion.findFirst({ where: { routeId, status: { in: ["DRAFT", "LOCKED"] } } });
  if (!open) await createDraft(actor, routeId);
  return running.map((run) => run.id);
}

export async function refreshPlannedSnapshots(routeId: string) {
  const [runs, stops] = await Promise.all([
    prisma.scheduleRun.findMany({ where: { status: "PLANNED", schedule: { routeId } }, select: { id: true } }),
    prisma.routeStop.findMany({ where: { routeId }, orderBy: { sequence: "asc" } }),
  ]);
  for (const run of runs) {
    await prisma.$transaction([
      prisma.runStopSnapshot.deleteMany({ where: { runId: run.id } }),
      prisma.runStopSnapshot.createMany({
        data: stops.map((stop) => ({ runId: run.id, routeStopId: stop.id, sequence: stop.sequence, name: stop.name })),
      }),
    ]);
  }
}

export async function createDraft(actor: Actor, routeId: string, schoolDeadline = "07:30") {
  if (actor.role !== "OWNER") throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  const route = await prisma.route.findUnique({ where: { id: routeId }, include: { stops: { orderBy: { sequence: "asc" } }, versions: true } });
  if (!route) throw new DomainError(404, "NOT_FOUND", "ไม่พบเส้นทาง");
  const number = Math.max(0, ...route.versions.map((version) => version.number)) + 1;
  const version = await prisma.routeVersion.create({
    data: {
      routeId,
      number,
      schoolDeadline,
      stops: { create: route.stops.map((stop) => ({ routeStopId: stop.id, sequence: stop.sequence })) },
    },
  });
  return version;
}

export async function publishRouteVersion(
  actor: Actor,
  routeId: string,
  input: { acceptUnverifiedTiming?: boolean; schoolDeadline?: string },
  estimate: Estimator = estimateRoute,
) {
  if (actor.role !== "OWNER") throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: {
      vehicle: true,
      stops: { orderBy: { sequence: "asc" } },
      assignments: { where: { active: true } },
      schedules: { where: { active: true, period: "MORNING" }, take: 1 },
      versions: { orderBy: { number: "desc" } },
    },
  });
  if (!route) throw new DomainError(404, "NOT_FOUND", "ไม่พบเส้นทาง");
  if (route.assignments.length > route.vehicle.capacity) {
    throw new DomainError(422, "CAPACITY", "จำนวนเด็กบนเส้นทางเกินความจุรถ จึงยังเผยแพร่ไม่ได้");
  }
  let version = route.versions.find((item) => item.status === "DRAFT" || item.status === "LOCKED");
  if (!version) version = await createDraft(actor, routeId, input.schoolDeadline);
  const deadline = input.schoolDeadline ?? version.schoolDeadline;
  const points = route.stops.flatMap((stop) => {
    if (stop.latitude === null || stop.longitude === null) return [];
    return [{ latitude: Number(stop.latitude), longitude: Number(stop.longitude) }];
  });
  const estimated = points.length === route.stops.length ? await estimate(points) : unavailable("พิกัดจุดไม่ครบ");
  if (!estimated.ok && !input.acceptUnverifiedTiming) throw new DomainError(422, estimated.code, estimated.message);
  if (estimated.ok) {
    const startTime = route.schedules[0]?.plannedStartTime ?? "06:30";
    const timing = assessTiming({
      startTime,
      durationSeconds: estimated.durationSeconds,
      dwellSeconds: version.dwellSeconds,
      stopCount: route.stops.length,
      deadline,
    });
    if (!timing.withinDeadline) {
      throw new DomainError(422, "DEADLINE_RISK", `ค่าประมาณถึงโรงเรียนราว ${timing.arrivesBy} ซึ่งช้ากว่าเวลาที่กำหนด ${deadline} เวลานี้ไม่ได้รับประกัน`);
    }
  }
  const published = await prisma.$transaction(async (tx) => {
    await tx.routeVersion.updateMany({ where: { routeId, status: "PUBLISHED" }, data: { status: "SUPERSEDED" } });
    const saved = await tx.routeVersion.update({
      where: { id: version.id },
      data: {
        status: "PUBLISHED",
        schoolDeadline: deadline,
        publishedAt: new Date(),
        estimateStatus: estimated.ok ? "ESTIMATED" : "UNAVAILABLE",
        distanceMeters: estimated.ok ? estimated.distanceMeters : null,
        durationSeconds: estimated.ok ? estimated.durationSeconds : null,
        estimateNote: estimated.ok ? estimated.message : "ไม่ได้คำนวณเวลา เพราะไม่มีผลจากเซิร์ฟเวอร์เส้นทาง",
        acceptUnverifiedTiming: !estimated.ok,
      },
    });
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "ROUTE_PUBLISHED",
      entityType: "RouteVersion",
      entityId: saved.id,
      next: {
        estimateStatus: saved.estimateStatus,
        durationSeconds: saved.durationSeconds,
        acceptUnverifiedTiming: saved.acceptUnverifiedTiming,
      },
    });
    return saved;
  });
  return { id: published.id, estimateStatus: published.estimateStatus, durationSeconds: published.durationSeconds };
}

function unavailable(message: string): RouteEstimate {
  return { ok: false, code: "ROUTING_UNAVAILABLE", message: `ยังคำนวณเวลาและระยะทางไม่ได้ เพราะ${message}` };
}

export async function copySnapshots(tx: Prisma.TransactionClient, runId: string, routeId: string) {
  const existing = await tx.runStopSnapshot.count({ where: { runId } });
  if (existing > 0) return;
  const stops = await tx.routeStop.findMany({ where: { routeId }, orderBy: { sequence: "asc" } });
  if (stops.length === 0) return;
  await tx.runStopSnapshot.createMany({
    data: stops.map((stop) => ({ runId, routeStopId: stop.id, sequence: stop.sequence, name: stop.name })),
    skipDuplicates: true,
  });
}
