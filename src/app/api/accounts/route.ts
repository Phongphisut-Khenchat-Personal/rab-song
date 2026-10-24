import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { createPortalAccount } from "@/server/accounts";
import { accountBody } from "@/server/validators";

export async function POST(req: Request) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const body = accountBody.parse(await req.json());
    return jsonConfirmed(await createPortalAccount(actor, body));
  } catch (error) {
    return jsonError(error);
  }
}
