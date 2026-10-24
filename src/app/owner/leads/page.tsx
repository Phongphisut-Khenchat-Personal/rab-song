import { LeadCreateForm, LeadStepForm } from "@/components/workflow-forms";
import { PlaceForm } from "@/components/place-form";
import { Shell } from "@/components/shell";
import { requirePageActor } from "@/lib/current";
import { prisma } from "@/lib/db";

const labels: Record<string, string> = {
  LEAD: "ผู้สนใจ",
  SURVEY_SCHEDULED: "นัดสำรวจแล้ว",
  LOCATION_PENDING_VERIFICATION: "รอตรวจจุด",
  ROUTE_ASSESSMENT: "กำลังประเมินเส้นทาง",
  QUOTE_PENDING: "รอเสนอราคา",
  AGREEMENT_PENDING: "รอลูกค้ายืนยัน",
  REGISTRATION_PENDING: "รอลงทะเบียน",
  SCHEDULE_PENDING: "รอจัดตาราง",
  READY_FOR_SERVICE: "พร้อมเริ่มบริการ",
  ACTIVE: "เริ่มบริการแล้ว",
  REJECTED: "ไม่รับ",
  CANCELLED: "ยกเลิก",
  SUSPENDED: "พักบริการ",
};

export default async function LeadsPage() {
  const actor = await requirePageActor(["OWNER"]);
  const [leads, schools] = await Promise.all([
    prisma.serviceLead.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.school.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <Shell actor={actor} wide>
      <div className="stack">
        <h1>ลูกค้าใหม่</h1>
        <LeadCreateForm />
        {leads.length > 0 ? <PlaceForm leads={leads.map((lead) => ({ id: lead.id, childNickname: lead.childNickname }))} /> : null}
        <ul className="list">
          {leads.map((lead) => (
            <li className="card" key={lead.id}>
              <strong>{lead.childNickname}</strong>
              <div>{lead.guardianName} · {lead.phone}</div>
              <div>{labels[lead.status] ?? lead.status}{lead.studentId ? "" : " · ยังไม่ได้เป็นนักเรียนในระบบ"}</div>
              <LeadStepForm lead={{ id: lead.id, status: lead.status, childNickname: lead.childNickname }} schools={schools} />
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}
