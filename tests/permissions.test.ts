import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as guardianToday } from "@/app/api/guardian/today/route";
import { GET as students } from "@/app/api/students/route";
import { GET as audit } from "@/app/api/audit/route";
import { POST as events } from "@/app/api/runs/[runId]/events/route";
import { GET as invoices } from "@/app/api/invoices/route";
import { api, cookieFrom, createFixture, PASSWORD, resetDb } from "./helpers";

async function session(phone: string): Promise<string> {
  const response = await login(api("/api/auth/login", { body: { phone, password: PASSWORD } }));
  return cookieFrom(response);
}

beforeEach(async () => {
  await resetDb();
});

describe("permissions", () => {
  it("lets a guardian see only their own child", async () => {
    const fixture = await createFixture();
    const cookie = await session(fixture.guardianAUser.phone);
    const response = await guardianToday(api("/api/guardian/today", { cookie }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.children).toHaveLength(1);
    expect(body.children[0].nickname).toBe("หนึ่ง");
    expect(JSON.stringify(body)).not.toContain("สอง");
    expect(JSON.stringify(body)).not.toContain("แพ้ทดสอบ");
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });

  it("hides owner records and another family's attendance from a guardian", async () => {
    const fixture = await createFixture();
    const cookie = await session(fixture.guardianAUser.phone);
    expect((await students(api("/api/students", { cookie }))).status).toBe(403);
    expect((await audit(api("/api/audit", { cookie }))).status).toBe(403);
    expect((await invoices(api("/api/invoices", { cookie }))).status).toBe(200);
    const denied = await events(
      api(`/api/runs/${fixture.run.id}/events`, {
        cookie,
        body: {
          runId: fixture.run.id,
          studentId: fixture.student1.id,
          eventType: "BOARD",
          idempotencyKey: crypto.randomUUID(),
        },
      }),
      { params: Promise.resolve({ runId: fixture.run.id }) },
    );
    expect(denied.status).toBe(403);
    expect(await import("@/lib/db").then(({ prisma }) => prisma.attendanceEvent.count())).toBe(0);
  });

  it("lets the assigned driver record and hides the run from another driver", async () => {
    const fixture = await createFixture();
    const other = await session(fixture.otherUser.phone);
    const hidden = await events(
      api(`/api/runs/${fixture.run.id}/events`, {
        cookie: other,
        body: {
          runId: fixture.run.id,
          studentId: fixture.student1.id,
          eventType: "BOARD",
          idempotencyKey: crypto.randomUUID(),
        },
      }),
      { params: Promise.resolve({ runId: fixture.run.id }) },
    );
    expect(hidden.status).toBe(404);

    const assigned = await session(fixture.driverUser.phone);
    const allowed = await events(
      api(`/api/runs/${fixture.run.id}/events`, {
        cookie: assigned,
        body: {
          runId: fixture.run.id,
          studentId: fixture.student1.id,
          eventType: "BOARD",
          idempotencyKey: crypto.randomUUID(),
        },
      }),
      { params: Promise.resolve({ runId: fixture.run.id }) },
    );
    expect(allowed.status).toBe(200);
    expect((await allowed.json()).confirmed).toBe(true);
  });
});
