import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { changeServiceStatus } from "@/server/service-status";
import { serviceStatusBody } from "@/server/validators";

export async function POST(req: Request, context: { params: Promise<{ studentId: string }> }) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const { studentId } = await context.params;
    const body = serviceStatusBody.parse(await req.json());
    return jsonConfirmed(await changeServiceStatus(actor, studentId, body.to, body.reason));
  } catch (error) {
    return jsonError(error);
  }
}
