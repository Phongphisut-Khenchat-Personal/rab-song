import Link from "next/link";
import { AcknowledgeButton } from "@/components/owner-forms";
import { Shell } from "@/components/shell";
import { requirePageActor } from "@/lib/current";
import { formatThaiDateTime } from "@/lib/time";
import { listAbsences } from "@/server/absence";
import { getOwnerSummary } from "@/server/runs";

export default async function OwnerPage() {
  const actor = await requirePageActor(["OWNER"]);
  const [summary, absences] = await Promise.all([getOwnerSummary(actor), listAbsences(actor)]);
  return (
    <Shell actor={actor} wide>
      <div className="stack">
        <h1>ภาพรวมวันนี้</h1>
        <div className="counts">
          <div className="count"><b>{summary.pendingAbsences}</b><span>คำขอหยุดรอรับทราบ</span></div>
          <div className="count"><b>{summary.unpaidInvoices}</b><span>ยอดที่ยังไม่ครบ</span></div>
        </div>
        {summary.runs.map((run) => (
          <section className="card" key={run.id}>
            <h2>{run.periodLabel}</h2>
            <div>ขึ้นรถแล้ว {run.counts.boarded} · ยังไม่ยืนยัน {run.counts.unconfirmed} · บนรถ {run.counts.onBoard}</div>
            <Link className="btn" href={`/driver/runs/${run.id}`}>เปิดรอบนี้</Link>
          </section>
        ))}
        <section className="card stack">
          <h2>เหตุการณ์วันนี้</h2>
          {summary.exceptions.length === 0 ? <p>ยังไม่มีเหตุการณ์ผิดปกติ</p> : null}
          <ul className="list">
            {summary.exceptions.map((item) => (
              <li key={item.id}>{item.studentName} · {item.periodLabel} · {item.eventType} · {formatThaiDateTime(item.recordedAt)}</li>
            ))}
          </ul>
        </section>
        <section className="card stack">
          <h2>คำขอหยุด</h2>
          <ul className="list">
            {absences.map((absence) => (
              <li key={absence.id}>
                {absence.studentName} · {absence.startDate} ถึง {absence.endDate} · {absence.reason} · {absence.status}
                {absence.status === "SUBMITTED" ? <AcknowledgeButton absenceId={absence.id} /> : null}
              </li>
            ))}
          </ul>
        </section>
        <section className="card stack">
          <h2>การแก้ไขล่าสุด</h2>
          <ul className="list">
            {summary.audits.map((audit) => (
              <li key={audit.id}>{formatThaiDateTime(audit.createdAt)} · {audit.actorName} · {audit.action}</li>
            ))}
          </ul>
          <Link className="btn" href="/owner/audit">ดูประวัติทั้งหมด</Link>
        </section>
      </div>
    </Shell>
  );
}
