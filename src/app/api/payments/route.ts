import { jsonConfirmed, jsonError, requireUser } from "@/server/http";
import { recordPayment } from "@/server/payments";
import { paymentBody } from "@/server/validators";

export async function POST(req: Request) {
  try {
    const actor = await requireUser(req, ["OWNER"]);
    const body = paymentBody.parse(await req.json());
    const payment = await recordPayment(actor, body);
    return jsonConfirmed({ replayed: payment.replayed, paymentId: payment.id });
  } catch (error) {
    return jsonError(error);
  }
}
