import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      ok: true,
      db: "up",
      environment: process.env.APP_ENV ?? "development",
      push: "not_configured",
    });
  } catch {
    return Response.json(
      { ok: false, db: "down", environment: process.env.APP_ENV ?? "development", push: "not_configured" },
      { status: 503 },
    );
  }
}
