import { jsonConfirmed, jsonData, jsonError, requireUser } from "@/server/http";
import { createSchool, listSchools } from "@/server/roster";
import { schoolBody } from "@/server/validators";

export async function GET(req: Request) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    return jsonData({ schools: await listSchools(actor) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const body = schoolBody.parse(await req.json());
    const school = await createSchool(actor, body);
    return jsonConfirmed({ school }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
