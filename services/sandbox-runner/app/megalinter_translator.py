import json

from rio_core.sandbox import LintResult

WORKSPACE_PREFIX = "/tmp/lint/"

def normalize_uri(uri: str) -> str:
    uri = uri.removeprefix("file://")
    uri = uri.removeprefix(WORKSPACE_PREFIX)
    return uri

def translate_sarif(sarif_path: str, unhandled_files: list[str]) -> list[LintResult]:
    with open(sarif_path) as f:
        sarif = json.load(f)

    results: list[LintResult] = []
    for run in sarif["runs"]:
        tool_name = run["tool"]["driver"]["name"]
        for r in run["results"]:
            loc = r["locations"][0]["physicalLocation"]
            uri = loc["artifactLocation"]["uri"]
            normalized = normalize_uri(uri)
            if normalized not in unhandled_files:
                continue
            matched = normalized
            if matched is None:
                continue
            results.append(LintResult(
                file=matched,
                line=loc["region"]["startLine"],
                rule_id=r.get("ruleId") or "unknown",
                message=r["message"]["text"],
                tool=tool_name,
            ))
    return results