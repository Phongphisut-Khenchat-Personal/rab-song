import { acknowledgeAbsence } from "@/server/absence";
import { jsonConfirmed, jsonError, requireUser } from "@/server/http";

export async function POST(req: Request, context: { params: Promise<{ absenceId: string }> }) {
  try {
    const actor = await requireUser(req, ["OWNER", "DRIVER"]);
    const { absenceId } = await context.params;
    const result = await acknowledgeAbsence(actor, absenceId);
    return jsonConfirmed({ replayed: result.replayed });
  } catch (error) {
    return jsonError(error);
  }
}
