"""Exercise a running complete stack. Pass --model and --taskforge for live checks."""

import argparse
import json
import time
from pathlib import Path

import httpx

parser = argparse.ArgumentParser()
parser.add_argument("--url", default="http://127.0.0.1:3001")
parser.add_argument("--model", action="store_true")
parser.add_argument("--taskforge", action="store_true")
args = parser.parse_args()
client = httpx.Client(base_url=args.url, timeout=60, trust_env=False)


def run(repository, source="fixture", model=False):
    response = client.post(
        "/api/scans",
        json={"repository": repository, "source": source, "use_model": model},
        headers={"Origin": args.url},
    )
    response.raise_for_status()
    id = response.json()["id"]
    deadline = time.monotonic() + 900
    while time.monotonic() < deadline:
        response = client.get(f"/api/scans/{id}")
        response.raise_for_status()
        report = response.json()
        if report["status"] in {"completed", "failed"}:
            assert report["status"] == "completed", report
            return report
        time.sleep(1)
    raise AssertionError("Scan exceeded smoke-test timeout")


assert client.get("/").status_code == 200
health = client.get("/api/health").json()
assert health["status"] == "ok"
results = []
for family in ["bola", "injection", "secrets"]:
    for variant, expected in [("vulnerable", 1), ("fixed", 0)]:
        name = f"{family}-{variant}"
        report = run(name)
        assert report["summary"]["total"] == expected, report
        assert report["semgrep"]["status"] == "completed", report["semgrep"]
        results.append({"case": name, "id": report["id"], "findings": expected, "semgrep": report["semgrep"]})
        print(f"PASS {name}: {expected} findings, Semgrep completed", flush=True)
if args.model:
    index = client.post("/api/knowledge/index")
    index.raise_for_status()
    assert index.json()["mode"] == "pgvector", index.text
    report = run("bola-vulnerable", model=True)
    assert report["model_status"] == "completed", report.get("warnings")
    assert report["retrieval_modes"] == ["pgvector"]
    assert report["findings"][0]["reasoning"]["reference_validation"] == "passed"
    results.append(
        {
            "case": "live-gemma-pgvector",
            "id": report["id"],
            "model": report["findings"][0]["reasoning"]["model"],
        }
    )
    print("PASS live Gemma + EmbeddingGemma + PostgreSQL", flush=True)
if args.taskforge:
    report = run(
        "https://github.com/shashankk-42/taskforge-decentralized-compute-marketplace",
        source="github",
        model=args.model,
    )
    assert report["coverage"]["routes"] >= 19
    assert report["semgrep"]["status"] == "completed"
    if args.model:
        assert report["model_status"] == "completed", report.get("warnings")
    Path("artifacts").mkdir(exist_ok=True)
    Path("artifacts/taskforge-final-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    results.append(
        {
            "case": "taskforge",
            "id": report["id"],
            "findings": report["summary"]["total"],
            "coverage": report["coverage"],
            "model": report["model_status"],
        }
    )
    print(
        f"PASS TaskForge: {report['coverage']['routes']} routes, {report['summary']['total']} findings",
        flush=True,
    )
Path("artifacts").mkdir(exist_ok=True)
Path("artifacts/smoke-results.json").write_text(
    json.dumps({"health": health, "cases": results}, indent=2), encoding="utf-8"
)
client.close()
