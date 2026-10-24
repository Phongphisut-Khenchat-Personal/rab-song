import { Prisma } from "@prisma/client";

function asJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeAudit(
  tx: Prisma.TransactionClient,
  input: {
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    previous?: unknown;
    next?: unknown;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? undefined,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      previousJson: asJson(input.previous),
      nextJson: asJson(input.next),
    },
  });
}
