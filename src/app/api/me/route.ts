import { jsonData, jsonError, publicActor, requireUser } from "@/server/http";

export async function GET(req: Request) {
  try {
    const actor = await requireUser(req);
    return jsonData({ actor: publicActor(actor) });
  } catch (error) {
    return jsonError(error);
  }
}
