import { jsonData, jsonError, requireUser } from "@/server/http";
import { listInvoices } from "@/server/payments";
import { getGuardianHistory } from "@/server/runs";

export async function GET(req: Request) {
  try {
    const actor = await requireUser(req, ["GUARDIAN"]);
    return jsonData({
      events: await getGuardianHistory(actor),
      invoices: await listInvoices(actor),
    });
  } catch (error) {
    return jsonError(error);
  }
}
