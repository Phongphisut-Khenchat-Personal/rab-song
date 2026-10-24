"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { mapTiles } from "@/lib/map-tiles";
import { approximateDistance } from "@/lib/maneuver";
import type { MapPoint } from "@/lib/drive-plan";

type Leg = { line: [number, number][]; distanceMeters: number; steps: { instruction: string; distanceMeters: number }[] };

export default function RouteMap({ points, legIndex }: { points: MapPoint[]; legIndex: number | null }) {
  const tiles = mapTiles();
  const [line, setLine] = useState<[number, number][] | null>(null);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [note, setNote] = useState("");
  const key = points.map((point) => `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`).join(";");
  const located = useMemo(() => points.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)), [points]);
  const active = legIndex != null ? legs[legIndex] : undefined;

  useEffect(() => {
    if (located.length < 2) {
      setLine(null);
      setLegs([]);
      setNote(located.length === 0 ? "ยังไม่มีหมุดบนเส้นทางนี้" : "ปักหมุดให้ครบอย่างน้อยสองจุดเพื่อคำนวณเส้นทาง");
      return;
    }
    const controller = new AbortController();
    setNote("กำลังคำนวณเส้นทาง");
    void fetch("/api/routing/line", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ points: located.map((point) => ({ latitude: point.latitude, longitude: point.longitude })) }),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((body) => {
        if (controller.signal.aborted) return;
        setLine(Array.isArray(body.line) ? body.line : null);
        setLegs(Array.isArray(body.legs) ? body.legs : []);
        setNote(body.message ?? "");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLine(null);
          setLegs([]);
          setNote("ยังคำนวณตามถนนไม่ได้ แผนที่แสดงลำดับจุด");
        }
      });
    return () => controller.abort();
  }, [key]);

  if (!tiles) return <p className="muted">ยังไม่ได้ตั้งค่าแผนที่พร้อมข้อความแหล่งข้อมูล</p>;
  if (located.length === 0) return <p className="muted">ยังไม่มีหมุดบนเส้นทางนี้</p>;
  const center: [number, number] = [located[0].latitude, located[0].longitude];
  const focus = active?.line?.length ? active.line : ((line ?? located.map((point) => [point.latitude, point.longitude])) as [number, number][]);
  const turns = (active?.steps ?? []).filter((step) => step.instruction).slice(0, 4);
  const first = turns[0];
  return (
    <div className="stack">
      {first ? (
        <div className="turn-now">
          <strong>{first.instruction}</strong>
          {approximateDistance(first.distanceMeters) ? <span>{approximateDistance(first.distanceMeters)}</span> : null}
        </div>
      ) : null}
      <div className={active ? "map-frame tall" : "map-frame"}>
        <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }}>
          <TileLayer attribution={tiles.attribution} url={tiles.url} />
          {line ? (
            <Polyline key="road" positions={line} pathOptions={{ color: active ? "#ffd0b0" : "#ff6a00", weight: 5 }} />
          ) : (
            <Polyline key="order" positions={located.map((point) => [point.latitude, point.longitude])} pathOptions={{ color: "#ff6a00", weight: 4, dashArray: "8 8" }} />
          )}
          {active?.line?.length ? <Polyline key={`leg-${legIndex}`} positions={active.line} pathOptions={{ color: "#ff6a00", weight: 6 }} /> : null}
          {located.map((point) => (
            <Marker key={point.key} position={[point.latitude, point.longitude]} icon={markerIcon(point.label, point.kind === "next")} />
          ))}
          <Fit points={focus} />
        </MapContainer>
      </div>
      {turns.length > 1 ? (
        <ol className="turns">
          {turns.slice(1).map((step, index) => (
            <li key={`${step.instruction}-${index}`}>
              <strong>{step.instruction}</strong>
              {approximateDistance(step.distanceMeters) ? <span>{approximateDistance(step.distanceMeters)}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {note ? <p className="map-note">{note}</p> : null}
    </div>
  );
}

function markerIcon(label: string, current: boolean) {
  return divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:${current ? "#ff6a00" : "#1b1b1f"};color:#fff;border:3px solid #fff;font:800 13px sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25)">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  const signature = points.map((point) => point.join(",")).join(";");
  useEffect(() => {
    const parsed = signature.split(";").filter(Boolean).map((item) => item.split(",").map(Number) as [number, number]);
    if (parsed.length === 1) map.setView(parsed[0], 16);
    else if (parsed.length > 1) map.fitBounds(parsed, { padding: [28, 28] });
  }, [map, signature]);
  return null;
}
