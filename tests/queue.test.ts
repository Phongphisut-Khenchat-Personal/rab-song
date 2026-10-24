import { describe, expect, it } from "vitest";
import { canShowConfirmed } from "@/lib/confirmation";
import { applyReceipt, enqueue, flushQueue, type QueueItem, type QueueStore } from "@/lib/queue";

function item(key = "11111111-1111-4111-8111-111111111111"): QueueItem {
  return {
    idempotencyKey: key,
    operationType: "ATTENDANCE",
    url: "/api/sync",
    payload: { studentId: "s" },
    syncStatus: "PENDING",
    confirmed: false,
    clientCreatedAt: "2026-10-24T01:00:00.000Z",
  };
}

function memoryStore(initial: QueueItem[] = []): QueueStore & { items: QueueItem[] } {
  const box = { items: initial };
  return {
    get items() {
      return box.items;
    },
    async list() {
      return box.items;
    },
    async save(items) {
      box.items = items;
    },
  };
}

describe("offline queue", () => {
  it("does not show success before a confirmed receipt", () => {
    expect(canShowConfirmed(null)).toBe(false);
    expect(canShowConfirmed({ ok: true })).toBe(false);
    expect(canShowConfirmed({ ok: true, confirmed: false })).toBe(false);
    expect(canShowConfirmed({ ok: false, confirmed: true })).toBe(false);
    expect(canShowConfirmed({ ok: true, confirmed: true })).toBe(true);
  });

  it("keeps one queued item per idempotency key", () => {
    const once = enqueue([], item());
    expect(enqueue(once, item())).toHaveLength(1);
  });

  it("does not mark a retry or a rejection as confirmed", () => {
    const queued = item();
    expect(applyReceipt(queued, { ok: true, retryable: true }).confirmed).toBe(false);
    expect(applyReceipt(queued, { ok: false, error: { message: "ซ้ำ" } }).syncStatus).toBe("FAILED");
    expect(applyReceipt(queued, { ok: true, confirmed: true }).syncStatus).toBe("SYNCED");
  });

  it("leaves the item queued when the network request throws", async () => {
    const store = memoryStore([item()]);
    const result = await flushQueue(store, async () => {
      throw new Error("offline");
    });
    expect(result[0].confirmed).toBe(false);
    expect(result[0].state).toBe("queued");
    expect(result[0].syncStatus).toBe("PENDING");
  });

  it("confirms only after the sender returns a confirmed receipt", async () => {
    const store = memoryStore([item()]);
    const result = await flushQueue(store, async () => ({ ok: true, confirmed: true }));
    expect(result[0].confirmed).toBe(true);
    const again = await flushQueue(store, async () => {
      throw new Error("should not send a confirmed item");
    });
    expect(again[0].confirmed).toBe(true);
  });

  it("shows SYNCING before the server answers and SYNCED only after confirmation", async () => {
    const store = memoryStore([item()]);
    let during = "";
    const result = await flushQueue(store, async () => {
      during = store.items[0].syncStatus;
      return { ok: true, confirmed: true };
    });
    expect(during).toBe("SYNCING");
    expect(during).not.toBe("SYNCED");
    expect(result[0].syncStatus).toBe("SYNCED");
    expect(result[0].confirmed).toBe(true);
  });
});
