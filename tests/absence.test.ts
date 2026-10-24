import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { bangkokYmd, addDays } from "@/lib/time";
import { createAbsence } from "@/server/absence";
import { toActor } from "@/server/auth";
import { recordAttendance } from "@/server/attendance";
import { createFixture, resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
});

function guardianActor(user: { id: string; role: "GUARDIAN"; name: string; phone: string }, guardianId: string) {
  return toActor({ ...user, driver: null, guardian: { id: guardianId } });
}

describe("absence requests", () => {
  it("excuses a waiting child and replays the same request", async () => {
    const fixture = await createFixture();
    const actor = guardianActor(fixture.guardianAUser, fixture.guardianA.id);
    const today = bangkokYmd();
    const key = crypto.randomUUID();
    const input = {
      studentId: fixture.student1.id,
      startDate: today,
      endDate: today,
      reason: "นัดหมายตัวอย่าง",
      affectsMorning: true,
      affectsEvening: false,
      idempotencyKey: key,
    };
    const created = await createAbsence(actor, input);
    const replay = await createAbsence(actor, input);
    expect(created.confirmed).toBe(true);
    expect(created.notification.push).toBe("not_configured");
    expect(replay.replayed).toBe(true);
    expect(await prisma.absenceRequest.count()).toBe(1);
    const state = await prisma.studentRunState.findUniqueOrThrow({
      where: { runId_studentId: { runId: fixture.run.id, studentId: fixture.student1.id } },
    });
    expect(state.status).toBe("EXCUSED");
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "ABSENCE_CREATED" } });
    expect(audit.actorUserId).toBe(fixture.guardianAUser.id);
    expect(audit.nextJson).toMatchObject({ reason: "นัดหมายตัวอย่าง" });
  });

  it("rejects another child, a past date, and an overlapping request", async () => {
    const fixture = await createFixture();
    const actor = guardianActor(fixture.guardianAUser, fixture.guardianA.id);
    const today = bangkokYmd();
    await expect(
      createAbsence(actor, {
        studentId: fixture.student2.id,
        startDate: today,
        endDate: today,
        reason: "ไม่ใช่เด็กของตน",
        affectsMorning: true,
        affectsEvening: true,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      createAbsence(actor, {
        studentId: fixture.student1.id,
        startDate: addDays(today, -1),
        endDate: today,
        reason: "ย้อนหลัง",
        affectsMorning: true,
        affectsEvening: true,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "PAST_DATE" });
    await createAbsence(actor, {
      studentId: fixture.student1.id,
      startDate: today,
      endDate: today,
      reason: "ครั้งแรก",
      affectsMorning: true,
      affectsEvening: true,
      idempotencyKey: crypto.randomUUID(),
    });
    await expect(
      createAbsence(actor, {
        studentId: fixture.student1.id,
        startDate: today,
        endDate: addDays(today, 1),
        reason: "ทับวัน",
        affectsMorning: true,
        affectsEvening: true,
        idempotencyKey: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "ABSENCE_OVERLAP" });
  });

  it("does not overwrite a child already marked on the vehicle", async () => {
    const fixture = await createFixture();
    const driver = toActor({ ...fixture.driverUser, driver: { id: fixture.driver.id }, guardian: null });
    await recordAttendance({
      actor: driver,
      runId: fixture.run.id,
      studentId: fixture.student1.id,
      eventType: "BOARD",
      idempotencyKey: crypto.randomUUID(),
    });
    const actor = guardianActor(fixture.guardianAUser, fixture.guardianA.id);
    const today = bangkokYmd();
    const result = await createAbsence(actor, {
      studentId: fixture.student1.id,
      startDate: today,
      endDate: today,
      reason: "แจ้งช้ากว่าขึ้นรถ",
      affectsMorning: true,
      affectsEvening: true,
      idempotencyKey: crypto.randomUUID(),
    });
    expect(result.confirmed).toBe(true);
    expect(result.data.unchangedRunIds).toContain(fixture.run.id);
    const state = await prisma.studentRunState.findUniqueOrThrow({
      where: { runId_studentId: { runId: fixture.run.id, studentId: fixture.student1.id } },
    });
    expect(state.status).toBe("BOARDED");
  });
});
