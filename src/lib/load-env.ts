import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadLocalEnv(): void {
  const file = path.join(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    const key = trimmed.slice(0, index);
    if (process.env[key]) continue;
    process.env[key] = trimmed.slice(index + 1);
  }
}
