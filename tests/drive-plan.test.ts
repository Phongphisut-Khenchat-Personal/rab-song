import { describe, expect, it } from "vitest";
import { buildDrivePlan, nextLegIndex, type PlanStudent } from "@/lib/drive-plan";

const students: PlanStudent[] = [
  { id: "a", nickname: "หนึ่ง", status: "BOARDED", sequence: 1, stopName: "ซอย 1", address: "ซอย 1", latitude: 13.73, longitude: 100.54 },
  { id: "b", nickname: "สอง", status: "WAITING", sequence: 1, stopName: "ซอย 1", address: "ซอย 1", latitude: 13.73, longitude: 100.54 },
  { id: "c", nickname: "สาม", status: "WAITING", sequence: 2, stopName: "ซอย 2", address: "ซอย 2", latitude: 13.72, longitude: 100.55 },
];

describe("drive plan", () => {
  it("sends the driver to the earliest stop that still has someone waiting", () => {
    const plan = buildDrivePlan({
      period: "MORNING",
      arrivedSchool: false,
      schoolName: "โรงเรียน",
      schoolLatitude: 13.7,
      schoolLongitude: 100.5,
      students,
    });
    expect(plan.next.title).toBe("ซอย 1");
    expect(plan.next.studentIds).toEqual(["b"]);
    expect(plan.next.detail).toBe("สอง");
    expect(plan.points.find((point) => point.kind === "next")?.label).toBe("1");
    expect(nextLegIndex(plan.points)).toBeNull();
  });

  it("moves to school after every morning pickup is resolved", () => {
    const plan = buildDrivePlan({
      period: "MORNING",
      arrivedSchool: false,
      schoolName: "โรงเรียน",
      schoolLatitude: 13.7,
      schoolLongitude: 100.5,
      students: students.map((student) => ({ ...student, status: "BOARDED" })),
    });
    expect(plan.next.kind).toBe("school");
    expect(plan.next.studentIds).toEqual([]);
    expect(nextLegIndex(plan.points)).toBeGreaterThanOrEqual(0);
  });

  it("drops off the earliest child still on the evening van", () => {
    const plan = buildDrivePlan({
      period: "EVENING",
      arrivedSchool: true,
      schoolName: "โรงเรียน",
      schoolLatitude: 13.7,
      schoolLongitude: 100.5,
      students: [
        { ...students[2], status: "BOARDED" },
        { ...students[0], status: "BOARDED" },
      ],
    });
    expect(plan.next.title).toBe("ซอย 1");
    expect(plan.next.studentIds).toEqual(["a"]);
  });

  it("starts the evening round at school while children are still waiting", () => {
    const plan = buildDrivePlan({
      period: "EVENING",
      arrivedSchool: false,
      schoolName: "โรงเรียน",
      schoolLatitude: 13.7,
      schoolLongitude: 100.5,
      students: students.map((student) => ({ ...student, status: "WAITING" })),
    });
    expect(plan.next.kind).toBe("school");
    expect(plan.next.studentIds).toHaveLength(3);
    expect(plan.next.studentIds).toEqual(expect.arrayContaining(["a", "b", "c"]));
  });
});
