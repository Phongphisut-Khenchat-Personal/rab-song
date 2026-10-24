import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { bangkokYmd } from "@/lib/time";
import { toActor } from "@/server/auth";
import { applySyncBatch } from "@/server/sync";
import { createInvoice, recordPayment } from "@/server/payments";
import { createFixture, resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
});

describe("sync and duplicate protection", () => {
  it("applies an offline attendance batch once", async () => {
    const fixture = await createFixture();
    const driver = toActor({ ...fixture.driverUser, driver: { id: fixture.driver.id }, guardian: null });
    const key = crypto.randomUUID();
    const operation = {
      idempotencyKey: key,
      operationType: "ATTENDANCE" as const,
      clientCreatedAt: "2026-10-24T01:00:00.000Z",
      payload: {
        runId: fixture.run.id,
        studentId: fixture.student1.id,
        eventType: "BOARD",
        idempotencyKey: key,
      },
    };
    const first = await applySyncBatch(driver, [operation]);
    const second = await applySyncBatch(driver, [operation]);
    expect(first[0].confirmed).toBe(true);
    expect(first[0].replayed).toBe(false);
    expect(second[0].confirmed).toBe(true);
    expect(second[0].replayed).toBe(true);
    expect(await prisma.attendanceEvent.count()).toBe(1);
    expect(await prisma.syncInbox.count()).toBe(1);
  });

  it("remembers a rejected sync without saying it was confirmed", async () => {
    const fixture = await createFixture();
    const driver = toActor({ ...fixture.driverUser, driver: { id: fixture.driver.id }, guardian: null });
    const key = crypto.randomUUID();
    const operation = {
      idempotencyKey: key,
      operationType: "ATTENDANCE" as const,
      payload: {
        runId: fixture.run.id,
        studentId: fixture.student1.id,
        eventType: "ALIGHT",
        idempotencyKey: key,
      },
    };
    const first = await applySyncBatch(driver, [operation]);
    const second = await applySyncBatch(driver, [operation]);
    expect(first[0].confirmed).toBe(false);
    expect(second[0].confirmed).toBe(false);
    expect(second[0].replayed).toBe(true);
    expect(await prisma.attendanceEvent.count()).toBe(0);
  });

  it("records a payment once for the same idempotency key", async () => {
    const fixture = await createFixture();
    const owner = toActor({ ...fixture.owner, driver: null, guardian: null });
    const today = bangkokYmd();
    const invoice = await createInvoice(owner, {
      studentId: fixture.student1.id,
      yearMonth: today.slice(0, 7),
      amountBaht: "3500",
    });
    const key = crypto.randomUUID();
    const input = { invoiceId: invoice.id, amountBaht: "1500.50", method: "TRANSFER" as const, idempotencyKey: key };
    const first = await recordPayment(owner, input);
    const second = await recordPayment(owner, input);
    expect(first.confirmed).toBe(true);
    expect(second.replayed).toBe(true);
    expect(await prisma.payment.count()).toBe(1);
    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(stored.status).toBe("PARTIAL");
    expect(stored.amountSatang).toBe(350000);
  });
});
