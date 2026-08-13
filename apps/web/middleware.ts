import NextAuth from "next-auth";
import {NextResponse} from "next/server";
import authConfig from "./auth.config";

const {auth} = NextAuth(authConfig);

export default auth((req) => {
    const isLoggedIn = !!req.auth;

    if (!isLoggedIn) {
        const loginUrl = new URL("/login" , req.nextUrl.origin);
        loginUrl.searchParams.set("callbackUrl" , req.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }
});

export const config = {
    matcher : ["/dashboard/:path*"],
};