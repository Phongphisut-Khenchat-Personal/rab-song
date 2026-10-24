import { describe, expect, it } from "vitest";
import { closeBlockers } from "@/lib/close-blockers";

describe("close blockers", () => {
  it("lists the unfinished child and the empty-van check", () => {
    const steps = closeBlockers({
      period: "MORNING",
      schoolDone: true,
      preTrip: true,
      sweep: false,
      students: [
        { nickname: "น้องหนึ่ง", status: "WAITING", disposition: "UNKNOWN" },
        { nickname: "น้องสอง", status: "BOARDED", disposition: "BOARDED" },
        { nickname: "น้องสาม", status: "ALIGHTED", disposition: "DROPPED_OFF" },
      ],
    });
    expect(steps.some((step) => step.includes("น้องหนึ่ง") && step.includes("ยังไม่ทราบสถานะ"))).toBe(true);
    expect(steps.some((step) => step.includes("น้องสอง") && step.includes("ยังอยู่บนรถ"))).toBe(true);
    expect(steps.some((step) => step.includes("น้องสาม"))).toBe(false);
    expect(steps.some((step) => step.includes("ประตูหลัง"))).toBe(true);
  });

  it("allows close when every child is resolved and both checks passed", () => {
    expect(closeBlockers({
      period: "EVENING",
      schoolDone: true,
      preTrip: true,
      sweep: true,
      students: [{ nickname: "น้องหนึ่ง", status: "ALIGHTED", disposition: "HANDED_TO_AUTHORIZED_PERSON" }],
    })).toEqual([]);
  });
});
