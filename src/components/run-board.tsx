"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { actionLabel, checkpointLabel, type AttendanceEventType, type CheckpointKind, type RunPeriod } from "@/lib/labels";
import { externalNavigationUrl } from "@/lib/navigation";
import { forcedOffline } from "@/lib/browser-queue";
import { canShowConfirmed } from "@/lib/confirmation";
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
  allowedActions: AttendanceEventType[];
};

type RunView = {
  id: string;
  period: RunPeriod;
  periodLabel: string;
  status: string;
  routeName: string;
  schoolName: string;
  counts: { boarded: number; unconfirmed: number; onBoard: number; total: number };
  checkpoints: { arrivedSchool: boolean; leftSchool: boolean; finished: boolean };
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

  function idempotency(slot: string, reuse: boolean): string {
    if (!reuse || !keys.current.get(slot)) keys.current.set(slot, crypto.randomUUID());
    return keys.current.get(slot)!;
  }

  async function send(slot: string, url: string, payload: Record<string, unknown>, operationType: "ATTENDANCE" | "ABSENCE", reuse: boolean) {
    if (busyKey) return;
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
      router.refresh();
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
    const idempotencyKey = idempotency(slot, false);
    await send(slot, `/api/runs/${run.id}/events`, {
      runId: run.id,
      studentId: student.id,
      eventType,
      idempotencyKey,
      note: note.trim() || undefined,
      alternateReceiverName: receiver.trim() || undefined,
      clientRecordedAt: new Date().toISOString(),
    }, "ATTENDANCE", false);
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

  if (!parked) {
    return (
      <div className="stack">
        <div className="safety">
          จอดรถก่อนใช้งาน ปุ่มบันทึกสถานะเด็กจะยังไม่ทำงาน
          การเปิดทางนำร่องไม่ใช่หลักฐานว่าเด็กขึ้นหรือลงรถ
        </div>
        <section className="card stack">
          <h1>{run.periodLabel}</h1>
          <p>{run.routeName} · {run.schoolName}</p>
          <div className="counts">
            <div className="count"><b>{run.counts.boarded}</b><span>ขึ้นรถแล้ว</span></div>
            <div className="count"><b>{run.counts.unconfirmed}</b><span>ยังไม่ยืนยัน</span></div>
          </div>
          <ol className="list">
            {run.students.map((student, index) => (
              <li key={student.id}>
                {index + 1}. {student.nickname} · {student.stopName} · {student.statusLabel}
              </li>
            ))}
          </ol>
          <button className="btn green" type="button" onClick={() => setParked(true)}>
            ฉันจอดรถแล้ว
          </button>
        </section>
      </div>
    );
  }

  const schoolKind: CheckpointKind = run.period === "MORNING" ? "ARRIVED_SCHOOL" : "LEFT_SCHOOL";
  const schoolDone = run.period === "MORNING" ? run.checkpoints.arrivedSchool : run.checkpoints.leftSchool;

  return (
    <div className="stack">
      <div className="safety">โหมดจอดรถ — ถ้าจะขับต่อ ให้เปิดแผนที่แล้ววางโทรศัพท์ ปุ่มบันทึกจะล็อกอีกครั้ง</div>
      <section className="card">
        <div className="row">
          <h1>{run.periodLabel}</h1>
          <span>{run.counts.onBoard} คนบนรถ</span>
        </div>
        <div className="counts">
          <div className="count"><b>{run.counts.boarded}</b><span>ขึ้นรถแล้ว</span></div>
          <div className="count"><b>{run.counts.unconfirmed}</b><span>ยังไม่ยืนยัน</span></div>
        </div>
      </section>
      {message ? <div className={`banner ${tone}`} role="status">{message}</div> : null}
      {run.students.map((student) => (
        <article className="card stack" key={student.id}>
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
            <button
              className="btn"
              type="button"
              onClick={() => {
                setParked(false);
                window.open(externalNavigationUrl(student), "_blank", "noopener,noreferrer");
              }}
            >
              เปิดทางนำร่องแล้ววางโทรศัพท์
            </button>
            <a className="btn" href={`tel:${student.emergencyContactPhone}`}>
              โทร {student.emergencyContactName}
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
      {run.status !== "COMPLETED" ? (
        <section className="card stack">
          <button className="btn" type="button" disabled={busyKey !== null || schoolDone} onClick={() => void checkpoint(schoolKind)}>
            {confirming === `checkpoint:${schoolKind}` ? "ยืนยันการตรวจ" : checkpointLabel(schoolKind, run.period)}
          </button>
          <button className="btn green" type="button" disabled={busyKey !== null || !schoolDone || run.checkpoints.finished} onClick={() => void checkpoint("RUN_FINISHED")}>
            {confirming === "checkpoint:RUN_FINISHED" ? "ยืนยันปิดรอบ" : checkpointLabel("RUN_FINISHED", run.period)}
          </button>
        </section>
      ) : (
        <div className="banner ok">รอบนี้ปิดแล้ว</div>
      )}
    </div>
  );
}
