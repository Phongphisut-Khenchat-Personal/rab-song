import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { publishRouteVersion } from "@/server/route-versions";
import { publishBody } from "@/server/validators";

export async function POST(req: Request, context: { params: Promise<{ routeId: string }> }) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const { routeId } = await context.params;
    const body = publishBody.parse(await req.json());
    return jsonConfirmed(await publishRouteVersion(actor, routeId, body));
  } catch (error) {
    return jsonError(error);
  }
}
