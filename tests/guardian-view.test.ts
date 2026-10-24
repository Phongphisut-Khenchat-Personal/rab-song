import { describe, expect, it } from "vitest";
import { approximateArrival, guardianMoment } from "@/lib/guardian-view";

describe("guardian moment", () => {
  it("shows only the current fact and a headcount after the child is picked up", () => {
    const view = guardianMoment({
      period: "MORNING",
      status: "BOARDED",
      runStatus: "IN_PROGRESS",
      othersRemaining: 3,
      plannedStart: "06:20",
      durationSeconds: 45 * 60,
    });
    expect(view.headline).toBe("ขึ้นรถแล้ว");
    expect(view.note).toBe("อีก 3 คนก่อนถึงโรงเรียน · คาดว่าถึงประมาณ 07:05 ไม่รับประกันเวลา");
    expect(view.note).not.toMatch(/ถึงโรงเรียนแล้ว|ปิดรอบ/);
  });

  it("does not invent an arrival time when the route was not calculated", () => {
    expect(approximateArrival("06:20", null)).toBeNull();
    const view = guardianMoment({
      period: "MORNING",
      status: "BOARDED",
      runStatus: "IN_PROGRESS",
      othersRemaining: 2,
      plannedStart: "06:20",
      durationSeconds: null,
    });
    expect(view.note).toBe("อีก 2 คนก่อนถึงโรงเรียน");
  });

  it("hides the evening round until it has started", () => {
    expect(guardianMoment({
      period: "EVENING",
      status: "WAITING",
      runStatus: "PLANNED",
      othersRemaining: 4,
      plannedStart: "15:40",
      durationSeconds: 3600,
    })).toEqual({ headline: "รอบเย็นยังไม่เริ่ม", note: null });
  });
});
