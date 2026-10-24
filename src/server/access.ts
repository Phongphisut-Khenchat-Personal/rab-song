import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Actor } from "@/server/auth";
import { DomainError } from "@/server/errors";

export const runInclude = {
  schedule: {
    include: {
      route: {
        include: {
          school: true,
          vehicle: true,
          stops: { orderBy: { sequence: "asc" } },
        },
      },
    },
  },
  driver: { include: { user: true } },
  states: { include: { student: true } },
  checkpoints: { orderBy: { checkedAt: "asc" } },
} satisfies Prisma.ScheduleRunInclude;

export type LoadedRun = Prisma.ScheduleRunGetPayload<{ include: typeof runInclude }>;

export async function requireRun(actor: Actor, runId: string): Promise<LoadedRun> {
  const run = await prisma.scheduleRun.findUnique({ where: { id: runId }, include: runInclude });
  if (!run || !canOperateRun(actor, run.driverId)) {
    throw new DomainError(404, "NOT_FOUND", "ไม่พบรอบรถ");
  }
  return run;
}

export function canOperateRun(actor: Actor, driverId: string): boolean {
  if (actor.role === "OWNER") return true;
  return actor.role === "DRIVER" && actor.driverId === driverId;
}

export async function assertCanSeeStudent(actor: Actor, studentId: string): Promise<void> {
  if (actor.role === "OWNER") return;
  if (actor.role === "GUARDIAN" && actor.guardianId) {
    const link = await prisma.studentGuardian.findUnique({
      where: { studentId_guardianId: { studentId, guardianId: actor.guardianId } },
    });
    if (link) return;
  }
  throw new DomainError(404, "NOT_FOUND", "ไม่พบข้อมูล");
}
