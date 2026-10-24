import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { verifyPlace } from "@/server/places";
import { placeVerifyBody } from "@/server/validators";

export async function POST(req: Request, context: { params: Promise<{ placeId: string }> }) {
  try {
    const actor = await requireUser(req, ["OWNER", "DRIVER"]);
    const { placeId } = await context.params;
    const body = placeVerifyBody.parse(await req.json());
    return jsonConfirmed(await verifyPlace(actor, placeId, body));
  } catch (error) {
    return jsonError(error);
  }
}
