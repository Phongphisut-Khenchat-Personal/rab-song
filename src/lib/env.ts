export type AppEnv = {
  appEnv: string;
  sessionSecret: string;
  databaseUrl: string;
  seedDataset: string;
};

export function getEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const sessionSecret = env.SESSION_SECRET ?? "";
  const appEnv = env.APP_ENV ?? "development";
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร");
  }
  if (appEnv === "production" && /change-me|test-only/i.test(sessionSecret)) {
    throw new Error("โหมดจริงใช้รหัสลับตัวอย่างไม่ได้");
  }
  const databaseUrl = env.DATABASE_URL ?? "";
  if (!databaseUrl) throw new Error("ยังไม่ได้ตั้ง DATABASE_URL");
  if (appEnv === "production" && /rabsong_dev|rabsong_test/.test(databaseUrl)) {
    throw new Error("โหมดจริงใช้ฐานข้อมูลพัฒนาหรือฐานทดสอบไม่ได้");
  }
  return {
    appEnv,
    sessionSecret,
    databaseUrl,
    seedDataset: env.SEED_DATASET ?? "",
  };
}
