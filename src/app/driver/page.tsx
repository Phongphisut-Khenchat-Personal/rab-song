import { Shell } from "@/components/shell";
import { TripCard } from "@/components/trip-card";
import { requirePageActor } from "@/lib/current";
import { bangkokYmd, formatThaiDate } from "@/lib/time";
import { getDriverToday } from "@/server/runs";

export default async function DriverPage() {
  const actor = await requirePageActor(["OWNER", "DRIVER"]);
  const runs = await getDriverToday(actor);
  return (
    <Shell actor={actor}>
      <div className="stack">
        <div className="hello">
          <p className="kicker">{formatThaiDate(bangkokYmd())}</p>
          <h1>รอบวันนี้</h1>
          <p className="muted">จอดก่อน แล้วค่อยเช็คเด็ก</p>
        </div>
        {runs.length === 0 ? <section className="card">วันนี้ไม่มีรอบรถ</section> : null}
        {runs.map((run) => (
          <TripCard key={run.id} trip={run} href={`/driver/runs/${run.id}`} action="เปิดเส้นทาง" />
        ))}
      </div>
    </Shell>
  );
}
