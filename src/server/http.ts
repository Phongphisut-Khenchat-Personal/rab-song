import { ZodError } from "zod";
import type { UserRole } from "@prisma/client";
import { readCookie, SESSION_COOKIE } from "@/lib/http";
import { actorFromToken, type Actor } from "@/server/auth";
import { DomainError, isDomainError } from "@/server/errors";

export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new DomainError(403, "BAD_ORIGIN", "ที่มาของคำขอไม่ถูกต้อง");
  }
  if (!host || originHost !== host) {
    throw new DomainError(403, "BAD_ORIGIN", "ที่มาของคำขอไม่ถูกต้อง");
  }
}

export async function requireUser(req: Request, roles?: UserRole[]): Promise<Actor> {
  assertSameOrigin(req);
  const actor = await actorFromToken(readCookie(req, SESSION_COOKIE));
  if (!actor) throw new DomainError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบ");
  if (roles && !roles.includes(actor.role)) {
    throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์เข้าหน้านี้");
  }
  return actor;
}

export function jsonData(data: Record<string, unknown>, status = 200): Response {
  return Response.json({ ok: true, ...data }, { status });
}

export function jsonConfirmed(data: Record<string, unknown>, status = 200): Response {
  return Response.json({ ok: true, confirmed: true, ...data }, { status });
}

export function jsonError(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json(
      {
        ok: false,
        confirmed: false,
        retryable: false,
        error: { code: "INVALID_INPUT", message: "ข้อมูลไม่ถูกต้อง" },
      },
      { status: 422 },
    );
  }
  if (isDomainError(error)) {
    return Response.json(
      {
        ok: false,
        confirmed: false,
        retryable: error.retryable,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
      { status: error.status },
    );
  }
  console.error(error);
  return Response.json(
    {
      ok: false,
      confirmed: false,
      retryable: true,
      error: { code: "NOT_CONFIRMED", message: "ระบบขัดข้อง ยังไม่ได้ยืนยันการบันทึก" },
    },
    { status: 500 },
  );
}

export function publicActor(actor: Actor) {
  return {
    userId: actor.userId,
    role: actor.role,
    name: actor.name,
    phone: actor.phone,
  };
}
