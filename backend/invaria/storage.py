from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, create_engine, delete, select, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from .config import settings


def now():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Scan(Base):
    __tablename__ = "scans"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    repository: Mapped[str] = mapped_column(String(300))
    source: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="queued")
    stage: Mapped[str] = mapped_column(String(40), default="queued")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)


class ScanDocument(Base):
    __tablename__ = "scan_documents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    scan_id: Mapped[str] = mapped_column(ForeignKey("scans.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(180))
    extension: Mapped[str] = mapped_column(String(8))
    size_bytes: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32))
    characters_extracted: Mapped[int] = mapped_column(Integer, default=0)
    headings: Mapped[list] = mapped_column(JSON, default=list)
    excerpt: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[str] = mapped_column(Text, default="")
    error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


settings.data_dir.mkdir(parents=True, exist_ok=True)
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
    pool_pre_ping=True,
)
Session = sessionmaker(engine)


def init_db(recover=True):
    Base.metadata.create_all(engine)
    if not recover:
        return
    with Session.begin() as db:
        # One local worker process. A crash must not leave a permanently running scan.
        for scan in db.scalars(select(Scan).where(Scan.status.in_(["queued", "running"]))):
            scan.status = "failed"
            scan.stage = "interrupted"
            scan.payload = {**scan.payload, "error": "Scan interrupted by service restart. Start a new scan."}
        for scan in db.scalars(select(Scan).where(Scan.status == "completed")):
            if scan.payload.get("product_overview", {}).get("status") in {"queued", "generating"}:
                scan.payload = {**scan.payload, "product_overview": {
                    "status": "unavailable", "message": "Overview interrupted by restart. Please retry."
                }}
            if scan.payload.get("business_impact_overview", {}).get("status") in {"queued", "generating"}:
                scan.payload = {**scan.payload, "business_impact_overview": {
                    "status": "unavailable", "message": "Business impact overview interrupted by restart. Please retry."
                }}


def serialize(scan, detail=True):
    result = {
        "id": scan.id,
        "repository": scan.repository,
        "source": scan.source,
        "status": scan.status,
        "stage": scan.stage,
        "created_at": scan.created_at.isoformat(),
        "updated_at": scan.updated_at.isoformat(),
    }
    if detail:
        result.update(scan.payload)
    else:
        result.update(
            {
                k: v
                for k, v in scan.payload.items()
                if k in {"summary", "coverage", "commit", "error", "model_status"}
            }
        )
    return result


def update_scan(id, **changes):
    with Session.begin() as db:
        scan = db.get(Scan, id)
        for key in ("status", "stage"):
            if key in changes:
                setattr(scan, key, changes.pop(key))
        scan.payload = {**scan.payload, **changes}
        scan.updated_at = now()


def replace_scan_documents(scan_id, documents: list[dict]):
    """Save context separately so scanned source and security evidence never include document text."""
    with Session.begin() as db:
        db.execute(delete(ScanDocument).where(ScanDocument.scan_id == scan_id))
        for document in documents:
            db.add(
                ScanDocument(
                    id=document["id"],
                    scan_id=scan_id,
                    name=document["name"],
                    extension=document["extension"],
                    size_bytes=document["size_bytes"],
                    sha256=document["sha256"],
                    status=document["status"],
                    characters_extracted=document["characters_extracted"],
                    headings=document["headings"],
                    excerpt=document["excerpt"],
                    content=document["content"],
                    error=document.get("error", ""),
                )
            )


def document_metadata(documents: list[dict]) -> list[dict]:
    """Scan responses deliberately omit the retained document text."""
    visible = []
    for document in documents:
        metadata = {
            key: document[key]
            for key in (
                "id",
                "name",
                "extension",
                "size_bytes",
                "sha256",
                "status",
                "characters_extracted",
                "headings",
                "excerpt",
            )
        }
        if document.get("error"):
            metadata["error"] = document["error"]
        visible.append(metadata)
    return visible


def database_health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return "postgresql" if engine.dialect.name == "postgresql" else "sqlite"
