import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as devAccounts } from "@/app/api/dev/accounts/route";
import { GET as me } from "@/app/api/me/route";
import { prisma } from "@/lib/db";
import { api, cookieFrom, createFixture, PASSWORD, resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
  await createFixture();
});

describe("login", () => {
  it("sets an httpOnly session and does not return the password hash", async () => {
    const response = await login(api("/api/auth/login", { body: { phone: "082-222-2222", password: PASSWORD } }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.actor.role).toBe("DRIVER");
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(JSON.stringify(body)).not.toContain("scrypt$");
    const cookie = cookieFrom(response);
    expect(cookie.startsWith("rabsong_session=")).toBe(true);
    const session = await me(api("/api/me", { cookie }));
    expect((await session.json()).actor.phone).toBe("0822222222");
  });

  it("rejects a wrong password and a deactivated account", async () => {
    const wrong = await login(api("/api/auth/login", { body: { phone: "0822222222", password: "not-the-password" } }));
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).confirmed).not.toBe(true);

    await prisma.user.update({ where: { phone: "0822222222" }, data: { active: false } });
    const inactive = await login(api("/api/auth/login", { body: { phone: "0822222222", password: PASSWORD } }));
    expect(inactive.status).toBe(403);
  });

  it("revokes the session on logout", async () => {
    const response = await login(api("/api/auth/login", { body: { phone: "0822222222", password: PASSWORD } }));
    const cookie = cookieFrom(response);
    const done = await logout(api("/api/auth/logout", { method: "POST", cookie }));
    expect(done.status).toBe(200);
    const after = await me(api("/api/me", { cookie }));
    expect(after.status).toBe(401);
  });

  it("does not publish sample passwords outside development", async () => {
    const response = await devAccounts();
    expect(response.status).toBe(404);
  });

  it("rejects a cross-site login", async () => {
    const response = await login(
      api("/api/auth/login", {
        body: { phone: "0822222222", password: PASSWORD },
        origin: "https://evil.example",
      }),
    );
    expect(response.status).toBe(403);
  });
});
