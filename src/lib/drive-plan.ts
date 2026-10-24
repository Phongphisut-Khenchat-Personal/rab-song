export type PlanStudent = {
  id: string;
  nickname: string;
  status: string;
  sequence: number;
  stopName: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

export type MapPoint = {
  key: string;
  label: string;
  latitude: number;
  longitude: number;
  kind: "next" | "stop" | "school";
};

export function nextLegIndex(points: MapPoint[]): number | null {
  const index = points.findIndex((point) => point.kind === "next");
  return index > 0 ? index - 1 : null;
}

export type DrivePlan = {
  points: MapPoint[];
  next: {
    kind: "stop" | "school" | "done";
    title: string;
    detail: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    studentIds: string[];
  };
};

export function buildDrivePlan(input: {
  period: "MORNING" | "EVENING";
  arrivedSchool: boolean;
  schoolName: string;
  schoolLatitude: number | null;
  schoolLongitude: number | null;
  students: PlanStudent[];
}): DrivePlan {
  const ordered = [...input.students].sort((a, b) => a.sequence - b.sequence || a.nickname.localeCompare(b.nickname, "th"));
  const waiting = ordered.filter((student) => student.status === "WAITING");
  const boarded = ordered.filter((student) => student.status === "BOARDED");
  const firstDropoff = boarded[0];
  const dropoffGroup = firstDropoff
    ? boarded.filter((student) => student.sequence === firstDropoff.sequence && student.stopName === firstDropoff.stopName)
    : [];
  const pickup = waiting[0];
  const pickupGroup = pickup
    ? waiting.filter((student) => student.sequence === pickup.sequence && student.stopName === pickup.stopName)
    : [];

  const next = input.period === "EVENING" && waiting.length > 0
    ? {
        kind: "school" as const,
        title: input.schoolName,
        detail: waiting.map((student) => student.nickname).join(" · "),
        address: input.schoolName,
        latitude: input.schoolLatitude,
        longitude: input.schoolLongitude,
        studentIds: waiting.map((student) => student.id),
      }
    : input.period === "MORNING" && pickup
      ? {
          kind: "stop" as const,
          title: pickup.stopName,
          detail: pickupGroup.map((student) => student.nickname).join(" · "),
          address: pickup.address,
          latitude: pickup.latitude,
          longitude: pickup.longitude,
          studentIds: pickupGroup.map((student) => student.id),
        }
      : input.period === "EVENING" && dropoffGroup.length > 0
        ? {
            kind: "stop" as const,
            title: firstDropoff?.stopName ?? "จุดถัดไป",
            detail: dropoffGroup.map((student) => student.nickname).join(" · "),
            address: firstDropoff?.address ?? "",
            latitude: firstDropoff?.latitude ?? null,
            longitude: firstDropoff?.longitude ?? null,
            studentIds: dropoffGroup.map((student) => student.id),
          }
        : input.period === "MORNING" && !input.arrivedSchool
          ? {
              kind: "school" as const,
              title: input.schoolName,
              detail: "รับครบแล้ว ต่อไปคือโรงเรียน",
              address: input.schoolName,
              latitude: input.schoolLatitude,
              longitude: input.schoolLongitude,
              studentIds: [],
            }
          : {
              kind: "done" as const,
              title: "จุดที่ต้องแวะครบแล้ว",
              detail: "ตรวจรถและปิดรอบได้เมื่อรายการด้านล่างผ่าน",
              address: "",
              latitude: null,
              longitude: null,
              studentIds: [],
            };

  const highlight = next.kind === "stop" ? next.title : null;

  const points: MapPoint[] = [];
  const seen = new Set<string>();
  for (const student of ordered) {
    if (student.latitude == null || student.longitude == null) continue;
    const key = `${student.sequence}:${student.latitude.toFixed(5)}:${student.longitude.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const isNext = highlight != null && student.stopName === highlight && student.latitude === next.latitude && student.longitude === next.longitude;
    points.push({
      key,
      label: String(points.length + 1),
      latitude: student.latitude,
      longitude: student.longitude,
      kind: isNext ? "next" : "stop",
    });
  }
  if (input.schoolLatitude != null && input.schoolLongitude != null) {
    const key = `school:${input.schoolLatitude.toFixed(5)}:${input.schoolLongitude.toFixed(5)}`;
    const existing = points.find((point) => point.key.endsWith(`${input.schoolLatitude?.toFixed(5)}:${input.schoolLongitude?.toFixed(5)}`));
    if (existing) {
      if (next.kind === "school") existing.kind = "next";
      if (input.period === "EVENING") {
        const index = points.indexOf(existing);
        if (index > 0) points.unshift(points.splice(index, 1)[0]);
      }
    } else {
      const schoolPoint: MapPoint = {
        key,
        label: "ร",
        latitude: input.schoolLatitude,
        longitude: input.schoolLongitude,
        kind: next.kind === "school" ? "next" : "school",
      };
      if (input.period === "EVENING") points.unshift(schoolPoint);
      else points.push(schoolPoint);
    }
  }
  points.forEach((point, index) => {
    point.label = String(index + 1);
  });
  return { points, next };
}
