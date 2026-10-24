import { notFound } from "next/navigation";
import { AssignmentForm, StudentForm } from "@/components/owner-forms";
import { Shell } from "@/components/shell";
import { requirePageActor } from "@/lib/current";
import { listRoutes, listSchools, listStudents } from "@/server/roster";

export default async function EditStudentPage({ params }: { params: Promise<{ studentId: string }> }) {
  const actor = await requirePageActor(["OWNER"]);
  const { studentId } = await params;
  const [students, schools, routes] = await Promise.all([listStudents(actor), listSchools(actor), listRoutes(actor)]);
  const student = students.find((item) => item.id === studentId);
  if (!student) notFound();
  return (
    <Shell actor={actor} wide>
      <div className="stack">
        <StudentForm
          studentId={student.id}
          schools={schools.map((school) => ({ id: school.id, name: school.name }))}
          initial={student}
        />
        <AssignmentForm studentId={student.id} routes={routes} />
      </div>
    </Shell>
  );
}
