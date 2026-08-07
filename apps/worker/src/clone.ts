import { $ } from "bun";
import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";

export async function cloneRepo(
    owner : string,
    repoName : string,
    sha : string,
    token : string
) : Promise<{path : string; cleanup : () => Promise<void> }> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir() , "rio-clone-"));
    const url = `https://x-access-token:${token}@github.com/${owner}/${repoName}.git`;

    try {
        await $`git init`.cwd(dir).quiet();
        await $`git remote add origin ${url}`.cwd(dir).quiet();
        await $`git fetch --depth=1 origin ${sha}`.cwd(dir).quiet();
        await $`git checkout ${sha}`.cwd(dir).quiet();
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