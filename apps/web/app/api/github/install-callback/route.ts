import {NextRequest , NextResponse} from "next/server";
import {db , installations , userInstallations} from "@rio/db";
import {eq} from "drizzle-orm";
import {verifyInstallState} from "@/lib/install-state";


async function findInstallation(githubInstallationId : number){
    for (let attempt = 0 ; attempt < 5 ; attempt++){
        const [row] = await db.select({id : installations.id})
            .from(installations)
            .where(eq(installations.githubInstallationId , githubInstallationId))
            .limit(1);
        
        if (row) return row;
        await new Promise((r) => setTimeout(r , 500));
    }
    return null;
}

export async function GET(req: NextRequest) {
    const installationId = req.nextUrl.searchParams.get("installation_id");
    const state = req.nextUrl.searchParams.get("state");

    // verify state -> userId
    if (!installationId || !state){
        return NextResponse.redirect(new URL ("/dashboard?install_error=missing_params" ,req.url))
    }

    const userId = await verifyInstallState(state);
    if (!userId){
        return NextResponse.redirect(new URL("/dashboard?install_error=invalid_state", req.url));
    }

    const inst = await findInstallation(Number(installationId));
    if (!inst) {
        return NextResponse.redirect(new URL ("/dashboard?install_error=not_found" , req.url));
    }

    await db.insert(userInstallations)
        .values({userId , installationId : inst.id})
        .onConflictDoNothing();
    
    return NextResponse.redirect(new URL ("/dashboard?installed=1" , req.url));
}
 