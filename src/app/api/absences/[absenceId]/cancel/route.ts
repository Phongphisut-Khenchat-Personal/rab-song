import { cancelAbsence } from "@/server/absence";
import { jsonConfirmed, jsonError, requireUser } from "@/server/http";

export async function POST(req: Request, context: { params: Promise<{ absenceId: string }> }) {
  try {
    const actor = await requireUser(req, ["GUARDIAN", "OWNER"]);
    const { absenceId } = await context.params;
    const result = await cancelAbsence(actor, absenceId);
    return jsonConfirmed({ replayed: result.replayed, absence: result.data });
  } catch (error) {
    return jsonError(error);
  }
}
