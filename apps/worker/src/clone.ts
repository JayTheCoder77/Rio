import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const runGit = promisify(execFile);

export async function cloneRepo(
    owner : string,
    repoName : string,
    sha : string,
    token : string
) : Promise<{path : string; cleanup : () => Promise<void> }> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir() , "rio-clone-"));
    const url = `https://x-access-token:${token}@github.com/${owner}/${repoName}.git`;

    try {
        await runGit("git" , ["init"] , {cwd : dir});
        await runGit("git" , ["remote" , "add" , "origin" , url] , {cwd : dir});
        await runGit("git" , ["fetch" , "--depth=1" , "origin" , sha] , {cwd : dir});
        await runGit("git" , ["checkout" , sha] , {cwd : dir});
    }
    catch(err){
        await fs.rm(dir , {recursive : true , force : true});
        throw err;
    }

    return {
        path : dir , 
        cleanup : () => fs.rm(dir , {recursive : true , force : true}),
    };
}