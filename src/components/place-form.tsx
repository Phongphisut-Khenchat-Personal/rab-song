"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { canShowConfirmed } from "@/lib/confirmation";
import { mapTiles } from "@/lib/map-tiles";

const PinMap = dynamic(() => import("@/components/pin-map"), { ssr: false });

export function PlaceForm({ leads }: { leads: { id: string; childNickname: string }[] }) {
  const router = useRouter();
  const [latitude, setLatitude] = useState("13.730000");
  const [longitude, setLongitude] = useState("100.540000");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [results, setResults] = useState<{ label: string; latitude: number; longitude: number }[]>([]);
  const tiles = mapTiles();
  const lat = Number(latitude);
  const lng = Number(longitude);

  async function search(query: string) {
    const response = await fetch("/api/places", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setOk(false);
      setResults([]);
      setMessage(body?.error?.message ?? "ค้นหาที่อยู่ไม่ได้");
      return;
    }
    setResults(body.results ?? []);
    setMessage(body.results?.length ? "เลือกผลลัพธ์แล้วตรวจหมุดก่อนบันทึก" : "ไม่พบผลลัพธ์");
    setOk(null);
  }

  return (
    <form
      className="card stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const response = await fetch("/api/places", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            leadId: form.get("leadId"),
            label: form.get("label"),
            addressLine: form.get("addressLine"),
            directionNote: form.get("directionNote") || undefined,
            entranceNote: form.get("entranceNote") || undefined,
            parkingNote: form.get("parkingNote") || undefined,
            landmark: form.get("landmark") || undefined,
            cautionNote: form.get("cautionNote") || undefined,
            latitude: lat,
            longitude: lng,
            coordinateSource: "MAP_PIN",
          }),
        });
        const body = await response.json().catch(() => null);
        const confirmed = canShowConfirmed(body);
        setOk(confirmed);
        setMessage(confirmed ? "บันทึกจุดแล้ว สถานะยังไม่ยืนยันจนกว่าจะมีคนตรวจ" : body?.error?.message ?? "ยังไม่ได้บันทึกจุด");
        if (confirmed) router.refresh();
      }}
    >
      <h2>ปักหมุดจุดรับ</h2>
      <p className="muted">พิกัดช่วยเปิดแผนที่เท่านั้น ยังไม่ถือว่าทางเข้าหรือจุดจอดปลอดภัยจนกว่าจะมีคนยืนยัน</p>
      <label className="field">ลูกค้า
        <select className="text-input" name="leadId" required>
          {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.childNickname}</option>)}
        </select>
      </label>
      <label className="field">ค้นหาที่อยู่
        <input className="text-input" name="query" onBlur={(event) => { if (event.target.value.trim().length >= 3) void search(event.target.value.trim()); }} />
      </label>
      {results.map((result) => (
        <button
          className="btn"
          type="button"
          key={`${result.latitude}-${result.longitude}`}
          onClick={() => {
            setLatitude(result.latitude.toFixed(6));
            setLongitude(result.longitude.toFixed(6));
          }}
        >
          {result.label}
        </button>
      ))}
      {tiles && Number.isFinite(lat) && Number.isFinite(lng) ? (
        <div className="map-frame">
        <PinMap
          latitude={lat}
          longitude={lng}
          tileUrl={tiles.url}
          attribution={tiles.attribution}
          onMove={(nextLat, nextLng) => {
            setLatitude(nextLat.toFixed(6));
            setLongitude(nextLng.toFixed(6));
          }}
        />
        </div>
      ) : (
        <p className="muted">ยังไม่ได้ตั้งค่าแผนที่พร้อมข้อความแหล่งข้อมูล จึงยังไม่แสดงแผนที่ ใส่พิกัดได้จากช่องด้านล่าง</p>
      )}
      <label className="field">ชื่อจุด<input className="text-input" name="label" required /></label>
      <label className="field">ที่อยู่<input className="text-input" name="addressLine" required /></label>
      <label className="field">วิธีเดินทาง<textarea className="text-input" name="directionNote" rows={2} /></label>
      <label className="field">ทางเข้า<input className="text-input" name="entranceNote" /></label>
      <label className="field">จุดจอด<input className="text-input" name="parkingNote" /></label>
      <label className="field">จุดสังเกต<input className="text-input" name="landmark" /></label>
      <label className="field">ข้อควรระวัง<input className="text-input" name="cautionNote" /></label>
      <label className="field">ละติจูด<input className="text-input" value={latitude} onChange={(event) => setLatitude(event.target.value)} required /></label>
      <label className="field">ลองจิจูด<input className="text-input" value={longitude} onChange={(event) => setLongitude(event.target.value)} required /></label>
      <button className="btn green" type="submit">บันทึกจุด</button>
      {message ? <div className={ok ? "banner ok" : "banner bad"} role="status">{message}</div> : null}
    </form>
  );
}
