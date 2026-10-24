import { jsonConfirmed, jsonData, jsonError, requireUser } from "@/server/http";
import { createLead } from "@/server/leads";
import { prisma } from "@/lib/db";
import { leadBody } from "@/server/validators";

export async function GET(req: Request) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const leads = await prisma.serviceLead.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    return jsonData({ leads: leads.map((lead) => ({ id: lead.id, status: lead.status, childNickname: lead.childNickname, studentId: lead.studentId })) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const body = leadBody.parse(await req.json());
    return jsonConfirmed(await createLead(actor, body));
  } catch (error) {
    return jsonError(error);
  }
}
