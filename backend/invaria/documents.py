"""Ingest business documents as untrusted context, never source evidence.

Document bytes live only long enough to extract bounded text. The retained document
record is isolated from repository source, graph nodes, rule matching and evidence.
"""

import hashlib
import json
import re
import shutil
import subprocess
import sys
import uuid
import zipfile
from dataclasses import asdict, dataclass
from pathlib import Path, PurePosixPath

from .config import settings

ALLOWED_EXTENSIONS = {".md", ".txt", ".pdf", ".docx", ".doc"}
TEXT_EXTENSIONS = {".md", ".txt"}
MAX_HEADINGS = 12
MAX_EXCERPT_CHARACTERS = 800


@dataclass
class SavedDocument:
    id: str
    name: str
    extension: str
    size_bytes: int
    sha256: str
    path: str


def safe_document_name(name: str | None) -> tuple[str, str]:
    candidate = PurePosixPath((name or "").replace("\\", "/")).name.strip()
    if not candidate or candidate in {".", ".."} or "\x00" in candidate:
        raise ValueError("Each uploaded document needs a valid filename.")
    extension = Path(candidate).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        supported = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise ValueError(f"Unsupported document {candidate!r}. Supported files: {supported}.")
    return candidate[:180], extension


async def save_uploads(files, destination: Path) -> list[SavedDocument]:
    if len(files) > settings.max_documents:
        raise ValueError(f"Upload at most {settings.max_documents} documents per analysis.")
    destination.mkdir(parents=True, exist_ok=True)
    total = 0
    saved = []
    try:
        for upload in files:
            name, extension = safe_document_name(upload.filename)
            document_id = str(uuid.uuid4())
            path = destination / f"{document_id}{extension}"
            digest = hashlib.sha256()
            size = 0
            with path.open("xb") as output:
                while chunk := await upload.read(64 * 1024):
                    size += len(chunk)
                    total += len(chunk)
                    if size > settings.max_document_bytes:
                        raise ValueError(f"{name} exceeds the {settings.max_document_bytes // 1_000_000} MB limit.")
                    if total > settings.max_document_total_bytes:
                        raise ValueError("Uploaded documents exceed the combined 25 MB limit.")
                    digest.update(chunk)
                    output.write(chunk)
            await upload.close()
            saved.append(
                SavedDocument(
                    id=document_id,
                    name=name,
                    extension=extension,
                    size_bytes=size,
                    sha256=digest.hexdigest(),
                    path=path.name,
                )
            )
    except Exception:
        shutil.rmtree(destination, ignore_errors=True)
        raise
    return saved


def strip_control_characters(value: str) -> str:
    return "".join(char for char in value if char in "\n\t" or ord(char) >= 32)


def normalize_text(value: str) -> str:
    value = strip_control_characters(value).replace("\r\n", "\n").replace("\r", "\n")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()[: settings.max_document_characters]


def document_hints(text: str, extension: str) -> tuple[list[str], str]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    headings = []
    if extension in {".md", ".txt"}:
        headings = [line.lstrip("#").strip() for line in lines if line.startswith("#")]
    if not headings:
        headings = [line for line in lines if len(line) <= 140 and not line.endswith((".", ";", ":"))][:MAX_HEADINGS]
    deduplicated = []
    for heading in headings:
        heading = heading[:180]
        if heading and heading not in deduplicated:
            deduplicated.append(heading)
    prose = [line for line in lines if not line.startswith("#")]
    return deduplicated[:MAX_HEADINGS], " ".join(prose)[:MAX_EXCERPT_CHARACTERS]


def validate_docx(path: Path):
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        if len(entries) > 2_000:
            raise ValueError("DOCX contains too many archive entries.")
        if "word/document.xml" not in archive.namelist():
            raise ValueError("DOCX does not contain a Word document body.")
        if sum(entry.file_size for entry in entries) > settings.max_document_characters * 20:
            raise ValueError("DOCX expands beyond the document processing limit.")


def extract_text(path: Path, extension: str) -> str:
    raw = path.read_bytes()
    if extension in TEXT_EXTENSIONS:
        return normalize_text(raw.decode("utf-8-sig"))
    if extension == ".pdf":
        if not raw.startswith(b"%PDF-"):
            raise ValueError("File is not a valid PDF.")
        from pypdf import PdfReader

        reader = PdfReader(path, strict=False)
        if len(reader.pages) > 300:
            raise ValueError("PDF exceeds the 300-page processing limit.")
        return normalize_text("\n".join(page.extract_text() or "" for page in reader.pages))
    if extension == ".docx":
        if not raw.startswith(b"PK"):
            raise ValueError("File is not a valid DOCX document.")
        validate_docx(path)
        from docx import Document

        document = Document(path)
        return normalize_text("\n".join(paragraph.text for paragraph in document.paragraphs))
    if extension == ".doc":
        if not raw.startswith(bytes.fromhex("D0CF11E0A1B11AE1")):
            raise ValueError("File is not a valid legacy Word document.")
        tool = shutil.which("antiword")
        if not tool:
            raise ValueError("Legacy .doc extraction needs antiword. Use Docker or convert the file to .docx.")
        result = subprocess.run([tool, str(path)], capture_output=True, timeout=20, check=False)
        if result.returncode != 0:
            raise ValueError("Could not read this legacy Word document. Convert it to .docx and retry.")
        return normalize_text(result.stdout.decode("utf-8", errors="replace"))
    raise ValueError("Unsupported document type.")


def extract_saved_documents(root: Path) -> list[dict]:
    manifest_path = root / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    documents = []
    remaining_characters = settings.max_document_characters
    for saved in manifest:
        record = {key: saved[key] for key in ("id", "name", "extension", "size_bytes", "sha256")}
        try:
            path = (root / saved["path"]).resolve()
            if not path.is_relative_to(root.resolve()):
                raise ValueError("Document path escaped upload directory.")
            text = extract_text(path, saved["extension"])[:remaining_characters]
            remaining_characters -= len(text)
            headings, excerpt = document_hints(text, saved["extension"])
            record.update(
                {
                    "status": "ingested" if text else "no-extractable-text",
                    "characters_extracted": len(text),
                    "headings": headings,
                    "excerpt": excerpt,
                    "content": text,
                }
            )
        except (OSError, UnicodeError, ValueError, zipfile.BadZipFile) as exc:
            record.update(
                {
                    "status": "unreadable",
                    "characters_extracted": 0,
                    "headings": [],
                    "excerpt": "",
                    "content": "",
                    "error": str(exc),
                }
            )
        documents.append(record)
    return documents


def write_manifest(root: Path, saved: list[SavedDocument]):
    manifest = [asdict(document) for document in saved]
    (root / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")


def process_documents(root: Path) -> list[dict]:
    if not root.exists() or not (root / "manifest.json").exists():
        return []
    result = subprocess.run(
        [sys.executable, "-m", "invaria.documents", "--worker", str(root.resolve())],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=settings.document_timeout,
        check=False,
    )
    if result.returncode != 0:
        return [
            {
                "id": "processing-error",
                "name": "Uploaded documentation",
                "extension": "",
                "size_bytes": 0,
                "sha256": "",
                "status": "unreadable",
                "characters_extracted": 0,
                "headings": [],
                "excerpt": "",
                "content": "",
                "error": "Documentation processing could not complete.",
            }
        ]
    return json.loads(result.stdout)


if __name__ == "__main__":
    if sys.platform != "win32":
        import resource

        resource.setrlimit(resource.RLIMIT_AS, (768 * 1024 * 1024, 768 * 1024 * 1024))
    if len(sys.argv) != 3 or sys.argv[1] != "--worker":
        raise SystemExit("Usage: python -m invaria.documents --worker DIRECTORY")
    print(json.dumps(extract_saved_documents(Path(sys.argv[2]))))
