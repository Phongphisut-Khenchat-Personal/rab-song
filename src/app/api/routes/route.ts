import { jsonData, jsonError, requireUser } from "@/server/http";
import { listRoutes } from "@/server/roster";

export async function GET(req: Request) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    return jsonData({ routes: await listRoutes(actor) });
  } catch (error) {
    return jsonError(error);
  }
}
