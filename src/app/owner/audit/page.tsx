import { Shell } from "@/components/shell";
import { requirePageActor } from "@/lib/current";
import { formatThaiDateTime } from "@/lib/time";
import { listAudit } from "@/server/runs";

export default async function AuditPage() {
  const actor = await requirePageActor(["OWNER"]);
  const audits = await listAudit(actor);
  return (
    <Shell actor={actor} wide>
      <div className="stack">
        <h1>ประวัติการแก้ไข</h1>
        {audits.map((audit) => (
          <article className="card" key={audit.id}>
            <strong>{audit.action}</strong>
            <div className="muted">{formatThaiDateTime(audit.createdAt)} · {audit.actorName}</div>
            <div>เดิม: {JSON.stringify(audit.previous)}</div>
            <div>ใหม่: {JSON.stringify(audit.next)}</div>
          </article>
        ))}
      </div>
    </Shell>
  );
}
