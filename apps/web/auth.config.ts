import {NextAuthConfig} from "next-auth";
import Github from "next-auth/providers/github";

export default {
    providers: [Github],
    // Auth.js v5 only auto-trusts the request host on Vercel. Without this,
    // the middleware's `auth()` can reject the host and `req.auth` comes back
    // null, bouncing signed-in users back to /login. Safe to keep on Vercel.
    trustHost: true,
} satisfies NextAuthConfig;