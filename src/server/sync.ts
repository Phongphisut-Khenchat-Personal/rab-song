import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Actor } from "@/server/auth";
import { createAbsence } from "@/server/absence";
import { recordAttendance } from "@/server/attendance";
import { DomainError, isDomainError, isUniqueViolation } from "@/server/errors";
import { absenceBody, attendanceBody } from "@/server/validators";

type OperationInput = {
  idempotencyKey: string;
  operationType: "ATTENDANCE" | "ABSENCE";
  clientCreatedAt?: string;
  payload: Record<string, unknown>;
};

export async function applySyncBatch(actor: Actor, operations: OperationInput[]) {
  if (operations.length > 20) throw new DomainError(422, "BATCH_TOO_LARGE", "ส่งได้ไม่เกิน 20 รายการต่อครั้ง");
  const results = [];
  for (const operation of operations) {
    results.push(await applyOne(actor, operation));
  }
  return results;
}

async function applyOne(actor: Actor, operation: OperationInput) {
  const stored = await prisma.syncInbox.findUnique({ where: { idempotencyKey: operation.idempotencyKey } });
  if (stored) return storedResult(stored);

  try {
    const result =
      operation.operationType === "ATTENDANCE"
        ? await recordAttendance(attendanceFrom(actor, operation))
        : await createAbsence(actor, absenceFrom(operation));
    await remember(actor, operation, "APPLIED", result, null);
    return {
      idempotencyKey: operation.idempotencyKey,
      ok: true as const,
      confirmed: true as const,
      replayed: false,
      result,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await prisma.syncInbox.findUnique({ where: { idempotencyKey: operation.idempotencyKey } });
      if (raced) return storedResult(raced);
    }
    if (isDomainError(error) && !error.retryable) {
      await remember(actor, operation, "REJECTED", { message: error.message }, error.code);
      return {
        idempotencyKey: operation.idempotencyKey,
        ok: false as const,
        confirmed: false as const,
        replayed: false,
        retryable: false,
        error: { code: error.code, message: error.message },
      };
    }
    return {
      idempotencyKey: operation.idempotencyKey,
      ok: false as const,
      confirmed: false as const,
      replayed: false,
      retryable: true,
      error: { code: "NOT_CONFIRMED", message: "ยังซิงก์ไม่สำเร็จ" },
    };
  }
}

function attendanceFrom(actor: Actor, operation: OperationInput) {
  const parsed = attendanceBody.parse({ ...operation.payload, idempotencyKey: operation.idempotencyKey });
  if (parsed.idempotencyKey !== operation.idempotencyKey) {
    throw new DomainError(422, "KEY_MISMATCH", "คีย์ไม่ตรงกัน");
  }
  return { actor, ...parsed, clientRecordedAt: parsed.clientRecordedAt ?? operation.clientCreatedAt };
}

function absenceFrom(operation: OperationInput) {
  return absenceBody.parse({ ...operation.payload, idempotencyKey: operation.idempotencyKey });
}

async function remember(
  actor: Actor,
  operation: OperationInput,
  status: "APPLIED" | "REJECTED",
  result: unknown,
  errorCode: string | null,
) {
  try {
    await prisma.syncInbox.create({
      data: {
        userId: actor.userId,
        idempotencyKey: operation.idempotencyKey,
        operationType: operation.operationType,
        payload: operation.payload as Prisma.InputJsonValue,
        status,
        result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
        errorCode,
        clientCreatedAt: operation.clientCreatedAt ? new Date(operation.clientCreatedAt) : null,
        appliedAt: status === "APPLIED" ? new Date() : null,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
}

function storedResult(stored: {
  idempotencyKey: string;
  status: "APPLIED" | "REJECTED";
  result: Prisma.JsonValue;
  errorCode: string | null;
}) {
  const applied = stored.status === "APPLIED";
  return {
    idempotencyKey: stored.idempotencyKey,
    ok: applied,
    confirmed: applied,
    replayed: true,
    result: stored.result,
    ...(applied
      ? {}
      : { retryable: false, error: { code: stored.errorCode ?? "REJECTED", message: "รายการนี้ถูกปฏิเสธไปแล้ว" } }),
  };
}
