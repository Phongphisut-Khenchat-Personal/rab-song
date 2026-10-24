import { jsonData, jsonError, requireUser } from "@/server/http";
import { getOwnerSummary } from "@/server/runs";

export async function GET(req: Request) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    return jsonData({ summary: await getOwnerSummary(actor) });
  } catch (error) {
    return jsonError(error);
  }
}