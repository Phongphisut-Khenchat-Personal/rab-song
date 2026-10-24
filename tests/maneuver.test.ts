import { describe, expect, it } from "vitest";
import { approximateDistance, maneuverText } from "@/lib/maneuver";

describe("maneuver text", () => {
  it("names the turn and the road without adding a travel time", () => {
    expect(maneuverText("turn", "left", "ถนนวิทยุ")).toBe("เลี้ยวซ้าย ถนนวิทยุ");
    expect(maneuverText("depart", "straight", "")).toBe("ออกเดินทาง");
    expect(maneuverText("arrive", undefined, "โรงเรียน")).toBe("ถึงจุดหมาย");
    expect(approximateDistance(420)).toBe("ประมาณ 420 เมตร");
    expect(approximateDistance(0)).toBe("");
  });
});
