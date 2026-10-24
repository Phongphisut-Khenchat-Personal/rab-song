import { z } from "zod";
import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { updateStudent } from "@/server/roster";
import { studentBody } from "@/server/validators";

const updateBody = studentBody.extend({ active: z.boolean().optional() });

export async function PATCH(req: Request, context: { params: Promise<{ studentId: string }> }) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const { studentId } = await context.params;
    const body = updateBody.parse(await req.json());
    const student = await updateStudent(actor, studentId, body);
    return jsonConfirmed({ student });
  } catch (error) {
    return jsonError(error);
  }
}
