import type { CoordinateSource, LocationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/server/audit";
import type { Actor } from "@/server/auth";
import { DomainError } from "@/server/errors";

const HUMAN_STATUSES = new Set<LocationStatus>(["PARENT_CONFIRMED", "FIELD_VERIFIED", "REJECTED", "NEEDS_RECHECK"]);

export async function savePlace(
  actor: Actor,
  input: {
    leadId?: string;
    routeStopId?: string;
    label: string;
    addressLine: string;
    directionNote?: string;
    entranceNote?: string;
    parkingNote?: string;
    landmark?: string;
    cautionNote?: string;
    latitude?: number | null;
    longitude?: number | null;
    coordinateSource: CoordinateSource;
  },
) {
  if (actor.role !== "OWNER") throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  if (!input.leadId && !input.routeStopId) throw new DomainError(422, "PLACE_TARGET", "ต้องระบุลูกค้าหรือจุดรับส่ง");
  const data = {
    label: input.label.trim(),
    addressLine: input.addressLine.trim(),
    directionNote: clean(input.directionNote),
    entranceNote: clean(input.entranceNote),
    parkingNote: clean(input.parkingNote),
    landmark: clean(input.landmark),
    cautionNote: clean(input.cautionNote),
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    coordinateSource: input.coordinateSource,
    status: "UNVERIFIED" as const,
    checkNote: null,
    verifiedAt: null,
    verifiedByUserId: null,
  };
  const place = await prisma.$transaction(async (tx) => {
    const saved = input.leadId
      ? await upsertLeadPlace(tx, input.leadId, data)
      : await upsertStopPlace(tx, input.routeStopId!, data);
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "PLACE_SAVED",
      entityType: "Place",
      entityId: saved.id,
      next: { status: "UNVERIFIED", coordinateSource: input.coordinateSource },
    });
    return saved;
  });
  await writeGeog(place.id, input.latitude, input.longitude);
  return { id: place.id, status: place.status };
}

export async function verifyPlace(
  actor: Actor,
  placeId: string,
  input: { status: LocationStatus; checkNote: string; confirmedByPerson: boolean },
) {
  if (actor.role !== "OWNER" && actor.role !== "DRIVER" && actor.role !== "GUARDIAN") {
    throw new DomainError(403, "FORBIDDEN", "ไม่มีสิทธิ์");
  }
  if (!input.confirmedByPerson) {
    throw new DomainError(422, "PERSON_REQUIRED", "พิกัดอย่างเดียวไม่ยืนยันว่าจุดนี้ปลอดภัย ต้องมีคนตรวจจุด");
  }
  if (!HUMAN_STATUSES.has(input.status)) {
    throw new DomainError(422, "INVALID_STATUS", "สถานะจุดนี้ต้องมาจากการยืนยันของคน");
  }
  if (input.checkNote.trim().length < 5) {
    throw new DomainError(422, "CHECK_NOTE_REQUIRED", "โปรดบันทึกสิ่งที่ตรวจ เช่น ทางเข้า จุดจอด และข้อควรระวัง");
  }
  if ((input.status === "FIELD_VERIFIED" || input.status === "PARENT_CONFIRMED") && actor.role === "GUARDIAN" && input.status === "FIELD_VERIFIED") {
    throw new DomainError(403, "FORBIDDEN", "ผู้ปกครองยืนยันได้เฉพาะจุดที่ตนตรวจ ไม่ใช่การสำรวจหน้างาน");
  }
  const previous = await prisma.place.findUnique({ where: { id: placeId } });
  if (!previous) throw new DomainError(404, "NOT_FOUND", "ไม่พบจุด");
  if ((input.status === "PARENT_CONFIRMED" || input.status === "FIELD_VERIFIED") && (previous.latitude === null || previous.longitude === null)) {
    throw new DomainError(422, "COORDINATES_REQUIRED", "ต้องมีพิกัดก่อนยืนยันจุด");
  }
  const saved = await prisma.$transaction(async (tx) => {
    const row = await tx.place.update({
      where: { id: placeId },
      data: {
        status: input.status,
        checkNote: input.checkNote.trim(),
        verifiedAt: new Date(),
        verifiedByUserId: actor.userId,
      },
    });
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: "PLACE_VERIFIED",
      entityType: "Place",
      entityId: placeId,
      previous: { status: previous.status },
      next: { status: input.status, checkNote: input.checkNote.trim() },
    });
    return row;
  });
  return { id: saved.id, status: saved.status };
}

export async function searchAddress(query: string): Promise<{ label: string; latitude: number; longitude: number }[]> {
  const base = process.env.GEOCODER_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    throw new DomainError(503, "GEOCODER_UNAVAILABLE", "ยังไม่ได้ตั้งค่าบริการค้นหาที่อยู่ จึงค้นหาไม่ได้");
  }
  const url = new URL(`${base}/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("geocoder");
    const rows = (await response.json()) as { display_name?: string; lat?: string; lon?: string }[];
    return rows.flatMap((row) => {
      const latitude = Number(row.lat);
      const longitude = Number(row.lon);
      if (!row.display_name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
      return [{ label: row.display_name, latitude, longitude }];
    });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError(503, "GEOCODER_UNAVAILABLE", "บริการค้นหาที่อยู่ตอบกลับไม่ได้");
  }
}

async function upsertLeadPlace(tx: Prisma.TransactionClient, leadId: string, data: PlaceData) {
  const lead = await tx.serviceLead.findUnique({ where: { id: leadId }, include: { place: true } });
  if (!lead) throw new DomainError(404, "NOT_FOUND", "ไม่พบลูกค้า");
  if (lead.place) return tx.place.update({ where: { id: lead.place.id }, data });
  return tx.place.create({ data: { ...data, leadId } });
}

async function upsertStopPlace(tx: Prisma.TransactionClient, routeStopId: string, data: PlaceData) {
  const stop = await tx.routeStop.findUnique({ where: { id: routeStopId }, include: { place: true } });
  if (!stop) throw new DomainError(404, "NOT_FOUND", "ไม่พบจุดรับส่ง");
  if (stop.place) return tx.place.update({ where: { id: stop.place.id }, data });
  return tx.place.create({ data: { ...data, routeStopId } });
}

async function writeGeog(id: string, latitude?: number | null, longitude?: number | null) {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return;
  await prisma.$executeRaw`UPDATE "Place" SET geog = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography WHERE id = ${id}`;
}

function clean(value?: string): string | null {
  const text = value?.trim();
  return text ? text : null;
}

type PlaceData = {
  label: string;
  addressLine: string;
  directionNote: string | null;
  entranceNote: string | null;
  parkingNote: string | null;
  landmark: string | null;
  cautionNote: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinateSource: CoordinateSource;
  status: "UNVERIFIED";
  checkNote: null;
  verifiedAt: null;
  verifiedByUserId: null;
};
