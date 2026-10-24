import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { recordInspection } from "@/server/inspections";
import { inspectionBody } from "@/server/validators";

export async function POST(req: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const actor = await requireUser(req, ["OWNER", "DRIVER"]);
    const { runId } = await context.params;
    const body = inspectionBody.parse(await req.json());
    return jsonConfirmed(await recordInspection(actor, { ...body, runId }));
  } catch (error) {
    return jsonError(error);
  }
}
