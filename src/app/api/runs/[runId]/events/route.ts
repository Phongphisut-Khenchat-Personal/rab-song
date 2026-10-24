import { recordAttendance } from "@/server/attendance";
import { DomainError } from "@/server/errors";
import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { attendanceBody } from "@/server/validators";

export async function POST(req: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const actor = await requireUser(req, ["OWNER", "DRIVER"]);
    const { runId } = await context.params;
    const body = attendanceBody.parse(await req.json());
    if (body.runId !== runId) throw new DomainError(422, "RUN_MISMATCH", "รหัสรอบไม่ตรงกัน");
    const result = await recordAttendance({ actor, ...body });
    return jsonConfirmed({
      replayed: result.replayed,
      event: result.data,
      notification: result.notification,
    });
  } catch (error) {
    return jsonError(error);
  }
}
