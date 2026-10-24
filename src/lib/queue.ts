import type { MutationReceipt } from "@/lib/confirmation";

export type QueueOperationType = "ATTENDANCE" | "ABSENCE";
export type SyncStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED";

export type QueueItem = {
  idempotencyKey: string;
  operationType: QueueOperationType;
  url: string;
  payload: Record<string, unknown>;
  state: "queued" | "confirmed" | "rejected";
  syncStatus: SyncStatus;
  confirmed: boolean;
  error?: string;
  clientCreatedAt: string;
};

export type QueueStore = {
  list: () => Promise<QueueItem[]>;
  save: (items: QueueItem[]) => Promise<void>;
};

export function enqueue(items: QueueItem[], item: Omit<QueueItem, "state" | "confirmed" | "syncStatus"> & Partial<Pick<QueueItem, "state" | "confirmed" | "syncStatus">>): QueueItem[] {
  if (items.some((existing) => existing.idempotencyKey === item.idempotencyKey)) return items;
  return [
    ...items,
    {
      ...item,
      state: "queued",
      syncStatus: "PENDING",
      confirmed: false,
    },
  ];
}

export function applyReceipt(item: QueueItem, receipt: MutationReceipt | null | undefined): QueueItem {
  if (receipt?.ok === true && receipt.confirmed === true) {
    return { ...item, state: "confirmed", syncStatus: "SYNCED", confirmed: true, error: undefined };
  }
  if (receipt?.retryable) {
    return { ...item, state: "queued", syncStatus: "PENDING", confirmed: false };
  }
  return {
    ...item,
    state: "rejected",
    syncStatus: "FAILED",
    confirmed: false,
    error: receipt?.error?.message || receipt?.message || "ซิงก์ไม่สำเร็จ",
  };
}

export async function flushQueue(store: QueueStore, send: (item: QueueItem) => Promise<MutationReceipt>): Promise<QueueItem[]> {
  const items = await store.list();
  const next: QueueItem[] = [];
  for (const item of items) {
    if (item.confirmed || item.state === "rejected") {
      next.push(item);
      continue;
    }
    const syncing = { ...item, state: "queued" as const, syncStatus: "SYNCING" as const, confirmed: false };
    await store.save([...next, syncing, ...items.slice(items.indexOf(item) + 1)]);
    try {
      const receipt = await send(syncing);
      next.push(applyReceipt(syncing, receipt));
    } catch {
      next.push({ ...syncing, state: "queued", syncStatus: "PENDING", confirmed: false });
    }
  }
  await store.save(next);
  return next;
}
