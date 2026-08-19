import type { NextConfig } from "next";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

// This app is run from `apps/web`, while development secrets live at the
// workspace root. Load them before Turbopack evaluates shared server modules.
const rootEnvPath = path.resolve(process.cwd(), "../..", ".env");
const rootEnvLines = existsSync(rootEnvPath)
  ? readFileSync(rootEnvPath, "utf8").split(/\r?\n/)
  : [];

function loadFromRootEnv(key: string): void {
  if (process.env[key]) return;
  const line = rootEnvLines.find((l) => l.startsWith(`${key}=`));
  if (line) process.env[key] = line.slice(`${key}=`.length).trim();
}

loadFromRootEnv("DATABASE_URL");
// Shared secret with ai-engine — both must use the identical key to
// encrypt/decrypt the same BYOK provider credential column. Loaded from the
// root .env (single source of truth) rather than duplicated into
// apps/web/.env, to avoid drift if it's ever rotated.
loadFromRootEnv("ENCRYPTION_KEY");

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
