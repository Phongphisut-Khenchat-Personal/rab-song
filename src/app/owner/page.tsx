import Link from "next/link";
import { CalendarOff, UserPlus, Users } from "lucide-react";
import { AcknowledgeButton } from "@/components/owner-forms";
import { Shell } from "@/components/shell";
import { TripCard } from "@/components/trip-card";
import { requirePageActor } from "@/lib/current";
import { absenceStatusLabel } from "@/lib/labels";
import { formatThaiDate, formatThaiDateTime, bangkokYmd } from "@/lib/time";
import { listAbsences } from "@/server/absence";
import { getOwnerSummary } from "@/server/runs";

export default async function OwnerPage() {
  const actor = await requirePageActor(["OWNER"]);
  const [summary, absences] = await Promise.all([getOwnerSummary(actor), listAbsences(actor)]);
  const openAbsences = absences.filter((absence) => absence.status === "SUBMITTED");
  return (
    <Shell actor={actor}>
      <div className="stack">
        <div className="hello">
          <p className="kicker">{formatThaiDate(bangkokYmd())}</p>
          <h1>วันนี้</h1>
        </div>
        {summary.runs.map((run) => (
          <TripCard key={run.id} trip={run} href={`/driver/runs/${run.id}`} action="เปิดเส้นทาง" />
        ))}
        <div className="counts">
          <div className="count"><b>{summary.pendingAbsences}</b><span>คำขอลา</span></div>
          <div className="count"><b>{summary.unpaidInvoices}</b><span>ยอดค้าง</span></div>
        </div>
        <div className="shortcuts">
          <Link href="/owner/leads"><UserPlus size={22} aria-hidden="true" />ลูกค้าใหม่</Link>
          <Link href="/owner/accounts"><Users size={22} aria-hidden="true" />บัญชี</Link>
          <Link href="/owner/calendar"><CalendarOff size={22} aria-hidden="true" />วันหยุด</Link>
        </div>
        {summary.exceptions.length > 0 ? (
          <section className="card stack">
            <h2>ต้องดูวันนี้</h2>
            <ul className="list">
              {summary.exceptions.map((item) => (
                <li key={item.id}>{item.studentName} · {item.periodLabel} · {item.eventType} · {formatThaiDateTime(item.recordedAt)}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {openAbsences.length > 0 ? (
          <section className="card stack">
            <h2>คำขอลา</h2>
            <ul className="list">
              {openAbsences.map((absence) => (
                <li key={absence.id}>
                  {absence.studentName} · {absence.startDate} ถึง {absence.endDate} · {absence.reason} · {absenceStatusLabel(absence.status)}
                  <AcknowledgeButton absenceId={absence.id} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <Link className="btn" href="/owner/audit">ประวัติการแก้ไข</Link>
      </div>
    </Shell>
  );
}
