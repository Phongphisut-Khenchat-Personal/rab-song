import { flushQueue, type QueueItem, type QueueStore } from "@/lib/queue";
import type { MutationReceipt } from "@/lib/confirmation";

const DB_NAME = "rabsong";
const STORE = "queue";
const KEY = "items";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const browserQueue: QueueStore = {
  async list() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve((request.result as QueueItem[] | undefined) ?? []);
      request.onerror = () => reject(request.error);
    });
  },
  async save(items) {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(items, KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
};

export function forcedOffline(): boolean {
  return typeof localStorage !== "undefined" && localStorage.getItem("rabsong-force-offline") === "1";
}

export async function flushBrowserQueue(): Promise<QueueItem[]> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return browserQueue.list();
  if (forcedOffline()) return browserQueue.list();
  return flushQueue(browserQueue, async (item) => {
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        operations: [
          {
            idempotencyKey: item.idempotencyKey,
            operationType: item.operationType,
            clientCreatedAt: item.clientCreatedAt,
            payload: item.payload,
          },
        ],
      }),
    });
    if (response.status >= 500) return { ok: false, confirmed: false, retryable: true };
    const body = (await response.json()) as { operations?: MutationReceipt[] };
    return body.operations?.[0] ?? { ok: false, confirmed: false, retryable: true };
  });
}
