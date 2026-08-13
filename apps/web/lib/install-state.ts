import {SignJWT , jwtVerify} from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

export async function createInstallState(userId: string) : Promise<string> {
    return new SignJWT({userId})
        .setProtectedHeader({alg : "HS256"})
        .setExpirationTime("10m")
        .sign(secret);
}

export async function verifyInstallState(token : string) : Promise<string | null> {
    try{
        const {payload} = await jwtVerify(token , secret);
        return typeof payload.userId === "string" ? payload.userId : null;
    } catch {
        return null;
    }
}