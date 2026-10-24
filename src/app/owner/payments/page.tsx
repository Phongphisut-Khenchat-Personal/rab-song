import { InvoiceForms } from "@/components/owner-forms";
import { Shell } from "@/components/shell";
import { requirePageActor } from "@/lib/current";
import { invoiceStatusLabel } from "@/lib/labels";
import { listInvoices } from "@/server/payments";
import { listStudents } from "@/server/roster";

export default async function PaymentsPage() {
  const actor = await requirePageActor(["OWNER"]);
  const [invoices, students] = await Promise.all([listInvoices(actor), listStudents(actor)]);
  return (
    <Shell actor={actor} wide>
      <div className="stack">
        <h1>ค่าโดยสาร</h1>
        <InvoiceForms students={students.map((student) => ({ id: student.id, displayName: student.displayName }))} />
        <ul className="list">
          {invoices.map((invoice) => (
            <li className="card" key={invoice.id}>
              <strong>{invoice.studentName}</strong> · {invoice.yearMonth}
              <div>{invoice.amountLabel} · คงเหลือ {invoice.remainingLabel} · {invoiceStatusLabel(invoice.status)}</div>
              <div className="muted">รหัสยอด {invoice.id}</div>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}
