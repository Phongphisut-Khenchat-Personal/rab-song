import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { updateStopLocation } from "@/server/roster";
import { stopLocationBody } from "@/server/validators";

export async function PUT(req: Request, context: { params: Promise<{ routeId: string; stopId: string }> }) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const { routeId, stopId } = await context.params;
    const body = stopLocationBody.parse(await req.json());
    await updateStopLocation(actor, routeId, stopId, body);
    return jsonConfirmed({ stopId });
  } catch (error) {
    return jsonError(error);
  }
}
