import { Moon, Phone, Sun } from "lucide-react";
import { NoticeToaster } from "@/components/notice-toaster";
import { Shell } from "@/components/shell";
import { requirePageActor } from "@/lib/current";
import { pushStatusLabel } from "@/lib/confirmation";
import { formatThaiDateTime } from "@/lib/time";
import { getGuardianToday, listNotifications } from "@/server/runs";

export default async function GuardianPage() {
  const actor = await requirePageActor(["GUARDIAN"]);
  const [children, notifications] = await Promise.all([getGuardianToday(actor), listNotifications(actor)]);
  return (
    <Shell actor={actor} alertCount={notifications.length}>
      <NoticeToaster items={notifications} />
      <div className="stack">
        <div className="hello">
          <p className="kicker">สวัสดี</p>
          <h1>{actor.name}</h1>
        </div>
        {children.length === 0 ? <section className="card">ยังไม่มีเด็กที่บัญชีนี้ดูได้</section> : null}
        {children.map((child) => {
          const phone = child.morning?.driverPhone ?? child.evening?.driverPhone;
          const driver = child.morning?.driverName ?? child.evening?.driverName;
          return (
            <section className="trip-card" key={child.studentId}>
              <div className="child-head">
                <span className="avatar" aria-hidden="true">{(child.nickname.replace(/^น้อง/, "") || child.displayName).slice(0, 1)}</span>
                <div className="child-copy">
                  <h2>{child.displayName}</h2>
                  <p className="muted">{child.schoolName}</p>
                </div>
                {phone ? <a className="call" href={`tel:${phone}`} aria-label={driver ? `โทรคนขับ ${driver}` : "โทรคนขับ"}><Phone size={20} aria-hidden="true" /></a> : null}
              </div>
              {(["morning", "evening"] as const).map((period) => {
                const slice = child[period];
                if (!slice) return null;
                const Icon = period === "morning" ? Sun : Moon;
                return (
                  <div className="leg" key={period}>
                    <Icon size={18} aria-hidden="true" />
                    <div className="leg-copy">
                      <p className="muted">{period === "morning" ? "ไปโรงเรียน" : "กลับบ้าน"}</p>
                      <strong className="now">{slice.headline}</strong>
                      {slice.note ? <p>{slice.note}</p> : null}
                      {slice.alternateReceiverName ? <p className="muted">ผู้รับแทน {slice.alternateReceiverName}</p> : null}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
        {notifications.length > 0 ? (
          <section className="card stack" id="alerts">
            <h2>แจ้งเตือน</h2>
            <ul className="list">
              {notifications.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <div>{item.body}</div>
                  <div className="muted">{formatThaiDateTime(item.createdAt)} · {pushStatusLabel(item.pushDelivery)}</div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Shell>
  );
}
