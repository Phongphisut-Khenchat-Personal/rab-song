import { jsonError, requireUser } from "@/server/http";
import { routeShape } from "@/server/routing";
import { estimateBody } from "@/server/validators";

export async function POST(req: Request) {
  try {
    await requireUser(req, ["OWNER", "DRIVER"]);
    const body = estimateBody.parse(await req.json());
    const shape = await routeShape(body.points);
    if (!shape.ok) return Response.json({ ok: true, confirmed: false, line: null, legs: [], durationSeconds: null, distanceMeters: null, message: shape.message });
    return Response.json({
      ok: true,
      confirmed: true,
      line: shape.line,
      legs: shape.legs,
      durationSeconds: shape.durationSeconds,
      distanceMeters: shape.distanceMeters,
      message: shape.message,
    });
  } catch (error) {
    return jsonError(error);
  }
}
