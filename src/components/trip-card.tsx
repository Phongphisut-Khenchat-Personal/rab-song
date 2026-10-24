import Link from "next/link";
import { Bus } from "lucide-react";
import { EVENING_STEPS, MORNING_STEPS, runStepIndex } from "@/lib/trip-steps";

const stepLines: Record<string, [string, string]> = {
  "ยังไม่เดินทาง": ["ยังไม่", "เดินทาง"],
  "กำลังรับ": ["กำลัง", "รับ"],
  "ถึงโรงเรียน": ["ถึง", "โรงเรียน"],
  "ปิดรอบ": ["ปิด", "รอบ"],
  "ออกจากโรงเรียน": ["ออกจาก", "โรงเรียน"],
  "กำลังส่ง": ["กำลัง", "ส่ง"],
  "ส่งครบ": ["ส่ง", "ครบ"],
};

type Trip = {
  id: string;
  period: "MORNING" | "EVENING";
  plannedStartTime: string;
  routeName: string;
  vehiclePlate: string;
  status: string;
  counts: { total: number; boarded: number };
  checkpoints: { arrivedSchool: boolean; leftSchool: boolean };
};

export function TripCard({ trip, href, action }: { trip: Trip; href: string; action: string }) {
  const steps = trip.period === "MORNING" ? MORNING_STEPS : EVENING_STEPS;
  const active = runStepIndex({
    status: trip.status,
    arrivedSchool: trip.checkpoints.arrivedSchool,
    leftSchool: trip.checkpoints.leftSchool,
    boarded: trip.counts.boarded,
  });
  const title = trip.period === "MORNING" ? "ไปโรงเรียน" : "กลับบ้าน";
  const state = trip.status === "COMPLETED" ? "จบแล้ว" : trip.status === "CANCELLED" ? "ยกเลิก" : trip.status === "IN_PROGRESS" ? "กำลังวิ่ง" : "รอออก";
  return (
    <section className="trip-card">
      <div className="trip-top">
        <div className="trip-main">
          <p className="kicker"><Bus size={16} aria-hidden="true" /> {title}</p>
          <h2>{trip.plannedStartTime}</h2>
          <p className="muted">{trip.vehiclePlate}</p>
        </div>
        <div className="trip-side">
          <span className="people">{trip.counts.total}</span>
          <span className={trip.status === "CANCELLED" ? "pill bad" : "pill"}>{state}</span>
        </div>
      </div>
      <Stepper labels={steps} active={active} />
      <Link className="btn green" href={href}>{action}</Link>
    </section>
  );
}

export function Stepper({ labels, active }: { labels: readonly string[]; active: number }) {
  return (
    <ol className="stepper" aria-label="ความคืบหน้ารอบนี้">
      {labels.map((label, index) => {
        const [first, second] = stepLines[label] ?? [label, ""];
        return (
          <li key={label} className={active >= 0 && index <= active ? "on" : ""} aria-label={label}>
            <span />
            <em>{first}</em>
            <em>{second}</em>
          </li>
        );
      })}
    </ol>
  );
}
