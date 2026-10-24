import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { SESSION_COOKIE } from "@/lib/http";
import { actorFromToken, type Actor } from "@/server/auth";

export async function currentActor(): Promise<Actor | null> {
  const jar = await cookies();
  return actorFromToken(jar.get(SESSION_COOKIE)?.value ?? null);
}

export function homeFor(role: UserRole): string {
  if (role === "GUARDIAN") return "/guardian";
  if (role === "DRIVER") return "/driver";
  return "/owner";
}

export async function requirePageActor(roles?: UserRole[]): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) redirect("/login");
  if (roles && !roles.includes(actor.role)) redirect(homeFor(actor.role));
  return actor;
}
