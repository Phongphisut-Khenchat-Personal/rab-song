"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { bangkokYmd } from "@/lib/time";
import { submitOrQueue } from "@/lib/submit";

export function AbsenceForm({
  students,
}: {
  students: { id: string; displayName: string }[];
}) {
  const router = useRouter();
  const key = useRef(crypto.randomUUID());
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [startDate, setStartDate] = useState(bangkokYmd());
  const [endDate, setEndDate] = useState(bangkokYmd());
  const [reason, setReason] = useState("");
  const [morning, setMorning] = useState(true);
  const [evening, setEvening] = useState(true);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"ok" | "warn" | "bad">("warn");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="card stack"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        const result = await submitOrQueue({
          url: "/api/absences",
          operationType: "ABSENCE",
          idempotencyKey: key.current,
          payload: {
            studentId,
            startDate,
            endDate,
            reason,
            affectsMorning: morning,
            affectsEvening: evening,
            idempotencyKey: key.current,
          },
        });
        setTone(result.kind === "confirmed" ? "ok" : result.kind === "rejected" ? "bad" : "warn");
        setMessage(result.message);
        if (result.kind === "confirmed" || result.kind === "rejected" || result.kind === "queued") {
          key.current = crypto.randomUUID();
        }
        if (result.kind === "confirmed") router.refresh();
        setPending(false);
      }}
    >
      <h1>แจ้งงดใช้รถ</h1>
      <label className="field">
        เด็ก
        <select className="text-input" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
          {students.map((child) => (
            <option key={child.id} value={child.id}>{child.displayName}</option>
          ))}
        </select>
      </label>
      <label className="field">
        เริ่มวันที่
        <input className="text-input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
      </label>
      <label className="field">
        ถึงวันที่
        <input className="text-input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
      </label>
      <label className="field">
        เหตุผล
        <textarea className="text-input" value={reason} onChange={(event) => setReason(event.target.value)} required />
      </label>
      <label className="check"><input type="checkbox" checked={morning} onChange={(event) => setMorning(event.target.checked)} /> รอบเช้า</label>
      <label className="check"><input type="checkbox" checked={evening} onChange={(event) => setEvening(event.target.checked)} /> รอบเย็น</label>
      <button className="btn green" type="submit" disabled={pending || students.length === 0}>
        {pending ? "กำลังส่ง..." : "ส่งคำขอ"}
      </button>
      {message ? <div className={`banner ${tone}`} role="status">{message}</div> : null}
    </form>
  );
}
