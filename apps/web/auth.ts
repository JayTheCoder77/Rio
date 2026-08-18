import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq, and } from "drizzle-orm";
import { db, users, accounts } from "@rio/db";
import authConfig from "./auth.config";

function isConnectionReset(error: unknown): boolean {
  let current = error;

  // Drizzle wraps driver failures in `Error: Failed query`, keeping the
  // database error under `cause`.
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth++) {
    if ("code" in current && current.code === "ECONNRESET") return true;
    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}

function retryConnectionReset<TArgs extends unknown[], TResult>(
  operation: (...args: TArgs) => TResult,
): (...args: TArgs) => Promise<Awaited<TResult>> {
  return (async (...args: TArgs) => {
    try {
      return await operation(...args);
    } catch (error) {
      if (!isConnectionReset(error)) throw error;
      return operation(...args);
    }
  }) as (...args: TArgs) => Promise<Awaited<TResult>>;
}

const adapter = DrizzleAdapter(db, { usersTable: users, accountsTable: accounts });

// A reset can occur when Neon wakes an idle compute. Retrying reads is safe;
// do not retry adapter writes because their result may be unknown after a
// disconnected socket.
if (adapter.getUserByAccount) {
  adapter.getUserByAccount = retryConnectionReset(adapter.getUserByAccount);
}
if (adapter.getUserByEmail) {
  adapter.getUserByEmail = retryConnectionReset(adapter.getUserByEmail);
}
if (adapter.getUser) {
  adapter.getUser = retryConnectionReset(adapter.getUser);
}
if (adapter.getSessionAndUser) {
  adapter.getSessionAndUser = retryConnectionReset(adapter.getSessionAndUser);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user?.id) token.id = user.id;

      // `account` is only present on the sign-in event itself (not on
      // subsequent JWT refreshes). The adapter only writes tokens once,
      // on first-ever link, so without this the stored access/refresh
      // token pair goes permanently stale after it first expires.
      if (account?.provider === "github" && user?.id) {
        await db
          .update(accounts)
          .set({
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
          })
          .where(and(eq(accounts.userId, user.id), eq(accounts.provider, "github")));
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id;
      return session;
    },
  },
});
