import { beforeEach, describe, expect, it } from "vitest";
import { POST as events } from "@/app/api/runs/[runId]/events/route";
import { POST as checkpoints } from "@/app/api/runs/[runId]/checkpoints/route";
import { prisma } from "@/lib/db";
import { recordAttendance } from "@/server/attendance";
import { DomainError } from "@/server/errors";
import { attendanceBody } from "@/server/validators";
import { toActor } from "@/server/auth";
import { api, cookieFrom, createFixture, PASSWORD, resetDb } from "./helpers";
import { POST as login } from "@/app/api/auth/login/route";

beforeEach(async () => {
  await resetDb();
});

describe("attendance", () => {
  it("confirms boarding once, notifies in-app only, and keeps an audit trail", async () => {
    const fixture = await createFixture();
    const driver = toActor({ ...fixture.driverUser, driver: { id: fixture.run.driverId }, guardian: null });
    const clientRecordedAt = "2020-01-01T00:00:00.000Z";
    const key = crypto.randomUUID();
    const first = await recordAttendance({
      actor: driver,
      runId: fixture.run.id,
      studentId: fixture.student1.id,
      eventType: "BOARD",
      idempotencyKey: key,
      clientRecordedAt,
    });
    const replay = await recordAttendance({
      actor: driver,
      runId: fixture.run.id,
      studentId: fixture.student1.id,
      eventType: "BOARD",
      idempotencyKey: key,
      clientRecordedAt,
    });
    expect(first.confirmed).toBe(true);
    expect(first.replayed).toBe(false);
    expect(first.notification).toEqual({ inApp: "recorded", push: "not_configured" });
    expect(replay.replayed).toBe(true);
    expect(new Date(first.data.recordedAt).getFullYear()).toBe(new Date().getFullYear());
    expect(await prisma.attendanceEvent.count()).toBe(1);
    const state = await prisma.studentRunState.findUniqueOrThrow({
      where: { runId_studentId: { runId: fixture.run.id, studentId: fixture.student1.id } },
    });
    expect(state.status).toBe("BOARDED");
    const note = await prisma.notification.findFirstOrThrow();
    expect(note.recipientUserId).toBe(fixture.guardianAUser.id);
    expect(note.delivery).toBe("RECORDED");
    expect(note.pushDelivery).toBe("NOT_CONFIGURED");
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "ATTENDANCE_BOARD" } });
    expect(audit.previousJson).toMatchObject({ status: "WAITING" });
    expect(audit.nextJson).toMatchObject({ status: "BOARDED" });
    expect(JSON.stringify(audit)).not.toContain("password");

    await expect(
      recordAttendance({
        actor: driver,
        runId: fixture.run.id,
        studentId: fixture.student1.id,
        eventType: "BOARD",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "ALREADY_RECORDED" });
    expect(await prisma.attendanceEvent.count({ where: { eventType: "BOARD", studentId: fixture.student1.id } })).toBe(1);
  });

  it("rejects coordinates and a drop-off before boarding", async () => {
    const fixture = await createFixture();
    const valid = {
      runId: fixture.run.id,
      studentId: fixture.student1.id,
      eventType: "BOARD",
      idempotencyKey: crypto.randomUUID(),
    };
    expect(() => attendanceBody.parse({ ...valid, latitude: 13.7, longitude: 100.5 })).toThrow();
    const cookie = cookieFrom(await login(api("/api/auth/login", { body: { phone: fixture.driverUser.phone, password: PASSWORD } })));
    const response = await events(
      api(`/api/runs/${fixture.run.id}/events`, { cookie, body: { ...valid, latitude: 13.7 } }),
      { params: Promise.resolve({ runId: fixture.run.id }) },
    );
    expect(response.status).toBe(422);
    expect((await response.json()).confirmed).toBe(false);
    expect(await prisma.attendanceEvent.count()).toBe(0);

    const driver = toActor({ ...fixture.driverUser, driver: { id: fixture.run.driverId }, guardian: null });
    await expect(
      recordAttendance({
        actor: driver,
        runId: fixture.run.id,
        studentId: fixture.student1.id,
        eventType: "ALIGHT",
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("refuses to finish a run until every child is resolved at school and at the end", async () => {
    const fixture = await createFixture();
    const driver = toActor({ ...fixture.driverUser, driver: { id: fixture.run.driverId }, guardian: null });
    await expect(recordCheckpoint(driver, fixture.run.id, "RUN_FINISHED")).rejects.toMatchObject({
      code: "CHECKPOINT_REQUIRED",
    });
    await recordAttendance({
      actor: driver,
      runId: fixture.run.id,
      studentId: fixture.student1.id,
      eventType: "BOARD",
      idempotencyKey: crypto.randomUUID(),
    });
    await expect(recordCheckpoint(driver, fixture.run.id, "ARRIVED_SCHOOL")).rejects.toMatchObject({
      code: "CHILDREN_UNRESOLVED",
    });
    expect((await prisma.scheduleRun.findUniqueOrThrow({ where: { id: fixture.run.id } })).status).not.toBe("COMPLETED");

    await recordAttendance({
      actor: driver,
      runId: fixture.run.id,
      studentId: fixture.student1.id,
      eventType: "ALIGHT",
      idempotencyKey: crypto.randomUUID(),
    });
    await recordAttendance({
      actor: driver,
      runId: fixture.run.id,
      studentId: fixture.student2.id,
      eventType: "NO_SHOW",
      idempotencyKey: crypto.randomUUID(),
    });
    const school = await recordCheckpoint(driver, fixture.run.id, "ARRIVED_SCHOOL");
    const done = await recordCheckpoint(driver, fixture.run.id, "RUN_FINISHED");
    expect(school.confirmed).toBe(true);
    expect(done.confirmed).toBe(true);
    expect((await prisma.scheduleRun.findUniqueOrThrow({ where: { id: fixture.run.id } })).status).toBe("COMPLETED");
  });
});

async function recordCheckpoint(actor: Parameters<typeof import("@/server/checkpoints").recordCheckpoint>[0], runId: string, kind: "ARRIVED_SCHOOL" | "RUN_FINISHED") {
  const { recordCheckpoint: check } = await import("@/server/checkpoints");
  return check(actor, runId, kind);
}
