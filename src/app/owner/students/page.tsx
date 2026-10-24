import Link from "next/link";
import { SchoolForm, StudentForm } from "@/components/owner-forms";
import { Shell } from "@/components/shell";
import { requirePageActor } from "@/lib/current";
import { listSchools, listStudents } from "@/server/roster";

export default async function StudentsPage() {
  const actor = await requirePageActor(["OWNER"]);
  const [students, schools] = await Promise.all([listStudents(actor), listSchools(actor)]);
  return (
    <Shell actor={actor} wide>
      <div className="stack">
        <h1>นักเรียน</h1>
        <StudentForm schools={schools.map((school) => ({ id: school.id, name: school.name }))} />
        <SchoolForm />
        <ul className="list">
          {students.map((student) => (
            <li className="card" key={student.id}>
              <strong>{student.displayName}</strong> ({student.nickname}) · {student.schoolName}
              <div className="muted">{student.active ? "ใช้งาน" : "ปิดใช้งาน"} · ฉุกเฉิน {student.emergencyContactName}</div>
              <Link className="btn" href={`/owner/students/${student.id}`}>แก้ไข</Link>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}
