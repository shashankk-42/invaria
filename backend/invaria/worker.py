"""Isolate native parsing failures from the HTTP process. Never executes target code."""

import json
import subprocess
import sys
from pathlib import Path

from .engine import analyze
from .ingestion import inventory
from .models import Finding


def isolated_analysis(root):
    result = subprocess.run(
        [sys.executable, "-m", "invaria.worker", str(root.resolve())],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=120,
        check=False,
    )
    if result.returncode != 0:
        raise ValueError(
            "Source parser could not complete this repository. The API is still available; review unsupported source complexity."
        )
    report = json.loads(result.stdout)
    report["findings"] = [Finding.model_validate(f) for f in report["findings"]]
    return report


if __name__ == "__main__":
    # A per-process address-space limit on Linux adds a bound around native parsers.
    if sys.platform != "win32":
        import resource

        resource.setrlimit(resource.RLIMIT_AS, (1024 * 1024 * 1024, 1024 * 1024 * 1024))
    files, _ = inventory(Path(sys.argv[1]))
    report = analyze(files)
    report["findings"] = [f.model_dump() for f in report["findings"]]
    print(json.dumps(report))
