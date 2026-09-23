import logging
import shutil
from collections import Counter
from time import perf_counter

from .config import settings
from .documents import process_documents
from .engine import verify
from .ingestion import ingest
from .rag import guidance_for
from .reasoning import model_health, reason
from .semgrep_runner import run_semgrep
from .storage import document_metadata, replace_scan_documents, update_scan
from .worker import isolated_analysis

logger = logging.getLogger(__name__)
STAGES = ["ingestion", "extraction", "baseline", "reasoning", "verification", "report"]


def execute_scan(id, request):
    started = perf_counter()
    root = settings.data_dir / "snapshots" / id
    documents_root = settings.data_dir / "uploads" / id
    events = []

    def stage(name, message):
        events.append(
            {"stage": name, "message": message, "elapsed_seconds": round(perf_counter() - started, 2)}
        )
        update_scan(id, status="running", stage=name, events=events)

    try:
        stage("ingestion", "Reading the repository snapshot and optional business documentation.")
        documents = process_documents(documents_root)
        replace_scan_documents(id, documents)
        documentation = {
            "trust": "untrusted-hints-only",
            "documents": document_metadata(documents),
            "business_context": [
                {"name": document["name"], "headings": document["headings"], "excerpt": document["excerpt"]}
                for document in documents
                if document["status"] == "ingested"
            ],
        }
        warnings = [
            f"Could not extract {document['name']}: {document.get('error', 'unknown error')}"
            for document in documents
            if document["status"] == "unreadable"
        ]
        update_scan(id, documentation=documentation)
        files, source_warnings, commit = ingest(request.source, request.repository, root)
        warnings += source_warnings
        if not files:
            raise ValueError("No supported source files found in this repository.")
        stage("extraction", f"Parsing {len(files)} files and building the application security graph.")
        analysis = isolated_analysis(root)
        warnings += analysis.pop("warnings")
        findings = analysis.pop("findings")
        stage("baseline", "Running deterministic security checks and the optional Semgrep baseline.")
        extra, semgrep = run_semgrep(root, files)
        for candidate in extra:
            if not any(
                f.category == candidate.category
                and any(
                    e.file == candidate.evidence[0].file
                    and e.line <= candidate.evidence[0].line <= e.end_line
                    for e in f.evidence
                )
                for f in findings
            ):
                findings.append(candidate)
        stage("reasoning", "Retrieving trusted guidance and reviewing evidence bundles.")
        health = model_health() if request.use_model else {"reasoning_ready": False}
        model_status = (
            "not-requested"
            if not request.use_model
            else "completed"
            if health["reasoning_ready"]
            else "unavailable"
        )
        if request.use_model and not health["reasoning_ready"]:
            warnings.append(
                f"Requested model {settings.reasoning_model} is unavailable. Findings have deterministic evidence only."
            )
        llm_runs, retrieval_modes = [], set()
        for finding in findings:
            guidance, mode = guidance_for(finding)
            retrieval_modes.add(mode)
            finding.references = [{"title": g["title"], "url": g["url"]} for g in guidance]
            if request.use_model and health["reasoning_ready"]:
                try:
                    finding.reasoning = reason(finding, guidance, documentation["business_context"])
                    llm_runs.append(
                        {"finding_id": finding.id, "status": "accepted", "model": settings.reasoning_model}
                    )
                except Exception as exc:
                    model_status = "partial"
                    llm_runs.append(
                        {
                            "finding_id": finding.id,
                            "status": "rejected",
                            "model": settings.reasoning_model,
                            "reason": type(exc).__name__,
                        }
                    )
                    warnings.append(
                        f"Model review unavailable or rejected for {finding.id}; static finding retained."
                    )
        stage("verification", "Checking every evidence file, line range, and snippet against the snapshot.")
        verified = [f for f in findings if verify(f, files)]
        if len(verified) != len(findings):
            warnings.append("Findings with inconsistent evidence were rejected.")
        if not analysis["routes"]:
            warnings.append(
                "No supported Express routes found. Zero route findings does not mean this application is safe."
            )
        stage("report", "Saving findings, graph, coverage and model audit records.")
        counts = Counter(f.severity for f in verified)
        update_scan(
            id,
            status="completed",
            stage="completed",
            **analysis,
            documentation=documentation,
            findings=[f.model_dump() for f in verified],
            commit=commit,
            warnings=warnings,
            semgrep=semgrep,
            model_status=model_status,
            llm_runs=llm_runs,
            retrieval_modes=sorted(retrieval_modes),
            duration_seconds=round(perf_counter() - started, 2),
            summary={"total": len(verified), **{s: counts[s] for s in ["critical", "high", "medium", "low"]}},
            limitations=[
                "JavaScript/TypeScript and statically declared Express routes only.",
                "Bounded syntax and local alias analysis; no complete control-flow, type, or runtime proof.",
                "Authorization candidates require confirmation of the resource access policy and external controls.",
                "Model prose is advisory; only its schema and evidence references are mechanically validated.",
            ],
        )
    except Exception as exc:
        logger.exception("Scan %s failed", id)
        message = (
            str(exc)
            if isinstance(exc, ValueError)
            else "Scan failed while processing the repository. Check the local server log and retry."
        )
        update_scan(id, status="failed", stage="failed", error=message, events=events)
    finally:
        # Only our generated UUID snapshot directory is removed; evidence is persisted.
        if root.exists() and root.resolve().is_relative_to((settings.data_dir / "snapshots").resolve()):
            shutil.rmtree(root)
        if documents_root.exists() and documents_root.resolve().is_relative_to((settings.data_dir / "uploads").resolve()):
            shutil.rmtree(documents_root)
