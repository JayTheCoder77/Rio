import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq, and } from "drizzle-orm";
import { db, users, accounts } from "@rio/db";
import authConfig from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, { usersTable: users, accountsTable: accounts }),
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