import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { updateVehicle } from "@/server/roster";
import { vehicleBody } from "@/server/validators";

export async function PATCH(req: Request, context: { params: Promise<{ vehicleId: string }> }) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const { vehicleId } = await context.params;
    const body = vehicleBody.parse(await req.json());
    const vehicle = await updateVehicle(actor, vehicleId, body);
    return jsonConfirmed({ vehicle });
  } catch (error) {
    return jsonError(error);
  }
}
