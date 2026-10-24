import { jsonData, jsonError, requireUser } from "@/server/http";
import { getRunDetail } from "@/server/runs";

export async function GET(req: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const actor = await requireUser(req, ["OWNER", "DRIVER"]);
    const { runId } = await context.params;
    return jsonData({ run: await getRunDetail(actor, runId) });
  } catch (error) {
    return jsonError(error);
  }
}
