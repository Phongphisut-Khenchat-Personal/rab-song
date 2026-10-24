import Link from "next/link";
import { Shell } from "@/components/shell";
import { requirePageActor } from "@/lib/current";
import { bangkokYmd, formatThaiDate } from "@/lib/time";
import { getDriverToday } from "@/server/runs";

export default async function DriverPage() {
  const actor = await requirePageActor(["OWNER", "DRIVER"]);
  const runs = await getDriverToday(actor);
  return (
    <Shell actor={actor}>
      <div className="stack">
        <h1>รอบวันนี้</h1>
        <p className="muted">{formatThaiDate(bangkokYmd())}</p>
        <div className="safety">ดูรายชื่อได้ก่อนออกเดินทาง เมื่อรถเคลื่อนที่ให้ใช้ปุ่มนำทางแล้ววางโทรศัพท์</div>
        {runs.length === 0 ? <section className="card">วันนี้ไม่มีรอบรถ</section> : null}
        {runs.map((run) => (
          <section className="card stack" key={run.id}>
            <h2>{run.periodLabel}</h2>
            <div>{run.routeName}</div>
            <div className="muted">ออกตามแผน {run.plannedStartTime} · {run.vehiclePlate}</div>
            <div className="counts">
              <div className="count"><b>{run.counts.boarded}</b><span>ขึ้นรถแล้ว</span></div>
              <div className="count"><b>{run.counts.unconfirmed}</b><span>ยังไม่ยืนยัน</span></div>
            </div>
            <Link className="btn green" href={`/driver/runs/${run.id}`}>เปิดรายชื่อเมื่อจอดแล้ว</Link>
          </section>
        ))}
      </div>
    </Shell>
  );
}
