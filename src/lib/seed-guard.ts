export function assertDevelopmentSeedAllowed(env: NodeJS.ProcessEnv = process.env): void {
  if (env.APP_ENV !== "development" || env.SEED_DATASET !== "development") {
    throw new Error(
      "ปฏิเสธการใส่ข้อมูลตัวอย่าง: ใช้ได้เฉพาะ APP_ENV=development และ SEED_DATASET=development",
    );
  }
}

export const DEVELOPMENT_PASSWORDS = ["DevOwner#2569", "DevGuard#2569"] as const;

export function assertProductionOwnerPassword(password: string): void {
  if (password.length < 10 || password.length > 128) {
    throw new Error("รหัสผ่านเจ้าของระบบจริงต้องยาว 10-128 ตัวอักษร");
  }
  if ((DEVELOPMENT_PASSWORDS as readonly string[]).includes(password)) {
    throw new Error("ห้ามใช้รหัสผ่านของข้อมูลตัวอย่างบนระบบจริง");
  }
}
