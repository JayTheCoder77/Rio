export interface PrReviewJob {
    repo : string;
    prNumber : number;
    baseSha : string;
    headSha : string;
    installationId : number;
    githubRepoId : number;
}

