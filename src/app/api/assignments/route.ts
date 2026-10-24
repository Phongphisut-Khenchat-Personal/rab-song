import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { assignStudent } from "@/server/roster";
import { assignmentBody } from "@/server/validators";

export async function POST(req: Request) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const body = assignmentBody.parse(await req.json());
    const assignment = await assignStudent(actor, body);
    return jsonConfirmed({ assignment });
  } catch (error) {
    return jsonError(error);
  }
}
