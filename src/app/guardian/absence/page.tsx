import { AbsenceForm } from "@/components/absence-form";
import { Shell } from "@/components/shell";
import { requirePageActor } from "@/lib/current";
import { absenceStatusLabel, studentDisplayName } from "@/lib/labels";
import { prisma } from "@/lib/db";
import { listAbsences } from "@/server/absence";

export default async function AbsencePage() {
  const actor = await requirePageActor(["GUARDIAN"]);
  const [links, absences] = await Promise.all([
    prisma.studentGuardian.findMany({
      where: { guardianId: actor.guardianId ?? "none" },
      include: { student: true },
    }),
    listAbsences(actor),
  ]);
  return (
    <Shell actor={actor}>
      <div className="stack">
        <AbsenceForm
          students={links.map((link) => ({ id: link.studentId, displayName: studentDisplayName(link.student) }))}
        />
        <section className="card stack">
          <h2>คำขอที่ส่งแล้ว</h2>
          {absences.length === 0 ? <p>ยังไม่มีคำขอ</p> : null}
          <ul className="list">
            {absences.map((absence) => (
              <li key={absence.id}>
                {absence.studentName} · {absence.startDate} ถึง {absence.endDate} · {absence.reason} · {absenceStatusLabel(absence.status)}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}
