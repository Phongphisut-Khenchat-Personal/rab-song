import { z } from "zod";
import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { moveStop } from "@/server/roster";

const bodySchema = z.object({ direction: z.union([z.literal(-1), z.literal(1)]) }).strict();

export async function POST(req: Request, context: { params: Promise<{ routeId: string; stopId: string }> }) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const { routeId, stopId } = await context.params;
    const body = bodySchema.parse(await req.json());
    const result = await moveStop(actor, routeId, stopId, body.direction);
    return jsonConfirmed(result);
  } catch (error) {
    return jsonError(error);
  }
}
