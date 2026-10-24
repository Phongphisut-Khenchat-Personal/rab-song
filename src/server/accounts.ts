import { prisma } from "@/lib/db";
import { isThaiMobile, normalizePhone } from "@/lib/phone";
import { writeAudit } from "@/server/audit";
import { createUserAccount, type Actor } from "@/server/auth";
import { DomainError } from "@/server/errors";

export async function createPortalAccount(
  actor: Actor,
  input: { role: "DRIVER" | "GUARDIAN"; name: string; phone: string; password: string; studentId?: string; relationship?: string },
) {
  if (actor.role !== "OWNER") throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  if (input.password.length < 8) throw new DomainError(422, "WEAK_PASSWORD", "รหัสผ่านต้องมีอย่างน้อย 8 ตัว");
  const phone = normalizePhone(input.phone);
  if (!isThaiMobile(phone)) throw new DomainError(422, "INVALID_PHONE", "เบอร์โทรต้องมี 10 หลักขึ้นต้นด้วย 0");
  const account = await createUserAccount({ phone, name: input.name, password: input.password, role: input.role });
  if (input.role === "DRIVER") {
    await prisma.driver.create({ data: { userId: account.id } });
  } else {
    const guardian = await prisma.guardian.create({ data: { userId: account.id } });
    if (input.studentId) {
      const student = await prisma.student.findUnique({ where: { id: input.studentId } });
      if (!student) throw new DomainError(404, "NOT_FOUND", "ไม่พบนักเรียน");
      await prisma.studentGuardian.create({
        data: { studentId: input.studentId, guardianId: guardian.id, relationship: input.relationship?.trim() || "ผู้ปกครอง", isPrimary: true },
      });
    }
  }
  await prisma.$transaction((tx) =>
    writeAudit(tx, {
      actorUserId: actor.userId,
      action: "ACCOUNT_CREATED",
      entityType: "User",
      entityId: account.id,
      next: { role: input.role, phone },
    }),
  );
  return { id: account.id, role: input.role };
}

export async function addAuthorizedReceiver(
  actor: Actor,
  studentId: string,
  input: { name: string; relationship: string; phone?: string },
) {
  if (actor.role !== "OWNER") throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new DomainError(404, "NOT_FOUND", "ไม่พบนักเรียน");
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (phone && !isThaiMobile(phone)) throw new DomainError(422, "INVALID_PHONE", "เบอร์โทรต้องมี 10 หลักขึ้นต้นด้วย 0");
  const person = await prisma.authorizedPickupPerson.create({
    data: { studentId, name: input.name.trim(), relationship: input.relationship.trim(), phone },
  });
  await prisma.$transaction((tx) =>
    writeAudit(tx, {
      actorUserId: actor.userId,
      action: "RECEIVER_ADDED",
      entityType: "AuthorizedPickupPerson",
      entityId: person.id,
      next: { studentId, name: person.name },
    }),
  );
  return { id: person.id };
}
