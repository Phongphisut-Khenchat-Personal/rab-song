import { jsonConfirmed, jsonData, jsonError, requireUser } from "@/server/http";
import { createInvoice, listInvoices } from "@/server/payments";
import { invoiceBody } from "@/server/validators";

export async function GET(req: Request) {
  try {
    const actor = await requireUser(req, ["OWNER", "GUARDIAN"]);
    return jsonData({ invoices: await listInvoices(actor) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const body = invoiceBody.parse(await req.json());
    const invoice = await createInvoice(actor, body);
    return jsonConfirmed({ invoice }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
