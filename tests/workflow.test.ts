import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { pushStatusLabel } from "@/lib/confirmation";
import { bangkokDayOfWeek, bangkokYmd } from "@/lib/time";
import { addAuthorizedReceiver } from "@/server/accounts";
import { createAbsence } from "@/server/absence";
import { recordAttendance } from "@/server/attendance";
import { assertCanSeeStudent } from "@/server/access";
import { toActor } from "@/server/auth";
import { addServiceException } from "@/server/calendar";
import { recordInspection } from "@/server/inspections";
import { createLead } from "@/server/leads";
import { publishRouteVersion } from "@/server/route-versions";
import { assessTiming, estimateRoute } from "@/server/routing";
import { moveStop } from "@/server/roster";
import { ensureRunsForDate } from "@/server/runs";
import { markDisposition } from "@/server/trip-events";
import { createFixture, resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
});

describe("service workflow", () => {
  it("keeps a sales lead out of the student roster", async () => {
    const fixture = await createFixture();
    const before = await prisma.student.count();
    const lead = await createLead(owner(fixture), {
      guardianName: "ผู้สนใจ ทดสอบ",
      phone: "0899999999",
      childNickname: "ยังไม่ลงทะเบียน",
      schoolName: "โรงเรียนทดสอบ",
    });
    expect(lead.studentId).toBeNull();
    expect(lead.status).toBe("LEAD");
    expect(await prisma.student.count()).toBe(before);
  });

  it("keeps an unverified student off the production run", async () => {
    const fixture = await createFixture();
    const draft = await prisma.student.create({
      data: {
        prefix: "เด็กชาย",
        firstName: "ร่าง",
        lastName: "ทดสอบ",
        nickname: "ร่าง",
        schoolId: (await prisma.student.findUniqueOrThrow({ where: { id: fixture.student1.id } })).schoolId,
        emergencyContactName: "ผู้ปกครอง",
        emergencyContactPhone: "0800003333",
        serviceStatus: "DRAFT",
      },
    });
    const stops = await prisma.routeStop.findMany({ where: { routeId: fixture.route.id }, orderBy: { sequence: "asc" } });
    await prisma.studentRouteAssignment.create({
      data: { studentId: draft.id, routeId: fixture.route.id, pickupStopId: stops[0].id, dropoffStopId: stops[1].id },
    });
    await ensureRunsForDate(bangkokYmd());
    expect(await prisma.studentRunState.findUnique({ where: { runId_studentId: { runId: fixture.run.id, studentId: draft.id } } })).toBeNull();
  });

  it("blocks an over-capacity route and does not invent a travel time", async () => {
    const fixture = await createFixture();
    await prisma.vehicle.update({ where: { id: fixture.vehicle.id }, data: { capacity: 1 } });
    await expect(publishRouteVersion(owner(fixture), fixture.route.id, {})).rejects.toMatchObject({ code: "CAPACITY" });
    await prisma.vehicle.update({ where: { id: fixture.vehicle.id }, data: { capacity: 10 } });
    delete process.env.OSRM_BASE_URL;
    const unavailable = await estimateRoute([{ latitude: 13.7, longitude: 100.5 }, { latitude: 13.8, longitude: 100.6 }]);
    expect(unavailable.ok).toBe(false);
    if (!unavailable.ok) expect(unavailable).not.toHaveProperty("durationSeconds");
    await expect(publishRouteVersion(owner(fixture), fixture.route.id, {})).rejects.toMatchObject({ code: "ROUTING_UNAVAILABLE" });
    const published = await publishRouteVersion(owner(fixture), fixture.route.id, { acceptUnverifiedTiming: true, schoolDeadline: "07:30" });
    expect(published.estimateStatus).toBe("UNAVAILABLE");
    expect(published.durationSeconds).toBeNull();
  });

  it("blocks a route that the estimate says will miss the school deadline", async () => {
    const fixture = await createFixture();
    await prisma.routeStop.updateMany({ where: { routeId: fixture.route.id }, data: { latitude: "13.700000", longitude: "100.500000" } });
    await expect(publishRouteVersion(owner(fixture), fixture.route.id, { schoolDeadline: "06:40" }, async () => ({
      ok: true,
      approximate: true,
      distanceMeters: 1000,
      durationSeconds: 3 * 60 * 60,
      source: "osrm",
      message: "ค่าประมาณ",
    }))).rejects.toMatchObject({ code: "DEADLINE_RISK" });
    expect(assessTiming({ startTime: "06:30", durationSeconds: 600, dwellSeconds: 60, stopCount: 2, deadline: "07:30" }).withinDeadline).toBe(true);
  });

  it("refuses to close a run with an unknown child or without an empty-van sweep", async () => {
    const fixture = await createFixture();
    const driver = toActor({ ...fixture.driverUser, driver: { id: fixture.driver.id }, guardian: null });
    await recordAttendance({ actor: driver, runId: fixture.run.id, studentId: fixture.student1.id, eventType: "BOARD", idempotencyKey: crypto.randomUUID() });
    await recordAttendance({ actor: driver, runId: fixture.run.id, studentId: fixture.student1.id, eventType: "ALIGHT", idempotencyKey: crypto.randomUUID() });
    await recordAttendance({ actor: driver, runId: fixture.run.id, studentId: fixture.student2.id, eventType: "NO_SHOW", idempotencyKey: crypto.randomUUID() });
    const { recordCheckpoint } = await import("@/server/checkpoints");
    await recordCheckpoint(driver, fixture.run.id, "ARRIVED_SCHOOL");
    await expect(recordCheckpoint(driver, fixture.run.id, "RUN_FINISHED")).rejects.toMatchObject({ code: "PRETRIP_REQUIRED" });
    await recordInspection(driver, { runId: fixture.run.id, kind: "PRE_TRIP", idempotencyKey: crypto.randomUUID(), items: { driverReady: true, vehicleReady: true, rosterReviewed: true } });
    await expect(recordCheckpoint(driver, fixture.run.id, "RUN_FINISHED")).rejects.toMatchObject({ code: "SWEEP_REQUIRED" });
    await markDisposition(driver, { runId: fixture.run.id, studentId: fixture.student1.id, disposition: "UNKNOWN", idempotencyKey: crypto.randomUUID() });
    await recordInspection(driver, { runId: fixture.run.id, kind: "EMPTY_SWEEP", idempotencyKey: crypto.randomUUID(), items: { aisle: true, seats: true, floor: true, rearDoor: true } });
    await expect(recordCheckpoint(driver, fixture.run.id, "RUN_FINISHED")).rejects.toMatchObject({ code: "CHILDREN_UNRESOLVED" });
    expect((await prisma.scheduleRun.findUniqueOrThrow({ where: { id: fixture.run.id } })).status).not.toBe("COMPLETED");
  });

  it("does not change the running manifest when a pickup stop is reordered", async () => {
    const fixture = await createFixture();
    const before = await prisma.runStopSnapshot.findMany({ where: { runId: fixture.run.id }, orderBy: { sequence: "asc" } });
    expect(before.length).toBeGreaterThan(1);
    await prisma.scheduleRun.update({ where: { id: fixture.run.id }, data: { status: "IN_PROGRESS" } });
    const stops = await prisma.routeStop.findMany({ where: { routeId: fixture.route.id }, orderBy: { sequence: "asc" } });
    await moveStop(owner(fixture), fixture.route.id, stops[0].id, 1);
    const after = await prisma.runStopSnapshot.findMany({ where: { runId: fixture.run.id }, orderBy: { sequence: "asc" } });
    expect(after.map((stop) => [stop.routeStopId, stop.sequence])).toEqual(before.map((stop) => [stop.routeStopId, stop.sequence]));
    const impact = await prisma.routeImpact.findFirstOrThrow({ where: { routeId: fixture.route.id } });
    expect(impact.unchangedRunIds).toEqual([fixture.run.id]);
  });

  it("rejects an unauthorized receiver and leaves a started run unchanged after a late absence", async () => {
    const fixture = await createFixture();
    const driver = toActor({ ...fixture.driverUser, driver: { id: fixture.driver.id }, guardian: null });
    await prisma.schedule.create({
      data: { routeId: fixture.route.id, period: "EVENING", dayOfWeek: bangkokDayOfWeek(), plannedStartTime: "16:00" },
    });
    await ensureRunsForDate(bangkokYmd());
    const evening = await prisma.scheduleRun.findFirstOrThrow({ where: { schedule: { period: "EVENING" } } });
    await recordAttendance({ actor: driver, runId: evening.id, studentId: fixture.student1.id, eventType: "BOARD", idempotencyKey: crypto.randomUUID() });
    await addAuthorizedReceiver(owner(fixture), fixture.student1.id, { name: "ผู้ปกครอง ก", relationship: "มารดา" });
    await expect(recordAttendance({
      actor: driver,
      runId: evening.id,
      studentId: fixture.student1.id,
      eventType: "ALIGHT",
      alternateReceiverName: "คนแปลกหน้า",
      idempotencyKey: crypto.randomUUID(),
    })).rejects.toMatchObject({ code: "UNAUTHORIZED_RECEIVER" });
    const handed = await recordAttendance({
      actor: driver,
      runId: evening.id,
      studentId: fixture.student1.id,
      eventType: "ALIGHT",
      alternateReceiverName: "ผู้ปกครอง ก",
      idempotencyKey: crypto.randomUUID(),
    });
    expect(handed.confirmed).toBe(true);
    const state = await prisma.studentRunState.findUniqueOrThrow({ where: { runId_studentId: { runId: evening.id, studentId: fixture.student1.id } } });
    expect(state.disposition).toBe("HANDED_TO_AUTHORIZED_PERSON");

    await prisma.scheduleRun.update({ where: { id: fixture.run.id }, data: { status: "IN_PROGRESS" } });
    const guardian = toActor({ ...fixture.guardianAUser, driver: null, guardian: { id: fixture.guardianA.id } });
    const absence = await createAbsence(guardian, {
      studentId: fixture.student1.id,
      startDate: bangkokYmd(),
      endDate: bangkokYmd(),
      reason: "แจ้งหลังรถออก",
      affectsMorning: true,
      affectsEvening: false,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(absence.data.unchangedRunIds).toContain(fixture.run.id);
    const morning = await prisma.studentRunState.findUniqueOrThrow({ where: { runId_studentId: { runId: fixture.run.id, studentId: fixture.student1.id } } });
    expect(morning.status).toBe("WAITING");
    await expect(assertCanSeeStudent(toActor({ ...fixture.guardianBUser, driver: null, guardian: { id: fixture.guardianB.id } }), fixture.student1.id)).rejects.toMatchObject({ status: 404 });
  });

  it("cancels only the planned period covered by a holiday and does not call push delivered", async () => {
    const fixture = await createFixture();
    await addServiceException(owner(fixture), {
      serviceDate: bangkokYmd(),
      kind: "HOLIDAY",
      affectsMorning: true,
      affectsEvening: false,
      note: "หยุดตัวอย่าง",
    });
    expect((await prisma.scheduleRun.findUniqueOrThrow({ where: { id: fixture.run.id } })).status).toBe("CANCELLED");
    expect(pushStatusLabel("NOT_CONFIGURED")).toBe("พุชยังไม่ได้ตั้งค่า");
    expect(pushStatusLabel("FAILED")).not.toBe("พุชส่งแล้ว");
    expect(pushStatusLabel("SENT")).toBe("พุชส่งแล้ว");
  });
});

function owner(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return toActor({ ...fixture.owner, driver: null, guardian: null });
}
