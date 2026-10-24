import { clearSessionCookie, readCookie, SESSION_COOKIE } from "@/lib/http";
import { logout } from "@/server/auth";
import { assertSameOrigin, jsonData, jsonError } from "@/server/http";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await logout(readCookie(req, SESSION_COOKIE));
    const response = jsonData({ loggedOut: true });
    response.headers.append("Set-Cookie", clearSessionCookie());
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
