import { prisma } from "../src/lib/db";
import { getEnv } from "../src/lib/env";
import { hashPassword } from "../src/lib/password";
import { isThaiMobile, normalizePhone } from "../src/lib/phone";
import { assertProductionOwnerPassword } from "../src/lib/seed-guard";

async function main() {
  getEnv();
  const name = process.env.OWNER_NAME?.trim() ?? "";
  const phone = normalizePhone(process.env.OWNER_PHONE ?? "");
  const password = process.env.OWNER_PASSWORD ?? "";
  if (name.length < 2) throw new Error("ต้องตั้ง OWNER_NAME");
  if (!isThaiMobile(phone)) throw new Error("OWNER_PHONE ต้องเป็นเบอร์ไทย 10 หลัก");
  assertProductionOwnerPassword(password);
  const user = await prisma.user.create({
    data: { name, phone, passwordHash: await hashPassword(password), role: "OWNER" },
  });
  if (process.env.CREATE_DRIVER !== "false") {
    await prisma.driver.create({ data: { userId: user.id } });
  }
  console.log(`สร้างเจ้าของแล้ว ${phone}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
