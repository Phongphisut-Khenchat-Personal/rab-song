import { jsonData, jsonError, requireUser } from "@/server/http";
import { listAudit } from "@/server/runs";

export async function GET(req: Request) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    return jsonData({ audits: await listAudit(actor) });
  } catch (error) {
    return jsonError(error);
  }
}
