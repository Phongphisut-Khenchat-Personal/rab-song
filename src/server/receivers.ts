import type { Prisma } from "@prisma/client";
import { DomainError } from "@/server/errors";

export function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("th");
}

export async function assertAuthorizedReceiver(
  tx: Prisma.TransactionClient,
  studentId: string,
  name: string,
): Promise<string> {
  const people = await tx.authorizedPickupPerson.findMany({ where: { studentId, active: true } });
  if (people.length === 0) {
    throw new DomainError(
      422,
      "AUTHORIZED_RECEIVER_REQUIRED",
      "ยังไม่มีรายชื่อผู้มีสิทธิ์รับเด็ก ระบบจะไม่ปล่อยเด็กให้คนที่ไม่ได้ลงทะเบียน",
    );
  }
  const match = people.find((person) => normalizePersonName(person.name) === normalizePersonName(name));
  if (!match) {
    throw new DomainError(422, "UNAUTHORIZED_RECEIVER", "ชื่อนี้ไม่อยู่ในรายชื่อผู้มีสิทธิ์รับเด็ก");
  }
  return match.name;
}
