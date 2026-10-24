import { jsonData, jsonError, requireUser } from "@/server/http";
import { applySyncBatch } from "@/server/sync";
import { syncBody } from "@/server/validators";

export async function POST(req: Request) {
  try {
    const actor = await requireUser(req);
    const body = syncBody.parse(await req.json());
    const operations = await applySyncBatch(actor, body.operations);
    return jsonData({ operations });
  } catch (error) {
    return jsonError(error);
  }
}
