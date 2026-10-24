import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { addServiceException } from "@/server/calendar";
import { exceptionBody } from "@/server/validators";

export async function POST(req: Request) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const body = exceptionBody.parse(await req.json());
    return jsonConfirmed(await addServiceException(actor, body));
  } catch (error) {
    return jsonError(error);
  }
}
