import { correctAttendance } from "@/server/attendance";
import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { correctionBody } from "@/server/validators";

export async function POST(req: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const { runId } = await context.params;
    const body = correctionBody.parse(await req.json());
    const result = await correctAttendance({ actor, runId, ...body });
    return jsonConfirmed({ replayed: result.replayed, event: result.data });
  } catch (error) {
    return jsonError(error);
  }
}
