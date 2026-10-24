import { recordCheckpoint } from "@/server/checkpoints";
import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { checkpointBody } from "@/server/validators";

export async function POST(req: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const actor = await requireUser(req, ["OWNER", "DRIVER"]);
    const { runId } = await context.params;
    const body = checkpointBody.parse(await req.json());
    const result = await recordCheckpoint(actor, runId, body.kind);
    return jsonConfirmed({ replayed: result.replayed, passed: result.passed, missing: result.missing });
  } catch (error) {
    return jsonError(error);
  }
}
