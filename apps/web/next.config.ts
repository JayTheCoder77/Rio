import type { NextConfig } from "next";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

// This app is run from `apps/web`, while development secrets live at the
// workspace root. Load them before Turbopack evaluates shared server modules.
const rootEnvPath = path.resolve(process.cwd(), "../..", ".env");
const databaseUrlLine = existsSync(rootEnvPath)
  ? readFileSync(rootEnvPath, "utf8")
      .split(/\r?\n/)
      .find((line) => line.startsWith("DATABASE_URL="))
  : undefined;

if (!process.env.DATABASE_URL && databaseUrlLine) {
  process.env.DATABASE_URL = databaseUrlLine.slice("DATABASE_URL=".length).trim();
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
