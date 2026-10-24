"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { canShowConfirmed } from "@/lib/confirmation";

async function send(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  return { confirmed: canShowConfirmed(body), message: canShowConfirmed(body) ? "บันทึกแล้ว" : body?.error?.message ?? "ยังไม่ได้บันทึก" };
}

export function LeadCreateForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  return (
    <form
      className="card stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = await send("/api/leads", {
          guardianName: form.get("guardianName"),
          phone: form.get("phone"),
          childNickname: form.get("childNickname"),
          schoolName: form.get("schoolName"),
          note: form.get("note") || undefined,
        });
        setOk(result.confirmed);
        setMessage(result.message);
        if (result.confirmed) router.refresh();
      }}
    >
      <h2>ลูกค้าใหม่</h2>
      <p className="muted">รายการนี้ยังไม่ใช่นักเรียน และยังไม่เข้าตารางรับส่ง</p>
      <label className="field">ชื่อผู้ปกครอง<input className="text-input" name="guardianName" required /></label>
      <label className="field">เบอร์โทร<input className="text-input" name="phone" inputMode="tel" required /></label>
      <label className="field">ชื่อเล่นเด็ก<input className="text-input" name="childNickname" required /></label>
      <label className="field">โรงเรียน<input className="text-input" name="schoolName" required /></label>
      <label className="field">บันทึก<textarea className="text-input" name="note" rows={2} /></label>
      <button className="btn green" type="submit">บันทึกผู้สนใจ</button>
      {message ? <div className={ok ? "banner ok" : "banner bad"} role="status">{message}</div> : null}
    </form>
  );
}

export function AccountForm({ students }: { students: { id: string; displayName: string }[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  return (
    <form
      className="card stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = await send("/api/accounts", {
          role: form.get("role"),
          name: form.get("name"),
          phone: form.get("phone"),
          password: form.get("password"),
          studentId: form.get("studentId") || undefined,
          relationship: form.get("relationship") || undefined,
        });
        setOk(result.confirmed);
        setMessage(result.message);
        if (result.confirmed) router.refresh();
      }}
    >
      <h2>เปิดบัญชี</h2>
      <label className="field">บทบาท
        <select className="text-input" name="role" defaultValue="GUARDIAN">
          <option value="GUARDIAN">ผู้ปกครอง</option>
          <option value="DRIVER">คนขับ</option>
        </select>
      </label>
      <label className="field">ชื่อ<input className="text-input" name="name" required /></label>
      <label className="field">เบอร์โทร<input className="text-input" name="phone" inputMode="tel" required /></label>
      <label className="field">รหัสผ่าน<input className="text-input" name="password" type="password" minLength={8} required /></label>
      <label className="field">ผูกกับนักเรียน
        <select className="text-input" name="studentId" defaultValue="">
          <option value="">ไม่ผูกตอนนี้</option>
          {students.map((student) => <option key={student.id} value={student.id}>{student.displayName}</option>)}
        </select>
      </label>
      <label className="field">ความสัมพันธ์<input className="text-input" name="relationship" placeholder="มารดา" /></label>
      <button className="btn green" type="submit">สร้างบัญชี</button>
      {message ? <div className={ok ? "banner ok" : "banner bad"} role="status">{message}</div> : null}
    </form>
  );
}

export function HolidayForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  return (
    <form
      className="card stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = await send("/api/calendar", {
          serviceDate: form.get("serviceDate"),
          kind: form.get("kind"),
          affectsMorning: form.get("affectsMorning") === "on",
          affectsEvening: form.get("affectsEvening") === "on",
          note: form.get("note"),
        });
        setOk(result.confirmed);
        setMessage(result.message);
        if (result.confirmed) router.refresh();
      }}
    >
      <h2>วันหยุดหรือรถใช้ไม่ได้</h2>
      <label className="field">วันที่<input className="text-input" type="date" name="serviceDate" required /></label>
      <label className="field">ประเภท
        <select className="text-input" name="kind" defaultValue="HOLIDAY">
          <option value="HOLIDAY">วันหยุด</option>
          <option value="SCHOOL_TIME_CHANGE">โรงเรียนเปลี่ยนเวลา</option>
          <option value="VEHICLE_UNAVAILABLE">รถใช้ไม่ได้</option>
          <option value="DRIVER_UNAVAILABLE">คนขับป่วยหรือลา</option>
        </select>
      </label>
      <label className="check"><input type="checkbox" name="affectsMorning" defaultChecked /> รอบเช้า</label>
      <label className="check"><input type="checkbox" name="affectsEvening" defaultChecked /> รอบเย็น</label>
      <label className="field">รายละเอียด<input className="text-input" name="note" required /></label>
      <button className="btn" type="submit">บันทึกและปรับรอบที่ยังไม่ออก</button>
      {message ? <div className={ok ? "banner ok" : "banner bad"} role="status">{message}</div> : null}
    </form>
  );
}

export function PublishForm({ routeId }: { routeId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const response = await fetch(`/api/routes/${routeId}/publish`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            schoolDeadline: form.get("schoolDeadline"),
            acceptUnverifiedTiming: form.get("acceptUnverifiedTiming") === "on",
          }),
        });
        const body = await response.json().catch(() => null);
        const confirmed = canShowConfirmed(body);
        setOk(confirmed);
        setMessage(confirmed
          ? body.estimateStatus === "ESTIMATED"
            ? "เผยแพร่แล้ว เวลาเป็นค่าประมาณและไม่รับประกัน"
            : "เผยแพร่แล้ว โดยยังไม่มีเวลาคำนวณจากเซิร์ฟเวอร์เส้นทาง"
          : body?.error?.message ?? "ยังไม่ได้เผยแพร่");
        if (confirmed) router.refresh();
      }}
    >
      <label className="field">เวลาถึงโรงเรียนที่ต้องการ<input className="text-input" name="schoolDeadline" defaultValue="07:30" required /></label>
      <label className="check"><input type="checkbox" name="acceptUnverifiedTiming" /> ยอมเผยแพร่ทั้งที่ยังคำนวณเวลาไม่ได้</label>
      <button className="btn" type="submit">ตรวจและเผยแพร่เส้นทาง</button>
      {message ? <div className={ok ? "banner ok" : "banner bad"} role="status">{message}</div> : null}
    </form>
  );
}

const NEXT_STEP: Record<string, { to: string; label: string }> = {
  LEAD: { to: "SURVEY_SCHEDULED", label: "นัดสำรวจ" },
  SURVEY_SCHEDULED: { to: "LOCATION_PENDING_VERIFICATION", label: "ส่งจุดให้คนตรวจ" },
  LOCATION_PENDING_VERIFICATION: { to: "ROUTE_ASSESSMENT", label: "บันทึกผลดูเส้นทาง" },
  ROUTE_ASSESSMENT: { to: "QUOTE_PENDING", label: "ไปขั้นเสนอราคา" },
  QUOTE_PENDING: { to: "AGREEMENT_PENDING", label: "บันทึกราคาที่เสนอ" },
  AGREEMENT_PENDING: { to: "REGISTRATION_PENDING", label: "ลูกค้ายืนยันข้อตกลง" },
  REGISTRATION_PENDING: { to: "SCHEDULE_PENDING", label: "ลงทะเบียนนักเรียน" },
  SCHEDULE_PENDING: { to: "READY_FOR_SERVICE", label: "ตรวจความพร้อมก่อนเริ่ม" },
  READY_FOR_SERVICE: { to: "ACTIVE", label: "เริ่มบริการ" },
  SUSPENDED: { to: "ACTIVE", label: "กลับมาให้บริการ" },
};

const OTHER_STEPS: Record<string, string[]> = {
  LEAD: ["REJECTED", "CANCELLED"],
  SURVEY_SCHEDULED: ["LEAD", "CANCELLED"],
  LOCATION_PENDING_VERIFICATION: ["SURVEY_SCHEDULED", "CANCELLED"],
  ROUTE_ASSESSMENT: ["LOCATION_PENDING_VERIFICATION", "REJECTED", "CANCELLED"],
  QUOTE_PENDING: ["ROUTE_ASSESSMENT", "REJECTED", "CANCELLED"],
  AGREEMENT_PENDING: ["QUOTE_PENDING", "CANCELLED"],
  REGISTRATION_PENDING: ["AGREEMENT_PENDING", "CANCELLED"],
  SCHEDULE_PENDING: ["REGISTRATION_PENDING", "CANCELLED"],
  READY_FOR_SERVICE: ["SCHEDULE_PENDING", "CANCELLED"],
  ACTIVE: ["SUSPENDED", "CANCELLED"],
  SUSPENDED: ["CANCELLED"],
  REJECTED: ["LEAD"],
  CANCELLED: ["LEAD"],
};

export function LeadStepForm({
  lead,
  schools,
}: {
  lead: { id: string; status: string; childNickname: string };
  schools: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const step = NEXT_STEP[lead.status];
  const others = OTHER_STEPS[lead.status] ?? [];

  async function submit(payload: Record<string, unknown>) {
    const result = await send(`/api/leads/${lead.id}/transition`, payload);
    setOk(result.confirmed);
    setMessage(result.message);
    if (result.confirmed) router.refresh();
  }

  return (
    <div className="stack">
      {step ? (
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const payload: Record<string, unknown> = { to: step.to };
            if (lead.status === "LEAD") payload.scheduledAt = new Date(String(form.get("scheduledAt"))).toISOString();
            if (lead.status === "LOCATION_PENDING_VERIFICATION") payload.assessmentNote = form.get("assessmentNote");
            if (lead.status === "QUOTE_PENDING") payload.quotedSatang = Math.round(Number(form.get("baht")) * 100);
            if (lead.status === "AGREEMENT_PENDING") payload.accept = true;
            if (lead.status === "REGISTRATION_PENDING") {
              payload.student = {
                prefix: form.get("prefix"),
                firstName: form.get("firstName"),
                lastName: form.get("lastName"),
                nickname: lead.childNickname,
                schoolId: form.get("schoolId"),
                emergencyContactName: form.get("emergencyContactName"),
                emergencyContactPhone: form.get("emergencyContactPhone"),
                gradeLevel: form.get("gradeLevel"),
                serviceStart: form.get("serviceStart"),
                consent: true,
              };
            }
            await submit(payload);
          }}
        >
          {lead.status === "LEAD" ? <label className="field">วันเวลานัดสำรวจ<input className="text-input" type="datetime-local" name="scheduledAt" required /></label> : null}
          {lead.status === "LOCATION_PENDING_VERIFICATION" ? <label className="field">ผลการดูเส้นทาง<textarea className="text-input" name="assessmentNote" minLength={5} required /></label> : null}
          {lead.status === "QUOTE_PENDING" ? <label className="field">ราคาที่เสนอ (บาท)<input className="text-input" name="baht" type="number" min={1} step={1} required /></label> : null}
          {lead.status === "AGREEMENT_PENDING" ? <p className="muted">กดเมื่อลูกค้ายืนยันข้อตกลงแล้วเท่านั้น</p> : null}
          {lead.status === "REGISTRATION_PENDING" ? (
            <>
              <label className="field">คำนำหน้า
                <select className="text-input" name="prefix" defaultValue="เด็กชาย"><option>เด็กชาย</option><option>เด็กหญิง</option></select>
              </label>
              <label className="field">ชื่อ<input className="text-input" name="firstName" required /></label>
              <label className="field">นามสกุล<input className="text-input" name="lastName" required /></label>
              <label className="field">โรงเรียน
                <select className="text-input" name="schoolId" required>
                  {schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
                </select>
              </label>
              <label className="field">ชั้น<input className="text-input" name="gradeLevel" required /></label>
              <label className="field">วันเริ่มบริการ<input className="text-input" type="date" name="serviceStart" required /></label>
              <label className="field">ผู้ติดต่อฉุกเฉิน<input className="text-input" name="emergencyContactName" required /></label>
              <label className="field">เบอร์ฉุกเฉิน<input className="text-input" name="emergencyContactPhone" inputMode="tel" required /></label>
              <p className="muted">การกดบันทึกถือว่าผู้ปกครองรับทราบนโยบายข้อมูล นักเรียนจะยังเป็นฉบับร่างและยังไม่เข้ารอบ</p>
            </>
          ) : null}
          <button className="btn green" type="submit">{step.label}</button>
        </form>
      ) : null}
      {others.length > 0 ? (
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            await submit({ to: form.get("to"), reason: form.get("reason") });
          }}
        >
          <label className="field">ย้อน ยกเลิก หรือพัก
            <select className="text-input" name="to" defaultValue={others[0]}>
              {others.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="field">เหตุผลอย่างน้อย 5 ตัวอักษร<input className="text-input" name="reason" minLength={5} required /></label>
          <button className="btn" type="submit">บันทึกการเปลี่ยนสถานะ</button>
        </form>
      ) : null}
      {message ? <div className={ok ? "banner ok" : "banner bad"} role="status">{message}</div> : null}
    </div>
  );
}

export function ServiceActions({ studentId, serviceStatus }: { studentId: string; serviceStatus: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const next: Record<string, string> = {
    DRAFT: "NEEDS_VERIFICATION",
    NEEDS_VERIFICATION: "VERIFIED",
    VERIFIED: "ACTIVE",
    SUSPENDED: "ACTIVE",
  };
  const target = next[serviceStatus];

  async function change(to: string, reason?: string) {
    const result = await send(`/api/students/${studentId}/service`, { to, reason });
    setOk(result.confirmed);
    setMessage(result.message);
    if (result.confirmed) router.refresh();
  }

  return (
    <div className="card stack">
      <h2>สถานะบริการ</h2>
      <p>ตอนนี้: {serviceStatus}</p>
      {target ? <button className="btn green" type="button" onClick={() => void change(target)}>ไปที่ {target}</button> : null}
      {serviceStatus === "ACTIVE" || serviceStatus === "SUSPENDED" ? (
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            await change(String(form.get("to")), String(form.get("reason")));
          }}
        >
          <label className="field">ปิดหรือพัก
            <select className="text-input" name="to" defaultValue="SUSPENDED">
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="ENDED">ENDED</option>
            </select>
          </label>
          <label className="field">เหตุผล<input className="text-input" name="reason" minLength={5} required /></label>
          <button className="btn" type="submit">บันทึก</button>
        </form>
      ) : null}
      {message ? <div className={ok ? "banner ok" : "banner bad"} role="status">{message}</div> : null}
    </div>
  );
}

export function ReceiverForm({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  return (
    <form
      className="card stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const result = await send(`/api/students/${studentId}/receivers`, {
          name: form.get("name"),
          relationship: form.get("relationship"),
          phone: form.get("phone") || undefined,
        });
        setOk(result.confirmed);
        setMessage(result.message);
        if (result.confirmed) router.refresh();
      }}
    >
      <h2>ผู้มีสิทธิ์รับเด็ก</h2>
      <label className="field">ชื่อ<input className="text-input" name="name" required /></label>
      <label className="field">ความสัมพันธ์<input className="text-input" name="relationship" required /></label>
      <label className="field">เบอร์โทร<input className="text-input" name="phone" inputMode="tel" /></label>
      <button className="btn" type="submit">เพิ่มผู้รับ</button>
      {message ? <div className={ok ? "banner ok" : "banner bad"} role="status">{message}</div> : null}
    </form>
  );
}
