import { createHash, randomBytes } from "node:crypto";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SESSION_HOURS } from "@/lib/http";
import { isThaiMobile, normalizePhone } from "@/lib/phone";
import { hashPassword, verifyPasswordOrDummy } from "@/lib/password";
import { writeAudit } from "@/server/audit";
import { DomainError } from "@/server/errors";

export type Actor = {
  userId: string;
  role: UserRole;
  name: string;
  phone: string;
  driverId: string | null;
  guardianId: string | null;
};

const failures = new Map<string, number[]>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

export function resetLoginLimiter(): void {
  failures.clear();
}

function tooManyFailures(phone: string): boolean {
  const now = Date.now();
  const recent = (failures.get(phone) ?? []).filter((time) => now - time < WINDOW_MS);
  failures.set(phone, recent);
  return recent.length >= MAX_FAILURES;
}

function markFailure(phone: string): void {
  const now = Date.now();
  const recent = (failures.get(phone) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  failures.set(phone, recent);
}

type AccountUser = {
  id: string;
  role: UserRole;
  name: string;
  phone: string;
  active: boolean;
  driver: { id: string } | null;
  guardian: { id: string } | null;
};

export function toActor(user: AccountUser): Actor {
  return {
    userId: user.id,
    role: user.role,
    name: user.name,
    phone: user.phone,
    driverId: user.driver?.id ?? null,
    guardianId: user.guardian?.id ?? null,
  };
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function login(input: { phone: string; password: string; userAgent?: string | null }) {
  const phone = normalizePhone(input.phone);
  if (!isThaiMobile(phone) || input.password.length < 8 || input.password.length > 128) {
    throw new DomainError(401, "INVALID_LOGIN", "เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง");
  }
  if (tooManyFailures(phone)) {
    throw new DomainError(429, "RATE_LIMITED", "ลองเข้าสู่ระบบบ่อยเกินไป โปรดรอสักครู่");
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    include: { driver: true, guardian: true },
  });
  const valid = await verifyPasswordOrDummy(input.password, user?.passwordHash ?? null);
  if (!user || !valid) {
    markFailure(phone);
    throw new DomainError(401, "INVALID_LOGIN", "เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง");
  }
  if (!user.active) {
    throw new DomainError(403, "INACTIVE", "บัญชีนี้ถูกปิดใช้งาน");
  }

  failures.delete(phone);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await prisma.$transaction(async (tx) => {
    await tx.session.create({
      data: {
        userId: user.id,
        tokenHash: tokenHash(token),
        expiresAt,
      },
    });
    await writeAudit(tx, {
      actorUserId: user.id,
      action: "LOGIN",
      entityType: "User",
      entityId: user.id,
      next: { role: user.role },
    });
  });
  return { token, expiresAt, actor: toActor(user) };
}

export async function logout(token: string | null): Promise<void> {
  if (!token) return;
  await prisma.session.updateMany({
    where: { tokenHash: tokenHash(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function actorFromToken(token: string | null): Promise<Actor | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: { include: { driver: true, guardian: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) return null;
  if (!session.user.active) return null;
  return toActor(session.user);
}

export async function createUserAccount(input: {
  phone: string;
  name: string;
  password: string;
  role: UserRole;
}): Promise<{ id: string }> {
  const phone = normalizePhone(input.phone);
  if (!isThaiMobile(phone)) throw new DomainError(422, "INVALID_PHONE", "เบอร์โทรต้องมี 10 หลักขึ้นต้นด้วย 0");
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.user.create({
      data: { phone, name: input.name.trim(), passwordHash, role: input.role },
      select: { id: true },
    });
  } catch (error) {
    if (isUnique(error)) throw new DomainError(409, "DUPLICATE_PHONE", "เบอร์โทรนี้มีบัญชีแล้ว");
    throw error;
  }
}

function isUnique(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
