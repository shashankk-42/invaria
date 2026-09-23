import hmac
import json
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from threading import BoundedSemaphore, Lock
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse, Response
from sqlalchemy import select

from .config import settings
from .documents import save_uploads, write_manifest
from .ingestion import parse_github_url
from .models import Feedback, ScanRequest
from .overview import generate_business_impact, generate_overview
from .pipeline import execute_scan
from .rag import index_knowledge
from .reasoning import model_health
from .storage import Scan, Session, database_health, init_db, serialize, update_scan

executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="invaria-scan")
capacity = BoundedSemaphore(6)
overview_lock = Lock()
business_impact_lock = Lock()


@asynccontextmanager
async def lifespan(app):
    init_db()
    yield
    executor.shutdown(wait=True)


app = FastAPI(title="Invaria Security API", version="0.1.0", lifespan=lifespan)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "testserver", "api"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def protect_local_api(request: Request, call_next):
    origin = request.headers.get("origin")
    if origin and origin not in settings.cors_origins:
        return JSONResponse({"detail": "Origin is not allowed."}, status_code=403)
    if request.method != "OPTIONS" and settings.api_token:
        expected = f"Bearer {settings.api_token}"
        if not hmac.compare_digest(request.headers.get("authorization", ""), expected):
            return JSONResponse({"detail": "API token required."}, status_code=401)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/health")
def health():
    return {"status": "ok", "database": database_health(), "version": "0.1.0", "mode": "local-development"}


@app.get("/api/models")
def models():
    return model_health()


@app.get("/api/fixtures")
def fixtures():
    return [
        {"id": f"{category}-{variant}", "name": f"{label} · {variant}"}
        for category, label in [
            ("bola", "Object authorization"),
            ("injection", "SQL injection"),
            ("secrets", "Hardcoded credential"),
        ]
        for variant in ["vulnerable", "fixed"]
    ]


async def parse_scan_request(request: Request):
    """Keep the JSON API stable while accepting optional multipart documents."""
    content_type = request.headers.get("content-type", "")
    if content_type.startswith("multipart/form-data"):
        # Do not use the async context manager here: it closes UploadFile
        # handles when this helper returns. The caller streams and closes each
        # handle before the request ends.
        form = await request.form(
            max_files=settings.max_documents,
            max_fields=30,
            max_part_size=settings.max_document_bytes,
        )
        try:
            body = ScanRequest.model_validate(
                {
                    "source": form.get("source", "github"),
                    "repository": form.get("repository", ""),
                    "use_model": str(form.get("use_model", "false")).lower() in {"true", "1", "on"},
                }
            )
        except ValueError as exc:
            raise HTTPException(422, "Invalid analysis request.") from exc
        # Starlette owns the concrete UploadFile implementation. Duck typing
        # stays compatible across FastAPI and Starlette releases while
        # rejecting ordinary multipart fields named "documents".
        uploads = [
            item
            for item in form.getlist("documents")
            if hasattr(item, "filename") and hasattr(item, "read") and hasattr(item, "close")
        ]
        return body, uploads
    try:
        return ScanRequest.model_validate(await request.json()), []
    except (ValueError, TypeError) as exc:
        raise HTTPException(422, "Provide a JSON analysis request or multipart form data.") from exc


@app.post("/api/scans", status_code=202)
async def create_scan(request: Request):
    body, uploads = await parse_scan_request(request)
    if body.source == "github":
        try:
            parse_github_url(body.repository)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
    elif body.repository not in {f["id"] for f in fixtures()}:
        raise HTTPException(422, "Unknown fixture.")
    if not capacity.acquire(blocking=False):
        raise HTTPException(429, "The local scan queue is full. Wait for an existing scan to finish.")
    id = str(uuid4())
    uploads_root = settings.data_dir / "uploads" / id
    try:
        saved_documents = await save_uploads(uploads, uploads_root)
        write_manifest(uploads_root, saved_documents)
        pending_documents = [
            {
                "id": document.id,
                "name": document.name,
                "extension": document.extension,
                "size_bytes": document.size_bytes,
                "sha256": document.sha256,
                "status": "queued",
                "characters_extracted": 0,
                "headings": [],
                "excerpt": "",
            }
            for document in saved_documents
        ]
        with Session.begin() as db:
            scan = Scan(
                id=id,
                repository=body.repository,
                source=body.source,
                payload={
                    "use_model": body.use_model,
                    "documentation": {
                        "trust": "untrusted-hints-only",
                        "documents": pending_documents,
                        "business_context": [],
                    },
                },
            )
            db.add(scan)

        def run():
            try:
                execute_scan(id, body)
            finally:
                capacity.release()

        executor.submit(run)
    except ValueError as exc:
        if uploads_root.exists() and uploads_root.resolve().is_relative_to((settings.data_dir / "uploads").resolve()):
            import shutil

            shutil.rmtree(uploads_root)
        capacity.release()
        raise HTTPException(422, str(exc)) from exc
    except Exception:
        # This directory belongs to a single UUID scan that has not been queued.
        if uploads_root.exists() and uploads_root.resolve().is_relative_to((settings.data_dir / "uploads").resolve()):
            import shutil

            shutil.rmtree(uploads_root)
        capacity.release()
        raise
    return {"id": id, "status": "queued", "documents": len(uploads)}


@app.get("/api/scans")
def list_scans():
    with Session() as db:
        return [
            serialize(s, False) for s in db.scalars(select(Scan).order_by(Scan.created_at.desc()).limit(100))
        ]


@app.get("/api/scans/{id}")
def get_scan(id: str):
    with Session() as db:
        scan = db.get(Scan, id)
        if not scan:
            raise HTTPException(404, "Scan not found.")
        return serialize(scan)


@app.post("/api/scans/{id}/overview", status_code=202)
def create_overview(id: str):
    # This app runs one API worker. Serialize enqueue decisions so polling tabs
    # cannot schedule the same local inference repeatedly.
    with overview_lock:
        scan = get_scan(id)
        if scan["status"] != "completed":
            raise HTTPException(409, "Wait for the scan to complete.")
        overview = scan.get("product_overview", {})
        if overview.get("status") in {"queued", "generating", "ready"}:
            return overview
        if not capacity.acquire(blocking=False):
            raise HTTPException(429, "The local queue is full. Try again after a scan finishes.")
        try:
            update_scan(id, product_overview={"status": "queued"})

            def run_overview():
                try:
                    generate_overview(id)
                finally:
                    capacity.release()

            executor.submit(run_overview)
        except Exception:
            capacity.release()
            update_scan(id, product_overview={"status": "unavailable", "message": "Please retry the overview."})
            raise
    return {"status": "queued"}


@app.post("/api/scans/{id}/business-impact", status_code=202)
def create_business_impact(id: str):
    with business_impact_lock:
        scan = get_scan(id)
        if scan["status"] != "completed":
            raise HTTPException(409, "Wait for the scan to complete.")
        impact_overview = scan.get("business_impact_overview", {})
        if impact_overview.get("status") in {"queued", "generating", "ready"}:
            return impact_overview
        if not capacity.acquire(blocking=False):
            raise HTTPException(429, "The local queue is full. Try again after a scan finishes.")
        try:
            update_scan(id, business_impact_overview={"status": "queued"})

            def run_business_impact():
                try:
                    generate_business_impact(id)
                finally:
                    capacity.release()

            executor.submit(run_business_impact)
        except Exception:
            capacity.release()
            update_scan(id, business_impact_overview={
                "status": "unavailable",
                "message": "Please retry the business impact overview.",
            })
            raise
    return {"status": "queued"}


@app.patch("/api/scans/{id}/findings/{finding_id}")
def feedback(id: str, finding_id: str, body: Feedback):
    with Session.begin() as db:
        scan = db.get(Scan, id)
        if not scan:
            raise HTTPException(404, "Scan not found.")
        if scan.status != "completed":
            raise HTTPException(409, "Wait for the scan to complete before reviewing findings.")
        payload = {**scan.payload}
        findings = [dict(f) for f in payload.get("findings", [])]
        finding = next((f for f in findings if f["id"] == finding_id), None)
        if not finding:
            raise HTTPException(404, "Finding not found.")
        finding["review_status"], finding["review_note"] = body.status, body.note
        scan.payload = {**payload, "findings": findings}
    return finding


@app.get("/api/scans/{id}/export")
def export_scan(id: str, format: str = "json"):
    scan = get_scan(id)
    if scan["status"] != "completed":
        raise HTTPException(409, "Report is available when the scan completes.")
    if format == "json":
        return Response(
            json.dumps(scan, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="invaria-{id}.json"'},
        )
    if format != "markdown":
        raise HTTPException(422, "Export format must be json or markdown.")
    lines = [
        "# Invaria security report",
        "",
        f"Repository: {scan['repository']}",
        f"Commit: {scan.get('commit', '')}",
        "",
        "Static candidates require manual review; this report is not proof of exploitability.",
        "",
    ]
    overview = scan.get("product_overview", {})
    if overview.get("status") == "ready":
        lines += ["## Product overview", "", overview["summary"], ""]
        lines += [f"- {activity}" for activity in overview.get("activities", [])]
        lines += ["", overview["document_context"], "", "AI-generated context; not a security assessment.", ""]
    documentation = scan.get("documentation", {})
    if documentation.get("documents"):
        lines += ["## Untrusted business documentation", ""]
        lines += [
            "These documents are context hints only. They are not source evidence or ground truth for security findings.",
            "",
        ]
        lines += [
            f"- {document['name']} ({document['status']}; {document['characters_extracted']} extracted characters)"
            for document in documentation["documents"]
        ]
        lines.append("")
    business_impact = scan.get("business_impact_overview", {})
    impacts_by_finding = {
        impact["finding_id"]: impact
        for impact in business_impact.get("impacts", [])
    }
    if business_impact.get("status") == "ready":
        lines += ["## Business impact overview", "", business_impact["summary"], ""]
    for finding in scan.get("findings", []):
        lines += [
            f"## {finding['title']}",
            "",
            f"Severity: {finding['severity']} | Confidence: {finding['confidence']} | Review: {finding['review_status']}",
            "",
            finding["summary"],
            "",
            "Impact: " + finding["impact"],
            "",
        ]
        if impact := impacts_by_finding.get(finding["id"]):
            lines += [
                "Potential business impact: " + impact["business_impact"],
                "",
                "Affected areas: " + ", ".join(impact["affected_areas"]),
                "",
                "Business context caveat: " + impact["caveat"],
                "",
            ]
        lines += [
            "Remediation: " + finding["remediation"],
            "",
        ]
        for ev in finding["evidence"]:
            lines += [f"{ev['file']}:{ev['line']}", "", "````text", ev["snippet"], "````", ""]
    lines += ["## Coverage limitations", "", *["- " + x for x in scan.get("limitations", [])]]
    return Response(
        "\n".join(lines),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="invaria-{id}.md"'},
    )


@app.post("/api/knowledge/index")
def knowledge_index():
    try:
        return index_knowledge()
    except Exception as exc:
        raise HTTPException(
            503, "Vector indexing requires PostgreSQL with pgvector and the EmbeddingGemma model in Ollama."
        ) from exc
