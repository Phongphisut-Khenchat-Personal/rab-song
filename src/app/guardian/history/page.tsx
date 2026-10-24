import { Shell } from "@/components/shell";
import { requirePageActor } from "@/lib/current";
import { actionLabel, invoiceStatusLabel, type AttendanceEventType, type RunPeriod } from "@/lib/labels";
import { formatThaiDateTime } from "@/lib/time";
import { listInvoices } from "@/server/payments";
import { getGuardianHistory } from "@/server/runs";

export default async function HistoryPage() {
  const actor = await requirePageActor(["GUARDIAN"]);
  const [events, invoices] = await Promise.all([getGuardianHistory(actor), listInvoices(actor)]);
  return (
    <Shell actor={actor}>
      <div className="stack">
        <section className="card stack">
          <h1>ประวัติการรับส่ง</h1>
          {events.length === 0 ? <p>ยังไม่มีรายการ</p> : null}
          <ul className="list">
            {events.map((event) => (
              <li key={event.id}>
                <strong>{event.studentName}</strong>
                <div>
                  {event.periodLabel} · {actionLabel(event.eventType as AttendanceEventType, event.period as RunPeriod)}
                </div>
                <div className="muted">{formatThaiDateTime(event.recordedAt)}</div>
              </li>
            ))}
          </ul>
        </section>
        <section className="card stack">
          <h2>ค่าโดยสารของเด็กในความดูแล</h2>
          {invoices.length === 0 ? <p>ยังไม่มีใบแจ้งยอด</p> : null}
          <ul className="list">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                {invoice.studentName} · {invoice.yearMonth} · {invoice.amountLabel} · คงเหลือ {invoice.remainingLabel} · {invoiceStatusLabel(invoice.status)}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}
