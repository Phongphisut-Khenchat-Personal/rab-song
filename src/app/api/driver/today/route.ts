import { jsonData, jsonError, requireUser } from "@/server/http";
import { getDriverToday } from "@/server/runs";

export async function GET(req: Request) {
  try {
    const actor = await requireUser(req, ["OWNER", "DRIVER"]);
    return jsonData({ runs: await getDriverToday(actor) });
  } catch (error) {
    return jsonError(error);
  }
}
