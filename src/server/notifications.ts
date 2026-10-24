import type { Prisma } from "@prisma/client";

export type NotificationReceipt = {
  inApp: "recorded" | "not_applicable";
  push: "not_configured";
};

export async function notifyUsers(
  tx: Prisma.TransactionClient,
  input: {
    userIds: string[];
    studentId?: string;
    type: string;
    title: string;
    body: string;
    sourceEventId?: string;
  },
): Promise<NotificationReceipt> {
  const recipients = [...new Set(input.userIds)].filter(Boolean);
  if (recipients.length === 0) {
    return { inApp: "not_applicable", push: "not_configured" };
  }
  const deliveredAt = new Date();
  await tx.notification.createMany({
    data: recipients.map((recipientUserId) => ({
      recipientUserId,
      studentId: input.studentId,
      type: input.type,
      title: input.title,
      body: input.body,
      channel: "IN_APP" as const,
      delivery: "RECORDED" as const,
      pushDelivery: "NOT_CONFIGURED" as const,
      sourceEventId: input.sourceEventId,
      deliveredAt,
    })),
  });
  return { inApp: "recorded", push: "not_configured" };
}

export async function guardianUserIds(tx: Prisma.TransactionClient, studentId: string): Promise<string[]> {
  const links = await tx.studentGuardian.findMany({
    where: { studentId },
    include: { guardian: true },
  });
  return links.map((link) => link.guardian.userId);
}
