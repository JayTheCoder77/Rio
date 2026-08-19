import postgres from "postgres";
import { vi } from "vitest";

// The real src/db.ts forces `ssl: "require"` (for Neon) and requires a
// DATABASE_URL. Against local docker Postgres (no TLS) that fails, so this
// setup file:
//   1. points DATABASE_URL at the local test database, and
//   2. wraps the postgres.js driver to drop the `ssl` option the app injects.
// This lets the REAL db.ts connect to local Postgres, so the integration
// tests exercise the actual module graph end to end.
process.env.DATABASE_URL = process.env.RIO_TEST_DATABASE_URL ?? "postgresql://rio:rio@localhost:5432/rio_test";
process.env.NODE_ENV = "development";

// The integration tests run against a dedicated `rio_test` database. Create it
// on demand (best-effort) so CI and fresh local environments don't need a
// manual setup step beyond the docker-compose Postgres.
try {
  const admin = postgres("postgresql://rio:rio@localhost:5432/postgres", {
    max: 1,
    connect_timeout: 3,
  });
  await admin`CREATE DATABASE rio_test`.catch(() => {});
  await admin.end();
} catch {
  // Postgres not reachable; tests skip themselves via their own probe.
}

vi.mock("postgres", async (importOriginal) => {
  const actual = await importOriginal<typeof import("postgres")>();
  const driver = actual.default;
  return {
    ...actual,
    default: (connString: string, options?: Record<string, unknown>) => {
      const { ssl: _ssl, ...rest } = options ?? {};
      return driver(connString, rest);
    },
  };
});