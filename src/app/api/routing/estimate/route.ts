import { jsonError, requireUser } from "@/server/http";
import { estimateRoute } from "@/server/routing";
import { estimateBody } from "@/server/validators";

export async function POST(req: Request) {
  try {
    await requireUser(req, ["OWNER"]);
    const body = estimateBody.parse(await req.json());
    const estimate = await estimateRoute(body.points);
    if (!estimate.ok) {
      return Response.json({ ok: false, confirmed: false, error: { code: estimate.code, message: estimate.message } }, { status: 422 });
    }
    const { ok: _ignored, ...estimateFields } = estimate;
    return Response.json({ ok: true, confirmed: true, ...estimateFields });
  } catch (error) {
    return jsonError(error);
  }
}
