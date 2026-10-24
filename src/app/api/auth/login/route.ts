import { sessionCookie } from "@/lib/http";
import { login } from "@/server/auth";
import { assertSameOrigin, jsonData, jsonError, publicActor } from "@/server/http";
import { loginBody } from "@/server/validators";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const body = loginBody.parse(await req.json());
    const result = await login({
      phone: body.phone,
      password: body.password,
      userAgent: req.headers.get("user-agent"),
    });
    const response = jsonData({ actor: publicActor(result.actor) });
    response.headers.append("Set-Cookie", sessionCookie(result.token, result.expiresAt));
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
