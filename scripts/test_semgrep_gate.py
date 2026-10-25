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


def sarif(findings=0, successful=True, notifications=None):
    return {"version": "2.1.0", "runs": [{"tool": {"driver": {"rules": [{"id": "test-rule"}]}},
        "invocations": [{"executionSuccessful": successful, "toolExecutionNotifications": notifications or []}],
        "results": [{"ruleId": "test-rule"}] * findings}]}


def warning(message, level="warning"):
    return {"level": level, "message": {"text": message}}


class GateTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.previous = Path.cwd()
        os.chdir(self.directory.name)
        self.addCleanup(self.directory.cleanup)
        self.addCleanup(os.chdir, self.previous)
        self.calls = []

    def execute(self, scans, *, event="pull_request", base=BASE, git_error=False,
                ref="refs/heads/main", ancestor=True, checkout=HEAD):
        def child(args, **kwargs):
            self.calls.append(args)
            if args[0] == "git":
                if git_error:
                    raise subprocess.CalledProcessError(1, args)
                if "--is-ancestor" in args and not ancestor:
                    raise subprocess.CalledProcessError(1, args)
                if "ls-tree" in args:
                    return subprocess.CompletedProcess(args, 0, "changed.py\nunchanged.py\n")
                if "--name-only" in args:
                    return subprocess.CompletedProcess(args, 0, "changed.py\n")
                return subprocess.CompletedProcess(args, 0, checkout + "\n")
            code, report = scans.pop(0)
            if report is not None:
                Path(args[args.index("--output") + 1]).write_text(json.dumps(report), encoding="utf-8")
            return subprocess.CompletedProcess(args, code)
        with patch.dict(os.environ, {"GITHUB_EVENT_NAME": event, "GITHUB_REF": ref,
                                    "SEMGREP_HEAD_SHA": HEAD, "SEMGREP_BASE_SHA": base}, clear=True), patch.object(gate.subprocess, "run", side_effect=child):
            return gate.run_gate()

    def test_old_findings_retained_and_native_baseline_passes(self):
        old_warning = warning("Syntax error at line unchanged.py:12: parse failure")
        self.assertEqual(self.execute([(1, sarif(3, notifications=[old_warning])), (0, sarif())]), 0)
        summary = json.loads(Path("semgrep-gate.json").read_text())
        self.assertEqual(summary["full"]["status"], "FINDINGS")
        self.assertEqual(summary["full"]["preexisting_warnings"], 1)
        self.assertEqual(summary["diff"]["findings"], 0)
        self.assertIn(BASE, self.calls[-1])
        self.assertIn("--baseline-commit", self.calls[-1])
        self.assertNotIn("--baseline-commit", self.calls[-2])

    def test_new_finding_blocks_even_when_in_existing_file(self):
        self.assertEqual(self.execute([(1, sarif(3)), (1, sarif(1))]), 1)
        self.assertEqual(json.loads(Path("semgrep-gate.json").read_text())["gate"], "FAIL_FINDINGS")

    def test_warning_on_changed_or_unknown_file_fails_closed(self):
        for notification in [
            warning("Syntax error at line changed.py:8: parse failure"),
            warning("Scanner emitted an unlocated warning"),
        ]:
            with self.subTest(notification=notification), self.assertRaises(ValueError):
                self.execute([(1, sarif(notifications=[notification])), (0, sarif())])

    def test_error_notification_fails_even_when_its_file_is_unchanged(self):
        with self.assertRaises(ValueError):
            self.execute([(1, sarif(notifications=[warning("Syntax error at line unchanged.py:8: failed", "error")])), (0, sarif())])

    def test_main_push_retains_full_report_and_compares_event_before(self):
        old_warning = warning("Syntax error at line unchanged.py:12: parse failure")
        full = sarif(3, notifications=[old_warning])
        self.assertEqual(self.execute([(1, full), (0, sarif())], event="push"), 0)
        summary = json.loads(Path("semgrep-gate.json").read_text())
        self.assertEqual(summary["base"], BASE)
        self.assertEqual(summary["full"]["findings"], 3)
        self.assertEqual(summary["full"]["preexisting_warnings"], 1)
        self.assertEqual(json.loads(Path("semgrep-results.sarif").read_text()), full)
        self.assertEqual(summary["diff"]["findings"], 0)
        self.assertIn(["--baseline-commit", BASE], [c[-2:] for c in self.calls])
        self.assertTrue(any("--is-ancestor" in c and c[-2:] == [BASE, HEAD] for c in self.calls))
        self.assertTrue(any("diff" in c and c[-1] == BASE + ".." + HEAD for c in self.calls))
        self.assertNotIn("--baseline-commit", self.calls[-2])

    def test_main_push_blocks_new_findings(self):
        self.assertEqual(self.execute([(1, sarif(3)), (1, sarif(1))], event="push"), 1)
        self.assertEqual(json.loads(Path("semgrep-gate.json").read_text())["gate"], "FAIL_FINDINGS")

    def test_main_push_rejects_missing_invalid_or_zero_before(self):
        for base in ["", "main", "0" * 40]:
            self.calls = []
            with self.subTest(base=base), self.assertRaises(ValueError):
                self.execute([], event="push", base=base)
            self.assertFalse(any(c[0] == "semgrep" for c in self.calls))

    def test_main_push_requires_ancestor_and_exact_checkout(self):
        for kwargs in [{"ancestor": False}, {"checkout": BASE}, {"git_error": True}]:
            self.calls = []
            with self.subTest(kwargs=kwargs), self.assertRaises((ValueError, subprocess.SubprocessError)):
                self.execute([], event="push", **kwargs)
            self.assertFalse(any(c[0] == "semgrep" for c in self.calls))

    def test_main_push_blocks_changed_unknown_and_untracked_warnings(self):
        for message in ["Syntax error at line changed.py:8: parse failure",
                        "Scanner emitted an unlocated warning", "Timeout on untracked.py: "]:
            for phase in ["full", "diff"]:
                scans = [(1, sarif(1, notifications=[warning(message)]))]
                if phase == "diff":
                    scans.insert(0, (1, sarif(3)))
                with self.subTest(message=message, phase=phase), self.assertRaisesRegex(
                        ValueError, "SCANNER_WARNING_ON_CHANGED_OR_UNKNOWN_FILE"):
                    self.execute(scans, event="push")

    def test_manual_scheduled_and_other_push_keep_full_scan_blocking(self):
        for event, ref in [("workflow_dispatch", "refs/heads/main"),
                           ("schedule", "refs/heads/main"), ("push", "refs/heads/other")]:
            self.calls = []
            with self.subTest(event=event, ref=ref):
                self.assertEqual(self.execute([(1, sarif(3))], event=event, ref=ref), 1)
                self.assertFalse(any("--baseline-commit" in c for c in self.calls))
                self.assertIsNone(json.loads(Path("semgrep-gate.json").read_text())["base"])

    def test_manual_and_scheduled_warnings_remain_blocking(self):
        for event in ["workflow_dispatch", "schedule"]:
            with self.subTest(event=event), self.assertRaises(ValueError):
                self.execute([(0, sarif(notifications=[warning("Timeout on unchanged.py: ")]))], event=event)

    def test_main_push_scanner_errors_in_either_phase_never_pass(self):
        for invalid in [(2, sarif()), (0, None), (0, {}), (0, sarif(0, False)),
                        (0, sarif(1)), (1, sarif()),
                        (0, sarif(notifications=[warning("Failure on unchanged.py: ", "error")]))]:
            for phase in ["full", "diff"]:
                scans = [invalid] if phase == "full" else [(1, sarif(3)), invalid]
                with self.subTest(invalid=invalid, phase=phase), self.assertRaises((ValueError, OSError)):
                    self.execute(scans, event="push")

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

    def test_scanner_warning_on_untracked_base_path_fails_closed(self):
        with self.assertRaises(ValueError):
            self.execute([(0, sarif(notifications=[warning("Timeout on untracked.py: ")]))])
        self.assertIn("--strict", self.calls[-1])
        with self.assertRaises(ValueError):
            self.execute([(3, sarif())])


if __name__ == "__main__":
    unittest.main()
