import { prisma } from "@/lib/db";
import { bahtToSatang, formatBaht } from "@/lib/money";
import { studentDisplayName } from "@/lib/labels";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/auth";
import { DomainError, isUniqueViolation } from "@/server/errors";

function ownerOnly(actor: Actor): void {
  if (actor.role !== "OWNER") throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
}

export async function createInvoice(actor: Actor, input: { studentId: string; yearMonth: string; amountBaht: string }) {
  ownerOnly(actor);
  const amountSatang = bahtToSatang(input.amountBaht);
  if (!amountSatang) throw new DomainError(422, "INVALID_AMOUNT", "จำนวนเงินไม่ถูกต้อง");
  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: { studentId: input.studentId, yearMonth: input.yearMonth, amountSatang },
      });
      await writeAudit(tx, {
        actorUserId: actor.userId,
        action: "INVOICE_CREATED",
        entityType: "Invoice",
        entityId: created.id,
        next: { studentId: input.studentId, yearMonth: input.yearMonth, amountSatang },
      });
      return created;
    });
    return { id: invoice.id, confirmed: true as const };
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError(409, "DUPLICATE_INVOICE", "มีค่าโดยสารเดือนนี้แล้ว");
    throw error;
  }
}

export async function recordPayment(
  actor: Actor,
  input: { invoiceId: string; amountBaht: string; method: "CASH" | "TRANSFER" | "OTHER"; note?: string; idempotencyKey: string },
) {
  ownerOnly(actor);
  const amountSatang = bahtToSatang(input.amountBaht);
  if (!amountSatang) throw new DomainError(422, "INVALID_AMOUNT", "จำนวนเงินไม่ถูกต้อง");
  const existing = await prisma.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.invoiceId !== input.invoiceId || existing.amountSatang !== amountSatang) {
      throw new DomainError(409, "IDEMPOTENCY_CONFLICT", "คีย์นี้ถูกใช้กับรายการคนละอย่าง");
    }
    return { ok: true as const, confirmed: true as const, replayed: true, id: existing.id };
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId }, include: { payments: true } });
      if (!invoice || invoice.status === "WAIVED") throw new DomainError(404, "NOT_FOUND", "ไม่พบยอดค่าโดยสาร");
      const paid = invoice.payments.reduce((sum, payment) => sum + payment.amountSatang, 0);
      const remaining = invoice.amountSatang - paid;
      if (amountSatang > remaining) throw new DomainError(422, "OVERPAY", "รับเงินเกินยอดคงเหลือไม่ได้");
      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          amountSatang,
          method: input.method,
          paidAt: new Date(),
          recordedByUserId: actor.userId,
          note: input.note?.trim() || null,
          idempotencyKey: input.idempotencyKey,
        },
      });
      const status = amountSatang === remaining ? "PAID" : "PARTIAL";
      await tx.invoice.update({ where: { id: invoice.id }, data: { status } });
      await writeAudit(tx, {
        actorUserId: actor.userId,
        action: "PAYMENT_RECORDED",
        entityType: "Invoice",
        entityId: invoice.id,
        previous: { status: invoice.status, paidSatang: paid },
        next: { status, paymentId: payment.id, amountSatang },
      });
      return { ok: true as const, confirmed: true as const, replayed: false, id: payment.id, status };
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await prisma.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (!raced) throw error;
    return { ok: true as const, confirmed: true as const, replayed: true, id: raced.id };
  }
}

export async function listInvoices(actor: Actor) {
  const studentFilter =
    actor.role === "OWNER"
      ? {}
      : actor.role === "GUARDIAN" && actor.guardianId
        ? { student: { guardians: { some: { guardianId: actor.guardianId } } } }
        : null;
  if (!studentFilter) throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  const invoices = await prisma.invoice.findMany({
    where: studentFilter,
    include: { student: true, payments: true },
    orderBy: [{ yearMonth: "desc" }, { student: { nickname: "asc" } }],
  });
  return invoices.map((invoice) => {
    const paidSatang = invoice.payments.reduce((sum, payment) => sum + payment.amountSatang, 0);
    return {
      id: invoice.id,
      studentId: invoice.studentId,
      studentName: studentDisplayName(invoice.student),
      yearMonth: invoice.yearMonth,
      amountSatang: invoice.amountSatang,
      paidSatang,
      remainingSatang: invoice.amountSatang - paidSatang,
      amountLabel: formatBaht(invoice.amountSatang),
      remainingLabel: formatBaht(invoice.amountSatang - paidSatang),
      status: invoice.status,
    };
  });
}
