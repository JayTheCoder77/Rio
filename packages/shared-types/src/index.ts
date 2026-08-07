export interface PrReviewJob {
    repo : string;
    prNumber : number;
    baseSha : string;
    headSha : string;
    installationId : number;
    githubRepoId : number;
}

export interface IndexRepoJob {
    repoId: string;        // DB repos.id (UUID) — used as Pinecone namespace
    repo : string;         // "owner/repoName" full_name, split inside the worker
    sha : string;          // default branch HEAD sha to index at
    installationId : number;
}
