"""Bounded static ingestion. Repository code is never installed or executed."""

import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path, PurePosixPath
from urllib.parse import quote

import httpx

from .config import settings

EXCLUDED = {"node_modules", ".git", ".next", "dist", "build", "coverage", "vendor", ".venv", "venv"}
EXTENSIONS = {
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
    ".py", ".html", ".sql", ".prisma", ".json",
    ".yml", ".yaml", ".toml", ".ini",
}
FIXTURES = settings.fixture_dir
GITHUB_API_HEADERS = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "Invaria-local",
    "X-GitHub-Api-Version": "2022-11-28",
}


def parse_github_url(value: str) -> tuple[str, str]:
    match = re.fullmatch(r"https://github\.com/([A-Za-z0-9_-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?/?", value)
    if not match or match[2] in {".", ".."}:
        raise ValueError(
            "Use a public https://github.com/owner/repository URL without a branch or credentials."
        )
    return match[1], match[2]


def _github_error(response: httpx.Response, owner: str, repo: str) -> ValueError:
    """Turn GitHub's deliberately ambiguous API responses into useful local feedback."""
    repository_name = f"{owner}/{repo}"
    if response.status_code == 404:
        return ValueError(
            f"GitHub cannot find the public repository {repository_name}. "
            "Check the owner/repository name or make the repository public."
        )
    if response.status_code in {401, 403}:
        remaining = response.headers.get("X-RateLimit-Remaining")
        if remaining == "0":
            return ValueError("GitHub's public API rate limit has been reached. Wait a few minutes and retry.")
        return ValueError("GitHub did not allow this repository request. Retry shortly.")
    return ValueError(f"GitHub could not read {repository_name} (HTTP {response.status_code}).")


def verify_public_github_repository(repository: str) -> str:
    """Validate a GitHub URL before creating a scan record.

    GitHub returns 404 for a missing *or private* repository.  Checking here
    avoids leaving a failed scan in the user's history for a typo or a private
    source, while the worker repeats the check before taking its snapshot.
    """
    owner, repo = parse_github_url(repository)
    with httpx.Client(timeout=20, follow_redirects=False, trust_env=False) as client:
        response = client.get(
            f"https://api.github.com/repos/{owner}/{repo}", headers=GITHUB_API_HEADERS
        )
    if response.status_code != 200:
        raise _github_error(response, owner, repo)
    metadata = response.json()
    if metadata.get("private") or not isinstance(metadata.get("default_branch"), str):
        raise ValueError(f"GitHub cannot read the public repository {owner}/{repo}.")
    return metadata["default_branch"]


def inventory(root: Path) -> tuple[dict[str, str], list[str]]:
    files, warnings = {}, []
    total = 0
    root = root.resolve()
    for path in sorted(root.rglob("*")):
        rel = path.relative_to(root)
        if set(rel.parts) & EXCLUDED or path.is_symlink() or not path.is_file():
            continue
        if path.suffix not in EXTENSIONS or path.name.endswith((".min.js", ".d.ts")):
            continue
        if path.name in {"package-lock.json", "pnpm-lock.yaml"}:
            continue
        if not path.resolve().is_relative_to(root):
            continue
        if path.stat().st_size > settings.max_file_bytes:
            warnings.append(f"Skipped oversized file: {rel.as_posix()}")
            continue
        raw = path.read_bytes()
        total += len(raw)
        if len(files) >= settings.max_files or total > settings.max_total_bytes:
            raise ValueError("Repository exceeds source analysis limits. Scan a smaller repository.")
        try:
            files[rel.as_posix()] = raw.decode("utf-8")
        except UnicodeDecodeError:
            warnings.append(f"Skipped non-UTF-8 file: {rel.as_posix()}")
    return files, warnings


def ingest(source: str, repository: str, dest: Path) -> tuple[dict[str, str], list[str], str]:
    if source == "fixture":
        if repository not in {
            "bola-vulnerable",
            "bola-fixed",
            "injection-vulnerable",
            "injection-fixed",
            "secrets-vulnerable",
            "secrets-fixed",
        }:
            raise ValueError("Unknown fixture.")
        files, warnings = inventory(FIXTURES / repository)
        dest.mkdir(parents=True, exist_ok=True)
        for name, content in files.items():
            out = dest / name
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(content, encoding="utf-8")
        return files, warnings, "fixture-v1"
    owner, repo = parse_github_url(repository)
    # Resolve the default branch to a commit and download that immutable snapshot.
    with httpx.Client(timeout=60, follow_redirects=False, trust_env=False) as client:
        repository_response = client.get(
            f"https://api.github.com/repos/{owner}/{repo}", headers=GITHUB_API_HEADERS
        )
        if repository_response.status_code != 200:
            raise _github_error(repository_response, owner, repo)
        metadata = repository_response.json()
        default_branch = metadata.get("default_branch")
        if metadata.get("private") or not isinstance(default_branch, str):
            raise ValueError(f"GitHub cannot read the public repository {owner}/{repo}.")
        response = client.get(
            f"https://api.github.com/repos/{owner}/{repo}/commits/{quote(default_branch, safe='')}",
            headers=GITHUB_API_HEADERS,
        )
        if response.status_code != 200:
            if response.status_code == 409:
                raise ValueError("Repository is empty.")
            raise _github_error(response, owner, repo)
        sha = response.json().get("sha", "")
        if not re.fullmatch(r"[a-f0-9]{40}", sha):
            raise ValueError("Invalid GitHub commit response.")
        tree_response = client.get(
            f"https://api.github.com/repos/{owner}/{repo}/git/trees/{sha}",
            params={"recursive": "1"},
            headers=GITHUB_API_HEADERS,
        )
        if tree_response.status_code != 200:
            raise _github_error(tree_response, owner, repo)
        tree = tree_response.json()
        if tree.get("truncated"):
            raise ValueError("GitHub returned an incomplete file tree. Scan a smaller repository.")
        entries, skipped = [], []
        total = 0
        for entry in tree.get("tree", []):
            path = PurePosixPath(entry["path"])
            if entry["type"] != "blob" or entry.get("mode") == "120000" or set(path.parts) & EXCLUDED:
                continue
            if (
                path.suffix not in EXTENSIONS
                or path.name.endswith((".min.js", ".d.ts"))
                or path.name == "package-lock.json"
            ):
                continue
            if ".." in path.parts or "\\" in entry["path"] or ":" in entry["path"] or path.is_absolute():
                raise ValueError("Unsafe repository path rejected.")
            if entry.get("size", 0) > settings.max_file_bytes:
                skipped.append(f"Skipped oversized file: {path}")
                continue
            total += entry.get("size", 0)
            entries.append(entry)
        if len(entries) > settings.max_files or total > settings.max_total_bytes:
            raise ValueError("Repository exceeds source analysis limits. Scan a smaller repository.")
        dest.mkdir(parents=True, exist_ok=True)

        def download(entry):
            path = entry["path"]
            chunks, size = [], 0
            with client.stream(
                "GET",
                f"https://raw.githubusercontent.com/{owner}/{repo}/{sha}/{quote(path, safe='/')}",
                headers={"User-Agent": GITHUB_API_HEADERS["User-Agent"]},
            ) as response:
                response.raise_for_status()
                for chunk in response.iter_bytes():
                    size += len(chunk)
                    if size > settings.max_file_bytes or size > entry.get("size", settings.max_file_bytes):
                        raise ValueError("Source file exceeds its declared size.")
                    chunks.append(chunk)
            out = dest / path
            if not out.resolve().is_relative_to(dest.resolve()):
                raise ValueError("Repository path escapes scan directory.")
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(b"".join(chunks))

        with ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(download, entries))
    files, warnings = inventory(dest)
    return files, skipped + warnings, sha
