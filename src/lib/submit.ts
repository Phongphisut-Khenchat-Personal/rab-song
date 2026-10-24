import { canShowConfirmed, confirmedMessage, type MutationReceipt } from "@/lib/confirmation";
import { enqueue, type QueueOperationType } from "@/lib/queue";
import { browserQueue, forcedOffline } from "@/lib/browser-queue";

export type SubmitOutcome = {
  kind: "confirmed" | "queued" | "rejected" | "unknown";
  message: string;
  body?: MutationReceipt;
};

export async function submitOrQueue(input: {
  url: string;
  operationType: QueueOperationType;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}): Promise<SubmitOutcome> {
  const queuedItem = {
    idempotencyKey: input.idempotencyKey,
    operationType: input.operationType,
    url: input.url,
    payload: input.payload,
    clientCreatedAt: new Date().toISOString(),
  };
  const offline = forcedOffline() || (typeof navigator !== "undefined" && !navigator.onLine);
  if (offline) {
    const items = await browserQueue.list();
    await browserQueue.save(enqueue(items, queuedItem));
    return { kind: "queued", message: "อยู่ในคิวบนเครื่องนี้ ยังไม่ได้บันทึกบนเซิร์ฟเวอร์" };
  }
  try {
    const response = await fetch(input.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input.payload),
    });
    const body = (await response.json().catch(() => null)) as MutationReceipt | null;
    if (canShowConfirmed(body)) return { kind: "confirmed", message: confirmedMessage(body ?? {}), body: body ?? undefined };
    if (!body || body.retryable || response.status >= 500) {
      return { kind: "unknown", message: "ยังไม่แน่ใจว่าบันทึกแล้ว กดอีกครั้งได้โดยไม่สร้างรายการซ้ำ", body: body ?? undefined };
    }
    return { kind: "rejected", message: body.error?.message ?? "บันทึกไม่สำเร็จ", body };
  } catch {
    try {
      const items = await browserQueue.list();
      await browserQueue.save(enqueue(items, queuedItem));
      return { kind: "queued", message: "ส่งไม่ถึงเซิร์ฟเวอร์ เก็บในคิวแล้ว ยังไม่ได้ยืนยัน" };
    } catch {
      return { kind: "unknown", message: "ส่งไม่สำเร็จและเก็บคิวไม่ได้ ยังไม่ได้ยืนยันการบันทึก" };
    }
  }
}
