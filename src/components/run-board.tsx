"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { actionLabel, checkpointLabel, type AttendanceEventType, type CheckpointKind, type RunPeriod } from "@/lib/labels";
import { buildDrivePlan, nextLegIndex } from "@/lib/drive-plan";

const RouteMap = dynamic(() => import("@/components/route-map"), { ssr: false });
import { forcedOffline } from "@/lib/browser-queue";
import { canShowConfirmed } from "@/lib/confirmation";
import { closeBlockers } from "@/lib/close-blockers";
import { submitOrQueue } from "@/lib/submit";

type StudentCard = {
  id: string;
  displayName: string;
  nickname: string;
  statusLabel: string;
  stopName: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  emergencyContactName: string;
  emergencyContactPhone: string;
  allergyNote: string | null;
  alternateReceiverName: string | null;
  sequence: number;
  status: string;
  disposition: string;
  allowedActions: AttendanceEventType[];
};

type RunView = {
  id: string;
  period: RunPeriod;
  periodLabel: string;
  status: string;
  routeName: string;
  schoolName: string;
  schoolLatitude: number | null;
  schoolLongitude: number | null;
  counts: { boarded: number; unconfirmed: number; onBoard: number; total: number };
  checkpoints: { arrivedSchool: boolean; leftSchool: boolean; finished: boolean };
  checks?: { preTrip: boolean; sweep: boolean };
  instructions?: { noShowContactInstruction: string; noReceiverInstruction: string };
  students: StudentCard[];
};

export function RunBoard({ run }: { run: RunView }) {
  const router = useRouter();
  const [parked, setParked] = useState(false);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"ok" | "warn" | "bad">("warn");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const keys = useRef(new Map<string, string>());
  const [confirming, setConfirming] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [receiver, setReceiver] = useState("");
  const [resolved, setResolved] = useState<Record<string, string>>({});
  const students = run.students.map((student) => {
    const status = resolved[student.id];
    if (!status || status === student.status) return student;
    return { ...student, status, allowedActions: [] as AttendanceEventType[] };
  });
  const plan = buildDrivePlan({
    period: run.period,
    arrivedSchool: run.checkpoints.arrivedSchool,
    schoolName: run.schoolName,
    schoolLatitude: run.schoolLatitude,
    schoolLongitude: run.schoolLongitude,
    students,
  });
  const legIndex = nextLegIndex(plan.points);
  useEffect(() => {
    if (!message) return;
    const show = tone === "ok" ? toast.success : tone === "bad" ? toast.error : toast.warning;
    show(message, { id: "run-feedback" });
  }, [message, tone]);

  function idempotency(slot: string, reuse: boolean): string {
    if (!reuse || !keys.current.get(slot)) keys.current.set(slot, crypto.randomUUID());
    return keys.current.get(slot)!;
  }

  async function send(slot: string, url: string, payload: Record<string, unknown>, operationType: "ATTENDANCE" | "ABSENCE", reuse: boolean): Promise<boolean> {
    if (busyKey) return false;
    setBusyKey(slot);
    setMessage("");
    const result = await submitOrQueue({
      url,
      operationType,
      idempotencyKey: String(payload.idempotencyKey ?? idempotency(slot, reuse)),
      payload,
    });
    if (result.kind === "confirmed") {
      keys.current.delete(slot);
      setTone("ok");
      setConfirming(null);
      setNote("");
      setReceiver("");
      setMessage(result.message);
      setBusyKey(null);
      router.refresh();
      return true;
    } else if (result.kind === "queued") {
      keys.current.delete(slot);
      setTone("warn");
    } else if (result.kind === "unknown") {
      setTone("warn");
    } else {
      keys.current.delete(slot);
      setTone("bad");
    }
    setMessage(result.message);
    setBusyKey(null);
    return false;
  }

  async function record(student: StudentCard, eventType: AttendanceEventType) {
    const slot = `${student.id}:${eventType}`;
    const needsConfirm = eventType === "NO_SHOW" || eventType === "EXCUSE";
    if (needsConfirm && confirming !== slot) {
      setConfirming(slot);
      setMessage("ตรวจอีกครั้งก่อนบันทึกเหตุการณ์นี้");
      setTone("warn");
      return;
    }
    if ((eventType === "DELAY" || eventType === "EXCUSE") && note.trim().length < 3) {
      setMessage("โปรดระบุรายละเอียดอย่างน้อย 3 ตัวอักษร");
      setTone("bad");
      return;
    }
    if (eventType === "ALTERNATE_RECEIVER" && receiver.trim().length < 2) {
      setMessage("โปรดระบุชื่อผู้รับแทน");
      setTone("bad");
      return;
    }
    const finishesStop = ["BOARD", "ALIGHT", "NO_SHOW", "EXCUSE"].includes(eventType)
      && plan.next.studentIds.length === 1
      && plan.next.studentIds[0] === student.id;
    const idempotencyKey = idempotency(slot, false);
    const confirmed = await send(slot, `/api/runs/${run.id}/events`, {
      runId: run.id,
      studentId: student.id,
      eventType,
      idempotencyKey,
      note: note.trim() || undefined,
      alternateReceiverName: receiver.trim() || undefined,
      clientRecordedAt: new Date().toISOString(),
    }, "ATTENDANCE", false);
    if (!confirmed) return;
    const status = eventType === "BOARD" ? "BOARDED" : eventType === "ALIGHT" ? "ALIGHTED" : eventType === "NO_SHOW" ? "NO_SHOW" : eventType === "EXCUSE" ? "EXCUSED" : null;
    if (status) setResolved((current) => ({ ...current, [student.id]: status }));
    if (!finishesStop || !status) return;
    const preview = buildDrivePlan({
      period: run.period,
      arrivedSchool: run.checkpoints.arrivedSchool,
      schoolName: run.schoolName,
      schoolLatitude: run.schoolLatitude,
      schoolLongitude: run.schoolLongitude,
      students: students.map((item) => item.id === student.id ? { ...item, status } : item),
    });
    setParked(false);
    setTone("ok");
    setMessage(preview.next.kind === "done" ? "จุดที่ต้องแวะครบแล้ว" : `ต่อไป ${preview.next.title}`);
    requestAnimationFrame(() => document.querySelector(".map-frame")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  async function checkpoint(kind: CheckpointKind) {
    const slot = `checkpoint:${kind}`;
    if (confirming !== slot) {
      setConfirming(slot);
      setMessage("ตรวจรายชื่ออีกครั้ง ระบบจะปิดรอบก็ต่อเมื่อเซิร์ฟเวอร์ยืนยันว่าครบ");
      setTone("warn");
      return;
    }
    if (forcedOffline() || !navigator.onLine) {
      setTone("warn");
      setMessage("ตรวจรอบขณะออฟไลน์ไม่ได้ และยังไม่ได้บันทึก");
      return;
    }
    setBusyKey(slot);
    try {
      const response = await fetch(`/api/runs/${run.id}/checkpoints`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const body = await response.json().catch(() => null);
      if (canShowConfirmed(body)) {
        setTone("ok");
        setMessage("เซิร์ฟเวอร์ยืนยันการตรวจแล้ว");
        setConfirming(null);
        router.refresh();
      } else {
        const missing = body?.error?.details?.missing;
        const names = Array.isArray(missing) ? missing.map((item: { name?: string }) => item.name).filter(Boolean).join(", ") : "";
        setTone("bad");
        setMessage(names ? `${body?.error?.message ?? "ยังตรวจไม่ผ่าน"}: ${names}` : body?.error?.message ?? "ยังไม่ได้ยืนยันการตรวจ");
      }
    } catch {
      setTone("warn");
      setMessage("ส่งไม่ถึงเซิร์ฟเวอร์ รอบนี้ยังไม่ถูกปิด");
    } finally {
      setBusyKey(null);
    }
  }

  const nextStudents = students.filter((student) => plan.next.studentIds.includes(student.id));
  const laterStudents = students.filter((student) => !plan.next.studentIds.includes(student.id));

  const schoolKind: CheckpointKind = run.period === "MORNING" ? "ARRIVED_SCHOOL" : "LEFT_SCHOOL";
  const schoolDone = run.period === "MORNING" ? run.checkpoints.arrivedSchool : run.checkpoints.leftSchool;
  const blockers = closeBlockers({
    period: run.period,
    schoolDone,
    preTrip: run.checks?.preTrip === true,
    sweep: run.checks?.sweep === true,
    students,
  });
  const currentId = students.find((student) => student.disposition === "UNKNOWN" || student.disposition === "BOARDED" || student.status === "WAITING" || student.status === "BOARDED")?.id;

  return (
    <div className={parked ? "stack" : "stack has-dock"}>
      <div className="safety">{parked ? "ขับตามแผนที่ จอดก่อน แล้วค่อยกดยืนยัน" : "จอดรถก่อนเช็คเด็ก เส้นบนแผนที่เป็นทางขับคร่าวๆ ไม่ใช่หลักฐานว่าเด็กขึ้นหรือลงรถ"}</div>
      {parked ? null : (
        <section className="card stack">
          <p className="kicker">{legIndex == null ? "จุดถัดไป" : "กำลังไปจุดถัดไป"}</p>
          <h1>{plan.next.title}</h1>
          <p>{plan.next.detail}</p>
        </section>
      )}
      <RouteMap points={plan.points} legIndex={parked ? null : legIndex} />
      {parked ? (
        <>
      <section className="card stack">
        <p className="kicker">จุดนี้</p>
        <div className="row">
          <h1>{plan.next.title}</h1>
          <span className="pill">{run.counts.onBoard} คนบนรถ</span>
        </div>
        <p>{plan.next.detail}</p>
      </section>
      {message ? <div className={`banner ${tone}`} role="status">{message}</div> : null}
      {nextStudents.map((student) => (
        <article className={student.id === currentId ? "card stack current" : "card stack"} key={student.id}>
          <h2>{student.displayName}</h2>
          <div className="status-pill">{student.statusLabel}</div>
          <div>{run.period === "MORNING" ? "จุดรับ" : "จุดส่ง"}: {student.stopName}</div>
          {student.allergyNote ? <div className="banner warn">ข้อมูลที่คนขับต้องรู้: {student.allergyNote}</div> : null}
          {student.alternateReceiverName ? <div>ผู้รับแทน: {student.alternateReceiverName}</div> : null}
          <div className="actions">
            {student.allowedActions.includes("BOARD") ? (
              <button className="btn green" type="button" disabled={busyKey !== null} onClick={() => void record(student, "BOARD")}>
                {actionLabel("BOARD", run.period)}
              </button>
            ) : null}
            {student.allowedActions.includes("ALIGHT") ? (
              <button className="btn blue" type="button" disabled={busyKey !== null} onClick={() => void record(student, "ALIGHT")}>
                {actionLabel("ALIGHT", run.period)}
              </button>
            ) : null}
            <a className="btn" href={`tel:${student.emergencyContactPhone}`}>
              โทรผู้ปกครอง
            </a>
          </div>
          <details>
            <summary>บันทึกเหตุการณ์</summary>
            <div className="stack">
              <label className="field">
                รายละเอียด
                <input className="text-input" value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
              <label className="field">
                ชื่อผู้รับแทน
                <input className="text-input" value={receiver} onChange={(event) => setReceiver(event.target.value)} />
              </label>
              {student.allowedActions.includes("NO_SHOW") ? (
                <button className="btn danger" type="button" disabled={busyKey !== null} onClick={() => void record(student, "NO_SHOW")}>
                  {confirming === `${student.id}:NO_SHOW` ? "ยืนยันว่าเด็กไม่อยู่" : "เด็กไม่อยู่"}
                </button>
              ) : null}
              {student.allowedActions.includes("EXCUSE") ? (
                <button className="btn" type="button" disabled={busyKey !== null} onClick={() => void record(student, "EXCUSE")}>
                  {confirming === `${student.id}:EXCUSE` ? "ยืนยันว่าผู้ปกครองแจ้งหยุด" : "ผู้ปกครองแจ้งหยุด"}
                </button>
              ) : null}
              {student.allowedActions.includes("DELAY") ? (
                <button className="btn" type="button" disabled={busyKey !== null} onClick={() => void record(student, "DELAY")}>
                  รถล่าช้า
                </button>
              ) : null}
              {student.allowedActions.includes("ALTERNATE_RECEIVER") ? (
                <button className="btn" type="button" disabled={busyKey !== null} onClick={() => void record(student, "ALTERNATE_RECEIVER")}>
                  บันทึกผู้รับแทน
                </button>
              ) : null}
            </div>
          </details>
        </article>
      ))}
      {laterStudents.length > 0 ? (
        <details className="card">
          <summary>จุดอื่นอีก {laterStudents.length} คน</summary>
          <ol className="list">
            {laterStudents.map((student) => (
              <li key={student.id}>
                <strong>{student.nickname}</strong> · {student.stopName} · {student.statusLabel}
                <div className="actions">
                  {student.allowedActions.includes("BOARD") ? (
                    <button className="btn green" type="button" disabled={busyKey !== null} onClick={() => void record(student, "BOARD")}>
                      {actionLabel("BOARD", run.period)}
                    </button>
                  ) : null}
                  {student.allowedActions.includes("ALIGHT") ? (
                    <button className="btn blue" type="button" disabled={busyKey !== null} onClick={() => void record(student, "ALIGHT")}>
                      {actionLabel("ALIGHT", run.period)}
                    </button>
                  ) : null}
                  <a className="btn" href={`tel:${student.emergencyContactPhone}`}>โทรผู้ปกครอง</a>
                </div>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {run.status !== "COMPLETED" ? (
        <section className="card stack">
          {run.instructions ? <p>{run.instructions.noShowContactInstruction}</p> : null}
          {run.instructions ? <p>{run.instructions.noReceiverInstruction}</p> : null}
          <InspectionForm runId={run.id} kind="PRE_TRIP" done={run.checks?.preTrip === true} label="ตรวจความพร้อมก่อนออก" />
          <button className="btn" type="button" disabled={busyKey !== null || schoolDone} onClick={() => void checkpoint(schoolKind)}>
            {confirming === `checkpoint:${schoolKind}` ? "ยืนยันการตรวจ" : checkpointLabel(schoolKind, run.period)}
          </button>
          <InspectionForm runId={run.id} kind="EMPTY_SWEEP" done={run.checks?.sweep === true} label="ตรวจว่ารถว่าง ไม่มีเด็กค้าง" />
          {blockers.length > 0 ? (
            <div className="banner bad" role="status">
              <strong>ยังปิดรอบไม่ได้</strong>
              <ol className="steps">
                {blockers.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
          ) : null}
          <button className="btn green" type="button" disabled={busyKey !== null || blockers.length > 0 || run.checkpoints.finished} onClick={() => void checkpoint("RUN_FINISHED")}>
            {confirming === "checkpoint:RUN_FINISHED" ? "ยืนยันปิดรอบ" : checkpointLabel("RUN_FINISHED", run.period)}
          </button>
        </section>
      ) : (
        <div className="banner ok">รอบนี้ปิดแล้ว</div>
      )}
        </>
      ) : (
        <div className="dock">
          <button className="btn green" type="button" onClick={() => setParked(true)}>
            จอดแล้ว เริ่มเช็ค
          </button>
        </div>
      )}
    </div>
  );
}

function InspectionForm({ runId, kind, done, label }: { runId: string; kind: "PRE_TRIP" | "EMPTY_SWEEP"; done: boolean; label: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const items = kind === "PRE_TRIP"
    ? [["driverReady", "คนขับพร้อม"], ["vehicleReady", "รถพร้อม"], ["rosterReviewed", "ตรวจรายชื่อแล้ว"]]
    : [["aisle", "ทางเดิน"], ["seats", "ทุกที่นั่ง"], ["floor", "พื้นรถ"], ["rearDoor", "ประตูหลัง"]];
  if (done) return <div className="banner ok">{label} ผ่านแล้ว</div>;
  return (
    <form
      className="stack"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const payload = Object.fromEntries(items.map(([key]) => [key, form.get(key) === "on"]));
        if (forcedOffline() || !navigator.onLine) {
          setOk(false);
          setMessage("ยังส่งไม่ถึงเซิร์ฟเวอร์ จึงยังไม่บันทึกการตรวจ");
          return;
        }
        const response = await fetch(`/api/runs/${runId}/inspections`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind, items: payload, idempotencyKey: crypto.randomUUID() }),
        });
        const body = await response.json().catch(() => null);
        const confirmed = canShowConfirmed(body);
        setOk(confirmed);
        setMessage(confirmed ? "เซิร์ฟเวอร์ยืนยันการตรวจแล้ว" : body?.error?.message ?? "ยังไม่ได้ยืนยันการตรวจ");
        if (confirmed) router.refresh();
      }}
    >
      <h2>{label}</h2>
      {items.map(([key, text]) => (
        <label key={key} className="check"><input type="checkbox" name={key} /> {text}</label>
      ))}
      <button className="btn" type="submit">ส่งผลการตรวจ</button>
      {message ? <div className={ok ? "banner ok" : "banner bad"} role="status">{message}</div> : null}
    </form>
  );
}
