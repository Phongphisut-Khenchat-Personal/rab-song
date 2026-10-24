import { Shell } from "@/components/shell";
import { requirePageActor } from "@/lib/current";
import { formatThaiDateTime } from "@/lib/time";
import { getGuardianToday, listNotifications } from "@/server/runs";

export default async function GuardianPage() {
  const actor = await requirePageActor(["GUARDIAN"]);
  const [children, notifications] = await Promise.all([getGuardianToday(actor), listNotifications(actor)]);
  return (
    <Shell actor={actor}>
      <div className="stack">
        <h1>สถานะวันนี้</h1>
        {children.length === 0 ? <section className="card">ยังไม่มีเด็กที่บัญชีนี้ดูได้</section> : null}
        {children.map((child) => (
          <section className="card stack" key={child.studentId}>
            <h2>{child.displayName}</h2>
            <div className="muted">{child.schoolName}</div>
            {(["morning", "evening"] as const).map((period) => {
              const slice = child[period];
              return (
                <div key={period}>
                  <strong>{period === "morning" ? "รอบเช้า" : "รอบเย็น"}: </strong>
                  {slice ? slice.statusLabel : "ไม่มีรอบ"}
                  {slice?.alternateReceiverName ? ` · ผู้รับแทน ${slice.alternateReceiverName}` : ""}
                  {slice ? (
                    <a className="btn" href={`tel:${slice.driverPhone}`}>
                      โทรคนขับ {slice.driverName}
                    </a>
                  ) : null}
                </div>
              );
            })}
            <p className="muted">การแจ้งเตือนพุชยังไม่ได้ตั้งค่า ผู้ปกครองเห็นรายการเมื่อเปิดแอป</p>
          </section>
        ))}
        <section className="card stack">
          <h2>การแจ้งในแอป</h2>
          {notifications.length === 0 ? <p>ยังไม่มีการแจ้ง</p> : null}
          <ul className="list">
            {notifications.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <div>{item.body}</div>
                <div className="muted">{formatThaiDateTime(item.createdAt)} · พุช: ยังไม่ได้ตั้งค่า</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Shell>
  );
}
