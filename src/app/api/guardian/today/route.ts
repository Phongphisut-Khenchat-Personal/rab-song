import { jsonData, jsonError, requireUser } from "@/server/http";
import { getGuardianToday, listNotifications } from "@/server/runs";

export async function GET(req: Request) {
  try {
    const actor = await requireUser(req, ["GUARDIAN"]);
    return jsonData({
      children: await getGuardianToday(actor),
      notifications: await listNotifications(actor),
    });
  } catch (error) {
    return jsonError(error);
  }
}
