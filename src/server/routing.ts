import { maneuverText } from "@/lib/maneuver";

export type LatLng = { latitude: number; longitude: number };

export type RouteEstimate =
  | {
      ok: true;
      approximate: true;
      distanceMeters: number;
      durationSeconds: number;
      source: "osrm";
      message: string;
    }
  | { ok: false; code: "ROUTING_UNAVAILABLE"; message: string };

const UNAVAILABLE = "ยังคำนวณเวลาและระยะทางไม่ได้";

export function assessTiming(input: {
  startTime: string;
  durationSeconds: number;
  dwellSeconds: number;
  stopCount: number;
  deadline: string;
}): { arrivesBy: string; withinDeadline: boolean } {
  const start = clockMinutes(input.startTime);
  const riding = Math.ceil(input.durationSeconds / 60);
  const waiting = Math.ceil((input.dwellSeconds * Math.max(input.stopCount - 1, 0)) / 60);
  const total = start + riding + waiting;
  return { arrivesBy: formatMinutes(total), withinDeadline: total <= clockMinutes(input.deadline) };
}

export async function estimateRoute(points: LatLng[]): Promise<RouteEstimate> {
  const base = process.env.OSRM_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    return { ok: false, code: "ROUTING_UNAVAILABLE", message: `${UNAVAILABLE} เพราะยังไม่ได้ตั้งค่าเซิร์ฟเวอร์เส้นทาง` };
  }
  if (points.length < 2 || points.some((point) => !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude))) {
    return { ok: false, code: "ROUTING_UNAVAILABLE", message: `${UNAVAILABLE} เพราะพิกัดจุดไม่ครบ` };
  }
  const path = points.map((point) => `${point.longitude},${point.latitude}`).join(";");
  try {
    const response = await fetch(`${base}/route/v1/driving/${path}?overview=false`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      return { ok: false, code: "ROUTING_UNAVAILABLE", message: `${UNAVAILABLE} เพราะเซิร์ฟเวอร์เส้นทางตอบกลับไม่สำเร็จ` };
    }
    const body = (await response.json()) as { code?: string; routes?: { distance?: number; duration?: number }[] };
    const route = body.routes?.[0];
    if (body.code !== "Ok" || route?.distance === undefined || route.duration === undefined) {
      return { ok: false, code: "ROUTING_UNAVAILABLE", message: `${UNAVAILABLE} เพราะไม่มีผลลัพธ์จากเซิร์ฟเวอร์เส้นทาง` };
    }
    return {
      ok: true,
      approximate: true,
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      source: "osrm",
      message: "เวลานี้เป็นค่าประมาณจากข้อมูลถนน ไม่ได้รับประกันเวลาเดินทาง",
    };
  } catch {
    return { ok: false, code: "ROUTING_UNAVAILABLE", message: `${UNAVAILABLE} เพราะติดต่อเซิร์ฟเวอร์เส้นทางไม่ได้` };
  }
}

export async function optimizeStopOrder(points: LatLng[]): Promise<
  | { ok: false; code: "OPTIMIZER_UNAVAILABLE"; message: string }
  | { ok: true; order: number[]; approximate: true; message: string }
> {
  const base = process.env.VROOM_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    return { ok: false, code: "OPTIMIZER_UNAVAILABLE", message: "ยังไม่ได้ตั้งค่าตัวจัดลำดับจุด เจ้าของต้องจัดลำดับเองก่อนเผยแพร่" };
  }
  if (points.length < 3) {
    return { ok: false, code: "OPTIMIZER_UNAVAILABLE", message: "จุดไม่พอสำหรับจัดลำดับอัตโนมัติ" };
  }
  try {
    const response = await fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vehicles: [{
          id: 1,
          profile: "car",
          start: [points[0].longitude, points[0].latitude],
          end: [points[points.length - 1].longitude, points[points.length - 1].latitude],
        }],
        jobs: points.slice(1, -1).map((point, index) => ({ id: index + 1, location: [point.longitude, point.latitude] })),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return { ok: false, code: "OPTIMIZER_UNAVAILABLE", message: "ตัวจัดลำดับจุดตอบกลับไม่สำเร็จ ลำดับจึงไม่ถูกเปลี่ยน" };
    }
    const body = (await response.json()) as { routes?: { steps?: { type?: string; job?: number }[] }[] };
    const jobs = (body.routes?.[0]?.steps ?? []).flatMap((step) => (step.type === "job" && step.job ? [step.job] : []));
    if (jobs.length === 0) {
      return { ok: false, code: "OPTIMIZER_UNAVAILABLE", message: "ตัวจัดลำดับจุดไม่มีลำดับที่ใช้ได้ ลำดับจึงไม่ถูกเปลี่ยน" };
    }
    return {
      ok: true,
      order: [0, ...jobs, points.length - 1],
      approximate: true,
      message: "ลำดับนี้เป็นค่าแนะนำจากพิกัดเท่านั้น ต้องให้เจ้าของตรวจก่อนเผยแพร่",
    };
  } catch {
    return { ok: false, code: "OPTIMIZER_UNAVAILABLE", message: "ติดต่อตัวจัดลำดับจุดไม่ได้ ลำดับจึงไม่ถูกเปลี่ยน" };
  }
}

export type RouteStep = { instruction: string; distanceMeters: number };
export type RouteLeg = { line: [number, number][]; distanceMeters: number; steps: RouteStep[] };

export async function routeShape(points: LatLng[]): Promise<
  | { ok: true; line: [number, number][]; legs: RouteLeg[]; distanceMeters: number; durationSeconds: number; approximate: true; message: string }
  | { ok: false; message: string }
> {
  const base = routingBase();
  if (!base) return { ok: false, message: `${UNAVAILABLE} เพราะยังไม่ได้ตั้งค่าเซิร์ฟเวอร์เส้นทาง` };
  if (points.length < 2 || points.some((point) => !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude))) {
    return { ok: false, message: `${UNAVAILABLE} เพราะพิกัดจุดไม่ครบ` };
  }
  const path = points.map((point) => `${point.longitude},${point.latitude}`).join(";");
  try {
    const response = await fetch(`${base}/route/v1/driving/${path}?overview=full&geometries=geojson&steps=true`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { ok: false, message: `${UNAVAILABLE} เพราะเซิร์ฟเวอร์เส้นทางตอบกลับไม่สำเร็จ` };
    const body = (await response.json()) as {
      code?: string;
      routes?: {
        distance?: number;
        duration?: number;
        geometry?: { coordinates?: [number, number][] };
        legs?: {
          distance?: number;
          steps?: {
            distance?: number;
            name?: string;
            maneuver?: { type?: string; modifier?: string };
            geometry?: { coordinates?: [number, number][] };
          }[];
        }[];
      }[];
    };
    const route = body.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (body.code !== "Ok" || !coordinates?.length || route?.distance === undefined || route.duration === undefined) {
      return { ok: false, message: `${UNAVAILABLE} เพราะไม่มีผลลัพธ์จากเซิร์ฟเวอร์เส้นทาง` };
    }
    const legs = (route.legs ?? []).map((leg) => {
      const steps = (leg.steps ?? []).flatMap((step) => {
        const instruction = maneuverText(step.maneuver?.type, step.maneuver?.modifier, step.name);
        if (!instruction) return [];
        return [{ instruction, distanceMeters: Math.max(0, Math.round(step.distance ?? 0)) }];
      });
      const line = (leg.steps ?? []).flatMap((step) => (step.geometry?.coordinates ?? []).map(([longitude, latitude]) => [latitude, longitude] as [number, number]));
      return { line, distanceMeters: Math.max(0, Math.round(leg.distance ?? 0)), steps };
    });
    return {
      ok: true,
      line: coordinates.map(([longitude, latitude]) => [latitude, longitude]),
      legs,
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      approximate: true,
      message: "เส้นนี้เป็นค่าประมาณจากข้อมูลถนน ไม่ได้รับประกันเวลาเดินทาง",
    };
  } catch {
    return { ok: false, message: `${UNAVAILABLE} เพราะติดต่อเซิร์ฟเวอร์เส้นทางไม่ได้` };
  }
}

function routingBase(): string | null {
  const configured = process.env.OSRM_BASE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "development") return "https://router.project-osrm.org";
  return null;
}

function clockMinutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("เวลาไม่ถูกต้อง");
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatMinutes(total: number): string {
  const day = 24 * 60;
  const normalized = ((total % day) + day) % day;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}
