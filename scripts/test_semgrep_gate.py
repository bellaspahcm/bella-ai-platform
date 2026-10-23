"""Control-path tests using scanner/Git doubles; actual scans remain CI evidence."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("semgrep_gate", Path(__file__).with_name("run-semgrep-gate.py"))
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)
HEAD, BASE = "a" * 40, "b" * 40


def sarif(findings=0, successful=True):
    return {"version": "2.1.0", "runs": [{"tool": {"driver": {"rules": [{"id": "test-rule"}]}},
        "invocations": [{"executionSuccessful": successful}], "results": [{"ruleId": "test-rule"}] * findings}]}


class GateTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.previous = Path.cwd()
        os.chdir(self.directory.name)
        self.addCleanup(self.directory.cleanup)
        self.addCleanup(os.chdir, self.previous)
        self.calls = []

    def execute(self, scans, *, event="pull_request", base=BASE, git_error=False):
        def child(args, **kwargs):
            self.calls.append(args)
            if args[0] == "git":
                if git_error:
                    raise subprocess.CalledProcessError(1, args)
                return subprocess.CompletedProcess(args, 0, HEAD + "\n")
            code, report = scans.pop(0)
            if report is not None:
                Path(args[args.index("--output") + 1]).write_text(json.dumps(report), encoding="utf-8")
            return subprocess.CompletedProcess(args, code)
        with patch.dict(os.environ, {"GITHUB_EVENT_NAME": event, "SEMGREP_HEAD_SHA": HEAD, "SEMGREP_BASE_SHA": base}, clear=True), patch.object(gate.subprocess, "run", side_effect=child):
            return gate.run_gate()

    def test_old_findings_retained_and_native_baseline_passes(self):
        self.assertEqual(self.execute([(1, sarif(3)), (0, sarif())]), 0)
        summary = json.loads(Path("semgrep-gate.json").read_text())
        self.assertEqual(summary["full"]["status"], "FINDINGS")
        self.assertEqual(summary["diff"]["findings"], 0)
        self.assertIn(BASE, self.calls[-1])
        self.assertIn("--baseline-commit", self.calls[-1])
        self.assertNotIn("--baseline-commit", self.calls[-2])

    def test_new_finding_blocks_even_when_in_existing_file(self):
        self.assertEqual(self.execute([(1, sarif(3)), (1, sarif(1))]), 1)
        self.assertEqual(json.loads(Path("semgrep-gate.json").read_text())["gate"], "FAIL_FINDINGS")

    def test_non_pr_keeps_full_scan_blocking(self):
        self.assertEqual(self.execute([(1, sarif(3))], event="push"), 1)
        self.assertFalse(any("--baseline-commit" in c for c in self.calls))

    def test_bad_base_or_git_error_stops_before_scanner(self):
        for kwargs in [{"base": ""}, {"base": "main"}, {"git_error": True}]:
            self.calls = []
            with self.assertRaises((ValueError, subprocess.SubprocessError)):
                self.execute([], **kwargs)
            self.assertFalse(any(c[0] == "semgrep" for c in self.calls))

    def test_scanner_errors_missing_and_inconsistent_reports_never_pass(self):
        for scans in [[(2, sarif())], [(0, None)], [(0, {})], [(0, sarif(0, False))], [(0, sarif(1))], [(1, sarif())], [(0, sarif()), (0, None)], [(0, sarif()), (2, sarif())]]:
            with self.subTest(scans=scans), self.assertRaises((ValueError, OSError)):
                self.execute(scans)

    def test_stale_report_does_not_fill_missing_scanner_output(self):
        Path("semgrep-results.sarif").write_text(json.dumps(sarif()))
        with self.assertRaises(OSError):
            self.execute([(0, None)])

    def test_warning_level_parse_errors_and_timeouts_never_become_clean_results(self):
        for descriptor in ["Syntax error", "Timeout", "Invalid configuration"]:
            report = sarif()
            report["runs"][0]["invocations"][0]["toolExecutionNotifications"] = [{"level": "warning", "descriptor": {"id": descriptor}}]
            with self.subTest(descriptor=descriptor), self.assertRaises(ValueError):
                self.execute([(0, report)])
        with self.assertRaises(ValueError):
            self.execute([(3, sarif())])
        self.assertIn("--strict", self.calls[-1])


if __name__ == "__main__":
    unittest.main()
