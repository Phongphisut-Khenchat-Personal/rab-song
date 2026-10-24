import { HolidayForm } from "@/components/workflow-forms";
import { Shell } from "@/components/shell";
import { requirePageActor } from "@/lib/current";
import { prisma } from "@/lib/db";

export default async function CalendarPage() {
  const actor = await requirePageActor(["OWNER"]);
  const rows = await prisma.serviceException.findMany({ orderBy: { serviceDate: "desc" }, take: 20 });
  return (
    <Shell actor={actor} wide>
      <div className="stack">
        <h1>ปฏิทินบริการ</h1>
        <HolidayForm />
        <ul className="list">
          {rows.map((row) => (
            <li key={row.id}>{row.serviceDate.toISOString().slice(0, 10)} · {row.kind} · {row.note}</li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}
