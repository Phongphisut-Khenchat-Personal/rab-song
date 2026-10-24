import { AccountForm } from "@/components/workflow-forms";
import { Shell } from "@/components/shell";
import { requirePageActor } from "@/lib/current";
import { listStudents } from "@/server/roster";

export default async function AccountsPage() {
  const actor = await requirePageActor(["OWNER"]);
  const students = await listStudents(actor);
  return (
    <Shell actor={actor} wide>
      <div className="stack">
        <h1>บัญชีคนขับและผู้ปกครอง</h1>
        <AccountForm students={students.map((student) => ({ id: student.id, displayName: student.displayName }))} />
      </div>
    </Shell>
  );
}
