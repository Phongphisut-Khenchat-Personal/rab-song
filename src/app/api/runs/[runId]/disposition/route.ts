import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { markDisposition } from "@/server/trip-events";
import { dispositionBody } from "@/server/validators";

export async function POST(req: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const actor = await requireUser(req, ["OWNER", "DRIVER"]);
    const { runId } = await context.params;
    const body = dispositionBody.parse(await req.json());
    return jsonConfirmed(await markDisposition(actor, { ...body, runId }));
  } catch (error) {
    return jsonError(error);
  }
}
