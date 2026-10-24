import Link from "next/link";

export default function NotFound() {
  return (
    <main className="screen">
      <section className="card stack">
        <h1>ไม่พบข้อมูล</h1>
        <p>รายการนี้ไม่มี หรือบัญชีนี้ไม่มีสิทธิ์ดู</p>
        <Link className="btn" href="/">กลับหน้าแรก</Link>
      </section>
    </main>
  );
}
