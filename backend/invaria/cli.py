import argparse
import json
import sys
from pathlib import Path
from uuid import uuid4

from .engine import analyze
from .ingestion import FIXTURES, inventory
from .models import ScanRequest
from .pipeline import execute_scan
from .storage import Scan, Session, init_db, serialize


def main():
    parser = argparse.ArgumentParser(description="Invaria local static security analysis")
    sub = parser.add_subparsers(dest="command", required=True)
    scan = sub.add_parser("scan")
    scan.add_argument("repository")
    scan.add_argument("--fixture", action="store_true")
    scan.add_argument("--model", action="store_true")
    scan.add_argument("--output", type=Path)
    sub.add_parser("evaluate")
    args = parser.parse_args()
    if args.command == "evaluate":
        cases = []
        for folder in sorted(FIXTURES.iterdir()):
            result = analyze(inventory(folder)[0])
            expected = 0 if folder.name.endswith("fixed") else 1
            cases.append(
                {
                    "case": folder.name,
                    "expected": expected,
                    "actual": len(result["findings"]),
                    "passed": len(result["findings"]) == expected,
                }
            )
        print(json.dumps({"cases": cases, "passed": all(c["passed"] for c in cases)}, indent=2))
        sys.exit(0 if all(c["passed"] for c in cases) else 1)
    init_db(recover=False)
    request = ScanRequest(
        source="fixture" if args.fixture else "github", repository=args.repository, use_model=args.model
    )
    id = str(uuid4())
    with Session.begin() as db:
        db.add(
            Scan(
                id=id, repository=request.repository, source=request.source, payload={"use_model": args.model}
            )
        )
    execute_scan(id, request)
    with Session() as db:
        result = serialize(db.get(Scan, id))
    output = json.dumps(result, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8")
        print(f"Report saved to {args.output}. Status: {result['status']}")
    else:
        print(output)
    sys.exit(0 if result["status"] == "completed" else 1)


if __name__ == "__main__":
    main()
