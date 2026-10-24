"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { canShowConfirmed } from "@/lib/confirmation";

async function postJson(url: string, method: string, payload: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

export function Feedback({ message, ok }: { message: string; ok: boolean | null }) {
  if (!message) return null;
  return <div className={ok ? "banner ok" : "banner bad"} role="status">{message}</div>;
}

export function StudentForm({
  schools,
  studentId,
  initial,
}: {
  schools: { id: string; name: string }[];
  studentId?: string;
  initial?: {
    prefix: string;
    firstName: string;
    lastName: string;
    nickname: string;
    schoolId: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    allergyNote: string | null;
    active?: boolean;
  };
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="card stack"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        const form = new FormData(event.currentTarget);
        const { body } = await postJson(studentId ? `/api/students/${studentId}` : "/api/students", studentId ? "PATCH" : "POST", {
          prefix: form.get("prefix"),
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          nickname: form.get("nickname"),
          schoolId: form.get("schoolId"),
          emergencyContactName: form.get("emergencyContactName"),
          emergencyContactPhone: form.get("emergencyContactPhone"),
          allergyNote: String(form.get("allergyNote") ?? ""),
          ...(studentId ? { active: form.get("active") === "on" } : {}),
        });
        const confirmed = canShowConfirmed(body);
        setOk(confirmed);
        setMessage(confirmed ? "บันทึกแล้ว" : body?.error?.message ?? "ยังไม่ได้บันทึก");
        if (confirmed) router.refresh();
        setPending(false);
      }}
    >
      <h2>{studentId ? "แก้ไขนักเรียน" : "เพิ่มนักเรียน"}</h2>
      <label className="field">คำนำหน้า
        <select className="text-input" name="prefix" defaultValue={initial?.prefix ?? "เด็กชาย"}>
          <option>เด็กชาย</option>
          <option>เด็กหญิง</option>
        </select>
      </label>
      <label className="field">ชื่อ<input className="text-input" name="firstName" defaultValue={initial?.firstName} required /></label>
      <label className="field">นามสกุล<input className="text-input" name="lastName" defaultValue={initial?.lastName} required /></label>
      <label className="field">ชื่อที่เรียก<input className="text-input" name="nickname" defaultValue={initial?.nickname} required /></label>
      <label className="field">โรงเรียน
        <select className="text-input" name="schoolId" defaultValue={initial?.schoolId ?? schools[0]?.id}>
          {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
        </select>
      </label>
      <label className="field">ชื่อผู้ติดต่อฉุกเฉิน<input className="text-input" name="emergencyContactName" defaultValue={initial?.emergencyContactName} required /></label>
      <label className="field">เบอร์ฉุกเฉิน<input className="text-input" name="emergencyContactPhone" defaultValue={initial?.emergencyContactPhone} required /></label>
      <label className="field">ข้อมูลที่คนขับต้องรู้<input className="text-input" name="allergyNote" defaultValue={initial?.allergyNote ?? ""} /></label>
      {studentId ? <label className="check"><input type="checkbox" name="active" defaultChecked={initial?.active !== false} /> ยังใช้บริการ</label> : null}
      <button className="btn green" disabled={pending} type="submit">{pending ? "กำลังบันทึก..." : "บันทึก"}</button>
      <Feedback message={message} ok={ok} />
    </form>
  );
}

export function SchoolForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  return (
    <form
      className="card stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const { body } = await postJson("/api/schools", "POST", { name: form.get("name"), address: form.get("address") });
        const confirmed = canShowConfirmed(body);
        setOk(confirmed);
        setMessage(confirmed ? "บันทึกโรงเรียนแล้ว" : body?.error?.message ?? "ยังไม่ได้บันทึก");
        if (confirmed) {
          event.currentTarget.reset();
          router.refresh();
        }
      }}
    >
      <h2>เพิ่มโรงเรียน</h2>
      <label className="field">ชื่อ<input className="text-input" name="name" required /></label>
      <label className="field">ที่อยู่<input className="text-input" name="address" required /></label>
      <button className="btn" type="submit">บันทึกโรงเรียน</button>
      <Feedback message={message} ok={ok} />
    </form>
  );
}

export function MoveStopButton({ routeId, stopId, direction, label, disabled = false }: { routeId: string; stopId: string; direction: -1 | 1; label: string; disabled?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  return (
    <div>
      <button
        className="btn small"
        type="button"
        disabled={disabled}
        onClick={async () => {
          const { body } = await postJson(`/api/routes/${routeId}/stops/${stopId}/move`, "POST", { direction });
          if (canShowConfirmed(body)) {
            setMessage("");
            router.refresh();
          } else setMessage(body?.error?.message ?? "ยังไม่ได้เลื่อนจุด");
        }}
      >
        {label}
      </button>
      {message ? <div className="banner bad">{message}</div> : null}
    </div>
  );
}

export function StopForm({ routeId }: { routeId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const { body } = await postJson(`/api/routes/${routeId}/stops`, "POST", { name: form.get("name"), address: form.get("address") });
        const confirmed = canShowConfirmed(body);
        setOk(confirmed);
        setMessage(confirmed ? "เพิ่มจุดแล้ว" : body?.error?.message ?? "ยังไม่ได้เพิ่มจุด");
        if (confirmed) {
          event.currentTarget.reset();
          router.refresh();
        }
      }}
    >
      <label className="field">ชื่อจุด<input className="text-input" name="name" required /></label>
      <label className="field">ที่อยู่<input className="text-input" name="address" required /></label>
      <button className="btn" type="submit">เพิ่มจุด</button>
      <Feedback message={message} ok={ok} />
    </form>
  );
}

export function VehicleForm({ vehicle }: { vehicle: { id: string; plateNumber: string; label: string; capacity: number } }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const { body } = await postJson(`/api/vehicles/${vehicle.id}`, "PATCH", {
          plateNumber: form.get("plateNumber"),
          label: form.get("label"),
          capacity: Number(form.get("capacity")),
        });
        const confirmed = canShowConfirmed(body);
        setOk(confirmed);
        setMessage(confirmed ? "บันทึกข้อมูลรถแล้ว" : body?.error?.message ?? "ยังไม่ได้บันทึก");
        if (confirmed) router.refresh();
      }}
    >
      <label className="field">ทะเบียน<input className="text-input" name="plateNumber" defaultValue={vehicle.plateNumber} required /></label>
      <label className="field">ชื่อรถ<input className="text-input" name="label" defaultValue={vehicle.label} required /></label>
      <label className="field">ความจุ<input className="text-input" name="capacity" type="number" min={1} max={30} defaultValue={vehicle.capacity} required /></label>
      <button className="btn" type="submit">บันทึกรถ</button>
      <Feedback message={message} ok={ok} />
    </form>
  );
}

export function AssignmentForm({
  routes,
  studentId,
}: {
  studentId: string;
  routes: { id: string; name: string; stops: { id: string; name: string; sequence: number }[] }[];
}) {
  const router = useRouter();
  const [routeId, setRouteId] = useState(routes[0]?.id ?? "");
  const route = routes.find((item) => item.id === routeId) ?? routes[0];
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  if (!route) return null;
  return (
    <form
      className="card stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const { body } = await postJson("/api/assignments", "POST", {
          studentId,
          routeId: route.id,
          pickupStopId: form.get("pickupStopId"),
          dropoffStopId: form.get("dropoffStopId"),
        });
        const confirmed = canShowConfirmed(body);
        setOk(confirmed);
        setMessage(confirmed ? "บันทึกจุดรับส่งแล้ว" : body?.error?.message ?? "ยังไม่ได้บันทึก");
        if (confirmed) router.refresh();
      }}
    >
      <h2>กำหนดจุดรับส่ง</h2>
      <label className="field">เส้นทาง
        <select className="text-input" value={routeId} onChange={(event) => setRouteId(event.target.value)}>
          {routes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="field">จุดรับ
        <select className="text-input" name="pickupStopId" defaultValue={route.stops[0]?.id}>
          {route.stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.sequence}. {stop.name}</option>)}
        </select>
      </label>
      <label className="field">จุดส่ง
        <select className="text-input" name="dropoffStopId" defaultValue={route.stops.at(-1)?.id}>
          {route.stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.sequence}. {stop.name}</option>)}
        </select>
      </label>
      <button className="btn green" type="submit">บันทึกจุด</button>
      <Feedback message={message} ok={ok} />
    </form>
  );
}

export function InvoiceForms({ students }: { students: { id: string; displayName: string }[] }) {
  const router = useRouter();
  const key = useRef(crypto.randomUUID());
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  return (
    <div className="stack">
      <form
        className="card stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const { body } = await postJson("/api/invoices", "POST", {
            studentId: form.get("studentId"),
            yearMonth: form.get("yearMonth"),
            amountBaht: form.get("amountBaht"),
          });
          const confirmed = canShowConfirmed(body);
          setOk(confirmed);
          setMessage(confirmed ? "สร้างยอดค่าโดยสารแล้ว" : body?.error?.message ?? "ยังไม่ได้สร้างยอด");
          if (confirmed) router.refresh();
        }}
      >
        <h2>สร้างยอดรายเดือน</h2>
        <label className="field">เด็ก
          <select className="text-input" name="studentId">
            {students.map((student) => <option key={student.id} value={student.id}>{student.displayName}</option>)}
          </select>
        </label>
        <label className="field">เดือน<input className="text-input" name="yearMonth" placeholder="2026-10" required /></label>
        <label className="field">จำนวนบาท<input className="text-input" name="amountBaht" inputMode="decimal" required /></label>
        <button className="btn" type="submit">สร้างยอด</button>
      </form>
      <form
        className="card stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const payload = {
            invoiceId: form.get("invoiceId"),
            amountBaht: form.get("amountBaht"),
            method: form.get("method"),
            note: form.get("note") || undefined,
            idempotencyKey: key.current,
          };
          const { body } = await postJson("/api/payments", "POST", payload);
          const confirmed = canShowConfirmed(body);
          setOk(confirmed);
          setMessage(confirmed ? "บันทึกการรับเงินแล้ว" : body?.error?.message ?? "ยังไม่ได้บันทึกการรับเงิน");
          if (confirmed || body?.error) key.current = crypto.randomUUID();
          if (confirmed) router.refresh();
        }}
      >
        <h2>บันทึกรับเงิน</h2>
        <label className="field">รหัสยอด<input className="text-input" name="invoiceId" required /></label>
        <label className="field">จำนวนบาท<input className="text-input" name="amountBaht" inputMode="decimal" required /></label>
        <label className="field">วิธี
          <select className="text-input" name="method" defaultValue="CASH">
            <option value="CASH">เงินสด</option>
            <option value="TRANSFER">โอน</option>
            <option value="OTHER">อื่น ๆ</option>
          </select>
        </label>
        <label className="field">หมายเหตุ<input className="text-input" name="note" /></label>
        <button className="btn green" type="submit">บันทึกรับเงิน</button>
        <p className="muted">ยังไม่เชื่อมเกตเวย์ชำระเงิน เจ้าของบันทึกเงินสดหรือยอดโอนเอง</p>
      </form>
      <Feedback message={message} ok={ok} />
    </div>
  );
}

export function AcknowledgeButton({ absenceId }: { absenceId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  return (
    <div>
      <button
        className="btn small"
        type="button"
        onClick={async () => {
          const { body } = await postJson(`/api/absences/${absenceId}/acknowledge`, "POST", {});
          if (canShowConfirmed(body)) router.refresh();
          else setMessage(body?.error?.message ?? "ยังไม่ได้รับทราบ");
        }}
      >
        รับทราบ
      </button>
      {message ? <div className="banner bad">{message}</div> : null}
    </div>
  );
}
