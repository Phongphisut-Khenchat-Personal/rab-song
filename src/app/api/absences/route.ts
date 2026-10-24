import { createAbsence, listAbsences } from "@/server/absence";
import { jsonConfirmed, jsonData, jsonError, requireUser } from "@/server/http";
import { absenceBody } from "@/server/validators";

export async function GET(req: Request) {
  try {
    const actor = await requireUser(req);
    return jsonData({ absences: await listAbsences(actor) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireUser(req, ["GUARDIAN", "OWNER"]);
    const body = absenceBody.parse(await req.json());
    const result = await createAbsence(actor, body);
    return jsonConfirmed({
      replayed: result.replayed,
      absence: result.data,
      notification: result.notification,
    });
  } catch (error) {
    return jsonError(error);
  }
}
