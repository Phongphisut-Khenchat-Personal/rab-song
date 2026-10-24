import { jsonConfirmed, jsonData, jsonError, requireUser } from "@/server/http";
import { createStudent, listStudents } from "@/server/roster";
import { studentBody } from "@/server/validators";

export async function GET(req: Request) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    return jsonData({ students: await listStudents(actor) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const body = studentBody.parse(await req.json());
    const student = await createStudent(actor, body);
    return jsonConfirmed({ student }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
