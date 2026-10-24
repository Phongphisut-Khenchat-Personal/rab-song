import { describe, expect, it } from "vitest";
import { childStepIndex, runStepIndex } from "@/lib/trip-steps";

describe("trip steps", () => {
  it("moves a morning run from waiting to finished", () => {
    expect(runStepIndex({ status: "PLANNED", arrivedSchool: false, leftSchool: false, boarded: 0 })).toBe(0);
    expect(runStepIndex({ status: "IN_PROGRESS", arrivedSchool: false, leftSchool: false, boarded: 1 })).toBe(1);
    expect(runStepIndex({ status: "IN_PROGRESS", arrivedSchool: true, leftSchool: false, boarded: 2 })).toBe(2);
    expect(runStepIndex({ status: "COMPLETED", arrivedSchool: true, leftSchool: false, boarded: 2 })).toBe(3);
  });

  it("shows an evening drop-off as the last step and an absence as not travelling", () => {
    expect(childStepIndex("EVENING", "ALIGHTED")).toBe(3);
    expect(childStepIndex("MORNING", "ALIGHTED")).toBe(2);
    expect(childStepIndex("MORNING", "EXCUSED")).toBe(-1);
  });
});
