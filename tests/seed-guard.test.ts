import { describe, expect, it } from "vitest";
import { assertDevelopmentSeedAllowed, assertProductionOwnerPassword } from "@/lib/seed-guard";

describe("development seed guard", () => {
  it("allows only an explicit development dataset", () => {
    expect(() =>
      assertDevelopmentSeedAllowed({ APP_ENV: "development", SEED_DATASET: "development" } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

  it("refuses production and unlabeled environments", () => {
    expect(() => assertDevelopmentSeedAllowed({ APP_ENV: "production", SEED_DATASET: "development" } as NodeJS.ProcessEnv)).toThrow(
      /ปฏิเสธ/,
    );
    expect(() => assertDevelopmentSeedAllowed({ APP_ENV: "development", SEED_DATASET: "production" } as NodeJS.ProcessEnv)).toThrow(
      /ปฏิเสธ/,
    );
    expect(() => assertDevelopmentSeedAllowed({} as NodeJS.ProcessEnv)).toThrow(/ปฏิเสธ/);
  });

  it("rejects sample passwords for a real owner account", () => {
    expect(() => assertProductionOwnerPassword("DevOwner#2569")).toThrow(/ห้ามใช้รหัสผ่าน/);
    expect(() => assertProductionOwnerPassword("short")).toThrow(/10/);
    expect(() => assertProductionOwnerPassword("real-owner-pass")).not.toThrow();
  });
});
