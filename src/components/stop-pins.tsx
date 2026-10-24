"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { canShowConfirmed } from "@/lib/confirmation";
import { mapTiles } from "@/lib/map-tiles";

const PinMap = dynamic(() => import("@/components/pin-map"), { ssr: false });

type StopPin = { id: string; name: string; sequence: number; latitude: number | null; longitude: number | null };

export function StopPins({ routeId, stops }: { routeId: string; stops: StopPin[] }) {
  const router = useRouter();
  const tiles = mapTiles();
  const [selectedId, setSelectedId] = useState(stops[0]?.id ?? "");
  const selected = stops.find((stop) => stop.id === selectedId) ?? stops[0];
  const [latitude, setLatitude] = useState(selected?.latitude ?? 13.73);
  const [longitude, setLongitude] = useState(selected?.longitude ?? 100.54);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  function choose(stop: StopPin) {
    setSelectedId(stop.id);
    setLatitude(stop.latitude ?? 13.73);
    setLongitude(stop.longitude ?? 100.54);
    setMessage("");
    setOk(null);
  }

  if (!selected) return null;
  return (
    <div className="stack">
      <h3>ปักหมุดบ้าน</h3>
      <p className="muted">แตะแผนที่หรือลากหมุด แล้วบันทึก พิกัดใช้เปิดเส้นทาง ไม่ได้แปลว่าจุดจอดปลอดภัย</p>
      <div className="chips">
        {stops.map((stop) => (
          <button key={stop.id} className="chip btn" type="button" onClick={() => choose(stop)} aria-current={stop.id === selected.id ? "true" : undefined}>
            {stop.sequence}. {stop.name}
          </button>
        ))}
      </div>
      {tiles ? (
        <div className="map-frame">
          <PinMap
            latitude={latitude}
            longitude={longitude}
            tileUrl={tiles.url}
            attribution={tiles.attribution}
            onMove={(nextLat, nextLng) => {
              setLatitude(nextLat);
              setLongitude(nextLng);
            }}
          />
        </div>
      ) : <p className="muted">ยังไม่ได้ตั้งค่าแผนที่</p>}
      <button
        className="btn green"
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const response = await fetch(`/api/routes/${routeId}/stops/${selected.id}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ latitude, longitude }),
          });
          const body = await response.json().catch(() => null);
          const confirmed = canShowConfirmed(body);
          setOk(confirmed);
          setMessage(confirmed ? "บันทึกหมุดแล้ว" : body?.error?.message ?? "ยังไม่ได้บันทึกหมุด");
          if (confirmed) {
            toast.success("บันทึกหมุดแล้ว");
            router.refresh();
          }
          setPending(false);
        }}
      >
        {pending ? "กำลังบันทึก..." : "บันทึกหมุดจุดนี้"}
      </button>
      {message ? <div className={ok ? "banner ok" : "banner bad"} role="status">{message}</div> : null}
    </div>
  );
}
