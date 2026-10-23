"""Retain a full Semgrep report; PR acceptance uses Semgrep's native Git baseline."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def command(args, *, capture=False):
    return subprocess.run(args, check=True, text=True, capture_output=capture, timeout=120).stdout


def scan(path, baseline=None):
    # Never accept a stale report left by another invocation.
    report = Path(path)
    report.unlink(missing_ok=True)
    args = ["semgrep", "scan", "--config", "auto", "--sarif", "--output", path, "--error", "--strict"]
    if baseline:
        args.extend(["--baseline-commit", baseline])
    result = subprocess.run(args, check=False, timeout=1200)
    if result.returncode not in (0, 1):
        raise ValueError("SCANNER_EXECUTION_FAILED")
    data = json.loads(report.read_text(encoding="utf-8"))
    if data.get("version") != "2.1.0" or not isinstance(data.get("runs"), list) or not data["runs"]:
        raise ValueError("SCANNER_REPORT_INVALID")
    count = 0
    for run in data["runs"]:
        if not isinstance(run.get("results"), list) or not run.get("tool", {}).get("driver", {}).get("rules"):
            raise ValueError("SCANNER_REPORT_INVALID")
        invocations = run.get("invocations")
        if not isinstance(invocations, list) or not invocations:
            raise ValueError("SCANNER_INVOCATION_MISSING")
        for invocation in invocations:
            if invocation.get("executionSuccessful") is not True or any(
                n.get("level") in ("error", "warning") for n in invocation.get("toolExecutionNotifications", [])
            ):
                raise ValueError("SCANNER_REPORTED_ERROR")
        # Rule-specific accepted suppressions stay visible in the full SARIF.
        count += sum(not r.get("suppressions") for r in run["results"])
    if (result.returncode == 0) != (count == 0):
        raise ValueError("SCANNER_EXIT_REPORT_MISMATCH")
    return {"status": "PASS" if count == 0 else "FINDINGS", "findings": count, "report": path}


def run_gate():
    event = os.environ.get("GITHUB_EVENT_NAME")
    head = os.environ.get("SEMGREP_HEAD_SHA", "")
    base = os.environ.get("SEMGREP_BASE_SHA", "")
    if not re.fullmatch(r"[a-f0-9]{40}", head) or (event == "pull_request" and not re.fullmatch(r"[a-f0-9]{40}", base)):
        raise ValueError("INVALID_COMPARISON_REVISION")
    git = ["git", "-c", "safe.directory=" + str(Path.cwd())]
    if command(git + ["rev-parse", "HEAD"], capture=True).strip() != head:
        raise ValueError("CHECKOUT_REVISION_MISMATCH")
    # Isolate the built-in baseline from ambient configuration.
    os.environ.pop("SEMGREP_BASELINE_COMMIT", None)
    if event == "pull_request":
        command(git + ["fetch", "--no-tags", "origin", base, head])
        command(git + ["cat-file", "-e", base + "^{commit}"])
        merge_base = command(git + ["merge-base", base, head], capture=True).strip()
        if not re.fullmatch(r"[a-f0-9]{40}", merge_base):
            raise ValueError("COMPARISON_ANCESTRY_UNAVAILABLE")
    full = scan("semgrep-results.sarif")
    diff = scan("semgrep-diff.sarif", base) if event == "pull_request" else None
    decision = diff or full
    summary = {"head": head, "base": base if diff else None, "full": full, "diff": diff,
               "gate": "PASS" if decision["status"] == "PASS" else "FAIL_FINDINGS"}
    Path("semgrep-gate.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary))
    return 0 if summary["gate"] == "PASS" else 1


if __name__ == "__main__":
    try:
        sys.exit(run_gate())
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        # Missing evidence, transport/Git/scanner errors never count as no findings.
        Path("semgrep-gate.json").write_text('{"gate":"FAIL_EXECUTION_OR_EVIDENCE"}\n', encoding="utf-8")
        print("SEMGREP_GATE_EXECUTION_OR_EVIDENCE_FAILED", file=sys.stderr)
        sys.exit(2)
