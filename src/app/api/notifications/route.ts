import { jsonData, jsonError, requireUser } from "@/server/http";
import { listNotifications } from "@/server/runs";

export async function GET(req: Request) {
  try {
    const actor = await requireUser(req);
    return jsonData({ notifications: await listNotifications(actor) });
  } catch (error) {
    return jsonError(error);
  }
}
