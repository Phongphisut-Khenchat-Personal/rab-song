import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { addStop } from "@/server/roster";
import { stopBody } from "@/server/validators";

export async function POST(req: Request, context: { params: Promise<{ routeId: string }> }) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const { routeId } = await context.params;
    const body = stopBody.parse(await req.json());
    const stop = await addStop(actor, routeId, body);
    return jsonConfirmed({ stop }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
