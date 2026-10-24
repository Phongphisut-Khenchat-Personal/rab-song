import { describe, expect, it } from "vitest";
import { canShowConfirmed } from "@/lib/confirmation";
import { applyReceipt, enqueue, flushQueue, type QueueItem, type QueueStore } from "@/lib/queue";

function item(key = "11111111-1111-4111-8111-111111111111"): QueueItem {
  return {
    idempotencyKey: key,
    operationType: "ATTENDANCE",
    url: "/api/sync",
    payload: { studentId: "s" },
    state: "queued",
    confirmed: false,
    clientCreatedAt: "2026-10-24T01:00:00.000Z",
  };
}

function memoryStore(initial: QueueItem[] = []): QueueStore & { items: QueueItem[] } {
  const store = { items: initial };
  return {
    ...store,
    async list() {
      return store.items;
    },
    async save(items) {
      store.items = items;
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
    expect(applyReceipt(queued, { ok: false, error: { message: "ซ้ำ" } }).state).toBe("rejected");
    expect(applyReceipt(queued, { ok: true, confirmed: true }).confirmed).toBe(true);
  });

  it("leaves the item queued when the network request throws", async () => {
    const store = memoryStore([item()]);
    const result = await flushQueue(store, async () => {
      throw new Error("offline");
    });
    expect(result[0].confirmed).toBe(false);
    expect(result[0].state).toBe("queued");
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
});
