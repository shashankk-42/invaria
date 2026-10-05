# Invaria

Invaria is a local application security MVP built from the supplied engineering blueprint and Week 1 roadmap. It reads a public GitHub repository, extracts Express routes and JavaScript/TypeScript structure, builds a security graph, generates evidence-backed candidates, optionally asks Gemma to review them, and saves a report for human review.

The security decision policy is **INVARIANT** (Invariant-based Networked Verification and Attack-path Reasoning). Its implementation and the next evaluation gates are described in [docs/INVARIANT_ENGINE.md](docs/INVARIANT_ENGINE.md).

**TaskForge is a scan target, not Invaria's codebase.** Its checkout is in the ignored `app/` directory. Invaria never installs or executes a scanned repository.

## Start locally

Requirements: Python 3.11+, Node.js 24+, npm. Run from this repository root.

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev.ps1 -Setup
```

macOS / Linux:

```sh
sh scripts/dev.sh
```

Open **http://127.0.0.1:3000**. API documentation is at **http://127.0.0.1:8000/docs**. The scripts start a local API and Next.js dashboard. Stop the script with Ctrl+C. Later runs can omit `-Setup`.

The default database is SQLite in `.data/invaria.db`, so the static MVP starts without Docker or a model download. Copy `.env.example` to `.env` to configure PostgreSQL or Ollama. `.env` is ignored by Git.

## PostgreSQL and local models

```powershell
docker compose up -d db
ollama pull gemma4:e4b
ollama pull embeddinggemma
```

Set this in `.env` to use the Compose database from the local API:

```dotenv
INVARIA_DATABASE_URL=postgresql+psycopg://invaria:invaria-local-dev@127.0.0.1:15432/invaria
```

Restart the API, then index the five small, curated security guidance documents:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8000/api/knowledge/index
```

The index stores 768-dimensional EmbeddingGemma vectors in PostgreSQL and retrieves guidance by cosine distance. SQLite uses an explicitly labeled category-based guidance fallback. The model selector becomes available when Ollama reports the configured Gemma model as installed. Inference requires enough RAM/VRAM for that model; E4B is a substantial download.

The provider URL and models are configurable with `INVARIA_OLLAMA_URL`, `INVARIA_REASONING_MODEL`, and `INVARIA_EMBEDDING_MODEL`. No remote paid inference service is configured. Missing or invalid model output never silently becomes a model-verified finding.

## Complete Docker stack

```powershell
docker compose up --build -d
```

- Dashboard: **http://127.0.0.1:3001**
- API and docs: **http://127.0.0.1:8001/docs**
- PostgreSQL: local port **15432**, persistent named volume

The API image includes Semgrep CE in a separate Python environment. Ollama runs on the host and is reached through `host.docker.internal`. After models are downloaded, index guidance through port 8001. Docker binds published ports to loopback, runs the scanner as an unprivileged user, drops capabilities and limits its resources. `docker compose down` stops containers while preserving database volumes.

Local and Docker APIs can run concurrently on their different ports, but **point only one API worker at a given database**. This MVP uses one in-process worker with a bounded queue. Startup marks interrupted jobs failed; it does not resume a job after a crash. Do not scale to multiple API workers until there is a durable queue/lease mechanism.

## Try the complete flow

1. Select **Test fixture → Authorization · vulnerable** and run analysis. Expect one BOLA candidate. Open it to inspect the route and controller evidence, assumptions, remediation, and review actions.
2. Select **Authorization · fixed**. Expect zero BOLA candidates and a graph edge showing the owner constraint.
3. Repeat with SQL injection and credential fixtures. Each vulnerable case has one candidate; each fixed case has zero.
4. Enable **Include Gemma evidence review** and rerun a vulnerable fixture. The advisory review appears alongside the original static evidence.
5. Scan `https://github.com/shashankk-42/taskforge-decentralized-compute-marketplace`. Inspect its endpoint graph and coverage before reviewing candidates.
6. Confirm or dismiss a finding with a note. Reload and export JSON or Markdown; the review remains saved.

## Optional business documentation

Use **Add docs** beside the repository URL to attach up to ten Markdown, text, PDF, DOCX, or legacy DOC files (8 MB each, 25 MB total). Invaria extracts a bounded, readable summary so the model can understand stated product behavior, workflows, API intent, and data ownership assumptions.

Every uploaded document is marked **untrusted context**. It is stored separately from the repository snapshot, is never parsed as code, sent to Semgrep, added to the application graph, or accepted as finding evidence. It can only help frame questions for a human reviewer or optional Gemma review. The Coverage & audit tab lists document extraction status, headings, and excerpts; raw document text is omitted from reports and API responses. Scanning the same repository again always creates a new scan ID and an isolated source/document snapshot, so each run can have its own attached context.

## CLI and verification

```powershell
.venv/Scripts/python.exe -m invaria.cli evaluate
.venv/Scripts/python.exe -m invaria.cli scan bola-vulnerable --fixture --model --output artifacts/fixture.json
.venv/Scripts/python.exe -m invaria.cli scan https://github.com/shashankk-42/taskforge-decentralized-compute-marketplace --output artifacts/taskforge.json
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/python.exe -m ruff check backend tests
npm --prefix frontend run build
```

On macOS/Linux replace `.venv/Scripts/python.exe` with `.venv/bin/python`. An opt-in PostgreSQL/live embedding integration test runs when `INVARIA_TEST_POSTGRES_URL` is set. Tests use an isolated database and include the HTTP scan/review/export lifecycle, vulnerable/fixed pairs, false-positive controls, URL restrictions, and fabricated model reference rejection.

## Architecture

```text
Public GitHub URL or bundled fixture
  + optional business documentation (untrusted hints only)
  → Immutable commit + bounded source-only ingestion
  → Tree-sitter JS/TS extraction in a subprocess
  → Typed route/function/query/model security graph
  → BOLA, sensitive business-flow, injection and credential hypotheses + Semgrep baseline
  → Source evidence and trusted OWASP/CWE guidance
  → Optional Gemma structured review
  → Evidence/reference verification
  → SQLAlchemy persistence (PostgreSQL or local SQLite)
  → Next.js dashboard, review feedback, JSON/Markdown report
```

| Component | Implementation |
| --- | --- |
| API and worker | Python / FastAPI, one bounded local worker |
| Frontend | Next.js 16 / React 19 / TypeScript / accessible Shadcn primitives |
| Parsing | Tree-sitter 0.25.2, JavaScript and TypeScript grammars |
| Baseline SAST | Built-in AST checks; Semgrep CE in Linux Docker |
| Graph | Typed JSON nodes/edges persisted with each scan |
| Persistence | PostgreSQL 17 with pgvector; SQLite fallback |
| Reasoning | Ollama Gemma 4 E4B, replaceable provider function |
| Retrieval | EmbeddingGemma and pgvector cosine distance, curated fallback |

Tree-sitter is pinned to 0.25.2 because 0.26.0 crashed on the supplied TaskForge source on this Windows host. Native analysis runs in a subprocess with a two-minute timeout; Linux additionally applies a 1 GB address-space bound. Source ingestion is limited to 2,000 eligible files, 500 KB per file, and 20 MB total; symlinks, binary artifacts, dependency trees and build output are excluded. GitHub rate limits and unavailable/private repositories produce visible errors.

The database stores the immutable report, graph, evidence, pipeline events, model run audit and human feedback together in one scan JSON record. This intentionally keeps the Week 1 implementation small; it is not the normalized multi-tenant schema proposed for later phases.

Uploaded document metadata and bounded extracted text are retained in a separate `scan_documents` record so they cannot become source evidence by accident. The UI and report only expose metadata, extraction status, headings, and excerpts.

## Supported checks and practical limits

- **Authorization:** request-derived lookups through common Sequelize, Prisma, Mongoose and array lookup patterns. Recognizes direct owner/tenant predicates against authenticated request identity in the same query. Authentication-like middleware names are observations, not proof that authentication is correct.
- **Business flows:** request-controlled writes to high-impact financial, commerce, and state fields. Optional `.invaria/invariants.json` declares sensitive flows and expected server-side control markers. A marker confirms named code is present; it does not prove a transaction, idempotency, or state rule is semantically correct.
- **Injection:** direct request input and basic local aliases reaching query text, eval or shell execution. Separate SQL value parameters are treated differently from executable statement text.
- **Secrets:** credential-like string assignments with redacted evidence. A candidate may be a test credential and requires review.
- **Parsing:** static Express routes, basic named handlers and relative imports, bounded local call following, route prefixes for simple mounts, Prisma/SQL schema names.

The engine is **not a complete interprocedural taint or state-machine analyzer**. Dynamic routers, complex module exports, parameter passing across functions, post-query authorization guards, full control-flow dominance, database row policies, custom sanitizers, external identity providers, semantic validation of business controls, and multi-step state transitions may be missed. Unsupported handlers and parsing failures are reported in coverage. A zero-finding result is not a security certificate.

`static-evidence-verified` means file locations and snippets match the source snapshot. Model JSON and evidence IDs (plus explicit file:line citations) are checked. **Model prose is advisory and still needs human review.** Rule confidence is a fixed heuristic, not a calibrated probability. Findings are potential weaknesses, not dynamically demonstrated exploits. No generated patch, exploit execution, automatic PR, OAuth, organization accounts, GitHub App or multi-tenant deployment is included in this Week 1 scope.

## Before deployment beyond a trusted workstation

The current user model is one trusted local developer. It has origin and host checks, loopback port binding, optional bearer-token enforcement, and bounded ingestion, but no sign-in or organization isolation. Do not publish it as a multi-user service. Add application authentication, a same-origin authenticated proxy, durable jobs, authorization per scan and hardened execution isolation first. The optional API token is server configuration; the default Next.js rewrite does not inject a token for the browser.

## Next milestones

See `docs/ROADMAP.md` for the next test gates and `docs/VALIDATION.md` for the verified state of this implementation. The supplied blueprint is retained unchanged.
