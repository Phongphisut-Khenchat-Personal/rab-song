import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { transitionLead } from "@/server/leads";
import { leadTransitionBody } from "@/server/validators";

export async function POST(req: Request, context: { params: Promise<{ leadId: string }> }) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const { leadId } = await context.params;
    const body = leadTransitionBody.parse(await req.json());
    return jsonConfirmed(await transitionLead(actor, leadId, body));
  } catch (error) {
    return jsonError(error);
  }
}
