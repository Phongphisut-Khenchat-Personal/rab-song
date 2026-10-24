import { execSync } from "node:child_process";

const databaseUrl = "postgresql://rabsong:rabsong_test@localhost:5437/rabsong_test?schema=public";

export default function setup(): void {
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      SESSION_SECRET: "test-only-session-secret-not-for-production-32",
      APP_ENV: "test",
    },
  });
}
