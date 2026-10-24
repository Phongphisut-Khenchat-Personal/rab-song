import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { savePlace, searchAddress } from "@/server/places";
import { addressSearchBody, placeBody } from "@/server/validators";

export async function POST(req: Request) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const body = placeBody.parse(await req.json());
    return jsonConfirmed(await savePlace(actor, body));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(req: Request) {
  try {
    await requireUser(req, ["OWNER"]);
    const body = addressSearchBody.parse(await req.json());
    return Response.json({ ok: true, results: await searchAddress(body.query) });
  } catch (error) {
    return jsonError(error);
  }
}
