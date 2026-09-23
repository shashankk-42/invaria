import json
import shutil
import subprocess
from pathlib import Path

from .config import settings
from .engine import evidence, stable, verify
from .models import Finding


def run_semgrep(root, files):
    command = shutil.which("semgrep")
    if not settings.semgrep_enabled or not command:
        return [], {
            "status": "unavailable",
            "message": "Built-in AST checks ran. Semgrep is available in the Linux Docker image.",
        }
    try:
        result = subprocess.run(
            [
                command,
                "scan",
                "--config",
                str(Path(__file__).parent / "rules/baseline.yml"),
                "--json",
                "--metrics=off",
                "--disable-version-check",
                "--no-git-ignore",
                "--timeout",
                "10",
                str(root.resolve()),
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            return [], {
                "status": "failed",
                "message": "Semgrep failed; built-in AST checks remain available.",
            }
        body = json.loads(result.stdout)
        findings = []
        for item in body.get("results", []):
            path = Path(item["path"]).resolve()
            if not path.is_relative_to(root.resolve()):
                continue
            name = path.relative_to(root.resolve()).as_posix()
            if name not in files:
                continue
            ev = evidence(files, name, item["start"]["line"], item["end"]["line"], "semgrep")
            finding = Finding(
                id=stable(item["check_id"], name, ev.line),
                rule_id=item["check_id"],
                title="Unsafe execution of request input",
                category="injection",
                severity="high",
                confidence=0.88,
                summary=item["extra"]["message"],
                impact="Untrusted input may change executed code or commands.",
                remediation="Remove dynamic evaluation and shell execution of request values. Use fixed operations with validated arguments.",
                evidence=[ev],
                assumptions=["Semgrep CE has bounded data-flow coverage; manually assess reachability."],
            )
            if verify(finding, files):
                findings.append(finding)
        return findings, {
            "status": "completed",
            "findings": len(findings),
            "errors": len(body.get("errors", [])),
        }
    except (subprocess.TimeoutExpired, ValueError, OSError, KeyError):
        return [], {"status": "failed", "message": "Semgrep timed out or returned invalid output."}
