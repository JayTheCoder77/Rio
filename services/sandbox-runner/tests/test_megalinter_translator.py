import json

from app.megalinter_translator import normalize_uri, translate_sarif
from rio_core.sandbox import LintResult

SARIF = {
    "runs": [
        {
            "tool": {"driver": {"name": "revive"}},
            "results": [
                {
                    "ruleId": "unused-param",
                    "message": {"text": "parameter is unused"},
                    "locations": [
                        {
                            "physicalLocation": {
                                "artifactLocation": {"uri": "file:///tmp/lint/main.go"},
                                "region": {"startLine": 7},
                            }
                        }
                    ],
                },
                {
                    "message": {"text": "no rule id"},
                    "locations": [
                        {
                            "physicalLocation": {
                                "artifactLocation": {"uri": "file:///tmp/lint/skipped.go"},
                                "region": {"startLine": 3},
                            }
                        }
                    ],
                },
            ],
        }
    ]
}


class TestNormalizeUri:
    def test_strips_file_scheme_and_workspace_prefix(self):
        assert normalize_uri("file:///tmp/lint/main.go") == "main.go"

    def test_strips_workspace_prefix_without_scheme(self):
        assert normalize_uri("/tmp/lint/lib/util.go") == "lib/util.go"

    def test_leaves_plain_relative_path(self):
        assert normalize_uri("main.go") == "main.go"


class TestTranslateSarif:
    def test_translates_and_filters_to_unhandled_files(self, tmp_path):
        sarif_path = tmp_path / "report.sarif"
        sarif_path.write_text(json.dumps(SARIF))

        # skipped.go is handled (not unhandled) → dropped entirely.
        results = translate_sarif(str(sarif_path), unhandled_files=["main.go"])

        assert results == [
            LintResult(
                file="main.go",
                line=7,
                rule_id="unused-param",
                message="parameter is unused",
                tool="revive",
            )
        ]

    def test_rule_id_falls_back_to_unknown(self, tmp_path):
        sarif = {"runs": [{"tool": {"driver": {"name": "clippy"}}, "results": [
            {
                "message": {"text": "warning"},
                "locations": [{"physicalLocation": {
                    "artifactLocation": {"uri": "file:///tmp/lint/x.rs"},
                    "region": {"startLine": 1},
                }}],
            }
        ]}]}
        p = tmp_path / "r.sarif"
        p.write_text(json.dumps(sarif))
        results = translate_sarif(str(p), unhandled_files=["x.rs"])
        assert results[0].rule_id == "unknown"
        assert results[0].tool == "clippy"