import type { Prisma } from "@prisma/client";
import { externalNotice, pushProvider, smsProvider, type OutboundResult } from "@/server/outbound";

export type NotificationReceipt = {
  inApp: "recorded" | "not_applicable";
  push: "not_configured" | "sent" | "failed";
  sms: "not_configured" | "sent" | "failed";
};

function wireStatus(result: OutboundResult): "not_configured" | "sent" | "failed" {
  if (result.status === "SENT") return "sent";
  if (result.status === "FAILED") return "failed";
  return "not_configured";
}

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
    return { inApp: "not_applicable", push: "not_configured", sms: "not_configured" };
  }
  if (input.sourceEventId) {
    const existing = await tx.notification.count({
      where: { sourceEventId: input.sourceEventId, recipientUserId: { in: recipients } },
    });
    if (existing >= recipients.length) {
      return { inApp: "recorded", push: "not_configured", sms: "not_configured" };
    }
  }
  const notice = externalNotice();
  const [push, sms] = await Promise.all([
    pushProvider().send({ ...notice, recipientUserId: recipients[0] }),
    smsProvider().send({ ...notice, recipientUserId: recipients[0] }),
  ]);
  const pushDelivery = push.status;
  const deliveredAt = pushDelivery === "SENT" ? new Date() : null;
  await tx.notification.createMany({
    data: recipients.map((recipientUserId) => ({
      recipientUserId,
      studentId: input.studentId,
      type: input.type,
      title: input.title,
      body: input.body,
      channel: "IN_APP" as const,
      delivery: "RECORDED" as const,
      pushDelivery,
      sourceEventId: input.sourceEventId,
      deliveredAt,
      lastError: [push.error, sms.error].filter(Boolean).join(" · ") || null,
    })),
  });
  return { inApp: "recorded", push: wireStatus(push), sms: wireStatus(sms) };
}

export async function guardianUserIds(tx: Prisma.TransactionClient, studentId: string): Promise<string[]> {
  const links = await tx.studentGuardian.findMany({
    where: { studentId },
    include: { guardian: true },
  });
  return links.map((link) => link.guardian.userId);
}
