import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { addAuthorizedReceiver } from "@/server/accounts";
import { receiverBody } from "@/server/validators";

export async function POST(req: Request, context: { params: Promise<{ studentId: string }> }) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const { studentId } = await context.params;
    const body = receiverBody.parse(await req.json());
    return jsonConfirmed(await addAuthorizedReceiver(actor, studentId, body));
  } catch (error) {
    return jsonError(error);
  }
}
