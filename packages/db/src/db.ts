import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
}

// In development, Next.js's hot-module-reloading re-executes this module on
// every file change, which would otherwise create a brand new `postgres()`
// client (and a brand new connection pool) on every reload — old clients'
// connections are never explicitly closed, so they pile up over a long dev
// session. Caching the client on `globalThis` across reloads avoids this.
// This is the standard fix for this class of bug (same pattern Prisma/Drizzle
// docs recommend) and is a likely contributor to the intermittent
// "password authentication failed" errors seen after long-running dev
// sessions — stale/orphaned connections racing against Neon's pooler.
const globalForDb = globalThis as unknown as { __rioDbClient?: ReturnType<typeof postgres> };

// In local development use Neon's direct endpoint. The app owns one cached
// client, so it does not need PgBouncer; bypassing it avoids the connection
// resets observed during the OAuth callback. Deployments retain the pooled
// endpoint, where many short-lived application instances need pooling.
const databaseUrl = process.env.NODE_ENV === "development"
    ? process.env.DATABASE_URL!.replace(/-pooler(?=\.)/, "")
    : process.env.DATABASE_URL!;

const client = globalForDb.__rioDbClient ?? postgres(databaseUrl, {
    ssl: "require",
    // Neon can suspend an idle compute (five minutes by default). Keeping an
    // application-side socket open across that period means its first reuse
    // can fail with ECONNRESET before postgres.js has a chance to reconnect.
    // Close idle client sockets well before then; the pooler will cheaply open
    // a new one for the next request.
    idle_timeout: 30,
    // Belt-and-suspenders against the recurring intermittent
    // "password authentication failed" (28P01) errors seen against Neon's
    // pooler after long dev sessions. Neon's own docs list postgres.js as
    // needing this explicit `ssl` option (not just `sslmode=require` in the
    // URL) for reliable Server Name Indication (SNI) support, which Neon's
    // proxy relies on to route connections to the correct compute — see
    // https://neon.tech/docs/connect/connection-errors#password-authentication-failed-for-user
    max_lifetime: 60 * 10, // force reconnect every 10 min rather than postgres.js's default 30-60min window, so a stale/misrouted connection self-heals faster
});

if (process.env.NODE_ENV !== "production") {
    globalForDb.__rioDbClient = client;
}

export const db = drizzle(client);
