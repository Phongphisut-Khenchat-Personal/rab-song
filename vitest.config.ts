import path from "node:path";
import { defineConfig } from "vitest/config";

const testDatabaseUrl =
  "postgresql://rabsong:rabsong_test@localhost:5437/rabsong_test?schema=public";
const testSessionSecret = "test-only-session-secret-not-for-production-32";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    sequence: { concurrent: false },
    hookTimeout: 30000,
    testTimeout: 20000,
    globalSetup: "./tests/global-setup.ts",
    setupFiles: ["./tests/setup-env.ts"],
    env: {
      DATABASE_URL: testDatabaseUrl,
      SESSION_SECRET: testSessionSecret,
      APP_ENV: "test",
      SEED_DATASET: "",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
