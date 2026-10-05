# INVARIANT Engine Design Report

## Decision

**INVARIANT** is Invaria's security-decision engine: **Invariant-based Networked Verification and Attack-path Reasoning**. It is not a replacement model and it is not a collection of prompts. It defines the conditions under which an observed code pattern becomes a reported security finding.

The policy implementation is [algorithm.py](../backend/invaria/algorithm.py). Its static-analysis implementation is [engine.py](../backend/invaria/engine.py). The two files are deliberately separate: parser and detector details can change without weakening the evidence policy.

## Where it runs

```text
Repository snapshot
  -> Tree-sitter parser and bounded import resolution
  -> route, function, query, model and trust-boundary graph
  -> INVARIANT hypothesis and path analysis
  -> evidence gate and decision ledger
  -> optional RAG and model review (advisory only)
  -> source-snippet verification
  -> finding, review workflow and report
```

| Responsibility | File |
| --- | --- |
| INVARIANT code name, rule-specific evidence gates, decision ledger and scan summary | [backend/invaria/algorithm.py](../backend/invaria/algorithm.py) |
| AST analysis, local data/identity propagation, authorization conditions, sensitive business mutations, graph and built-in hypotheses | [backend/invaria/engine.py](../backend/invaria/engine.py) |
| Strict repository-local declaration of sensitive-flow invariants and required control markers | [backend/invaria/policy.py](../backend/invaria/policy.py) |
| JS/TS parsing, route discovery and bounded handler resolution | [backend/invaria/parser.py](../backend/invaria/parser.py) |
| Scan stages; requires external Semgrep candidates to pass the same ledger policy | [backend/invaria/pipeline.py](../backend/invaria/pipeline.py) |
| Finding schema that preserves the decision ledger alongside model prose | [backend/invaria/models.py](../backend/invaria/models.py) |
| JSON and Markdown report export of the algorithm and finding-level gate result | [backend/invaria/api.py](../backend/invaria/api.py) |
| Optional model JSON schema and source-reference validation | [backend/invaria/reasoning.py](../backend/invaria/reasoning.py) |
| Regression coverage for direct cross-file request-to-helper flow and an identity-scoped safe lookup | [tests/test_invariant_algorithm.py](../tests/test_invariant_algorithm.py) |
| Regression coverage for payment/refund mutation detection and declared-invariant coverage | [tests/test_business_flow.py](../tests/test_business_flow.py) |

## What the algorithm decides

Each rule has a hypothesis and a minimum evidence gate. The gate cannot be satisfied by RAG text, uploaded business documentation, or model prose.

| Rule | Hypothesis | Required source evidence | A known safe condition |
| --- | --- | --- | --- |
| `BOLA001` | Request-controlled object selection reaches a private data operation without a proven server-side scope predicate. | Route and lookup | The same lookup constrains an owner/tenant field with server-derived identity. |
| `BFL001` | Request-controlled sensitive business data reaches a state or value mutation without a proven application invariant. | Route and mutation | A matched repository invariant has every declared control marker present; semantic verification remains future work. |
| `INJ001` | Request input reaches executable SQL, command or code. | Route and sink | Parameterized query values or fixed-process argument arrays do not meet this hypothesis. |
| `SEC001` | A credential-like literal appears in source. | Literal assignment | Environment lookup and known placeholders are excluded. |
| Semgrep baseline | A separately executed deterministic rule produced source-backed evidence. | Semgrep source evidence | It is kept separate from first-party route-to-sink claims. |

For a BOLA path, INVARIANT asks these questions in order:

1. Is a request-controlled value present?
2. Does that value select, read, update, or delete an object?
3. Is the path direct, or does a resolved local function pass the value to a helper?
4. Does the same database lookup contain a server-derived ownership or tenant predicate?
5. Is the predicate inside an `OR` branch that leaves an unauthorized record possible?
6. Do route, flow (when present), and lookup snippets still match the immutable repository snapshot?
7. If the evidence gate passes, report the candidate with the proof, the conditions that remain unproven, and the confidence basis. Otherwise discard it.

The current bounded helper analysis propagates request-taint and authenticated identity through parser-resolved function calls. It records the caller line as `flow` evidence. It does not guess when function names are ambiguous, and it stops at the parser's existing 12-handler bound. A cross-function trace raises confidence by only 0.03 because it improves provenance, not proof of exploitability.

The resulting finding includes an `algorithm` record:

```json
{
  "code_name": "INVARIANT",
  "version": "1.0",
  "decision": "reported",
  "evidence_gate": {
    "required_kinds": ["lookup", "route"],
    "observed_kinds": ["flow", "lookup", "route"],
    "passed": true,
    "interprocedural_trace": true
  },
  "proven_controls": [],
  "risk_signals": ["private-data operation"],
  "unresolved_conditions": ["External row policies require review"],
  "confidence_basis": "static evidence, not a calibrated probability"
}
```

This is the product's critical property: a reviewer can inspect why the system made a claim, what would invalidate it, and what still requires a human or runtime check.

## Code added for this design

The complete policy code added for this work is [algorithm.py](../backend/invaria/algorithm.py). The complete implementation changes that make it operational are visible in [engine.py](../backend/invaria/engine.py), [policy.py](../backend/invaria/policy.py), [pipeline.py](../backend/invaria/pipeline.py), [models.py](../backend/invaria/models.py), [test_invariant_algorithm.py](../tests/test_invariant_algorithm.py), and [test_business_flow.py](../tests/test_business_flow.py). The regression tests exercise both sides of the authorization condition:

```text
route(req.params.id, req.user.id)
  -> helper(id, userId)
      -> Order.findByPk(id)                 => report BOLA001 with flow evidence
      -> Order.findOne({where: {id,userId}}) => do not report BOLA001
```

The existing vulnerable/fixed fixtures continue to cover direct BOLA, injection, and credential cases. This addition gives the algorithm a tested path through the common controller-to-service architecture that an AST-only line scanner misses.

## Business-flow analysis

`BFL001` is the first implementation of the product's most important remaining capability. It detects request-controlled writes to high-impact fields such as `amount`, `balance`, `refund`, `discount`, `price`, `quantity`, `inventory`, and `status` when the route or data model indicates a financial, commerce, or state-changing operation. It produces route, helper-flow when available, and mutation evidence.

This catches a dangerous starting point such as:

```text
PATCH /payments/:id/refund
  -> Payment.update({ data: { amount: req.body.amount, status: req.body.status } })
```

The finding does not pretend that this code is an exploit. It states that a client controls a sensitive mutation and the scan cannot prove the business constraints. For a financial operation, the candidate is high severity; inventory and commerce mutations are medium until the application's policy says otherwise.

Applications can declare the critical flows they expect INVARIANT to check in `.invaria/invariants.json`:

```json
{
  "version": 1,
  "invariants": [
    {
      "id": "refundControl",
      "route": "PATCH /payments/:id/refund",
      "fields": ["amount", "status"],
      "controls": ["assertRefundAllowed", "withTransaction", "requireIdempotency"],
      "description": "A refund must be authorized, atomic, and idempotent."
    }
  ]
}
```

The policy is versioned alongside the application. INVARIANT matches the route and sensitive fields, then checks whether each explicitly named control marker appears in the resolved handler path. Missing markers strengthen the candidate and appear in its decision ledger. When all declared markers are present, the generic candidate is suppressed and the scan records policy coverage. This means **code presence**, not semantic proof: the next verifier must prove that the controls enforce the declared invariant.

## Why this can become differentiated

The defensible product advantage is not a claim that any one model is better. It is a compounding, versioned security process:

1. **Project policy model.** Capture assets, roles, tenants, actions, and forbidden invariants as structured data. Example: `order.tenant_id must equal actor.tenant_id for every read, refund, export and update`.
2. **Hypothesis planner.** Generate hypotheses from those invariants and the code graph, not from a repository-wide prompt. Prioritize an internet-facing write path to a payment, identity, health, or tenant asset.
3. **Evidence executor.** Use deterministic parsers, framework adapters, taint tracking, schema relations, and a limited model review to collect only relevant proof.
4. **Adversarial verifier.** Attempt to disprove each hypothesis: identify same-query scope predicates, dominance-aware guard clauses, database row-level security, state transitions, tests, and a sandbox validation result where an approved environment exists.
5. **Decision ledger.** Report only candidates that satisfy rule-specific gates. Persist rejected hypotheses and coverage gaps so a clean scan never looks like a guarantee.
6. **Learning loop.** Human confirmation/dismissal, fixed commits, and validation outcomes become labeled data. Changes to rules, prompts, adapters, or models must improve a held-out benchmark before deployment.

The first implementation completes pieces of steps 2 through 5 for four high-value rule families. The next algorithm milestones should be built in this order:

| Priority | Algorithm capability | Acceptance measure |
| --- | --- | --- |
| 1 | Typed policy model for actor, resource, tenant, role and action | Every BOLA fixture includes an explicit expected policy and positive/negative result. |
| 2 | Framework and ORM adapters plus true call/return argument propagation | Held-out route-controller-service repositories improve recall without lowering precision. |
| 3 | Control-flow and dominance-aware authorization verification | A guard must dominate the sensitive operation; `OR`, post-query checks and error branches are tested. |
| 4 | Multi-step state-machine analysis for refund, transfer, approval and inventory flows | Each workflow has transition invariants and attack-sequence fixtures such as modify -> refund -> withdraw. |
| 5 | Sandboxed validation contracts | A proof-of-concept is attempted only in customer-approved isolated environments; failures are recorded separately from findings. |
| 6 | Evaluation and learning service | Publish precision, recall, coverage, severity calibration and time-to-triage on frozen held-out sets. |

## Comparable-tool gaps and Invaria's response

These are documented product boundaries or common static-analysis constraints, not allegations that competing products are defective. Invaria does not yet solve all of them; the status column avoids pretending otherwise.

| Common limitation | Evidence | Invaria response | Status |
| --- | --- | --- | --- |
| Rule engines have language and framework coverage boundaries. CodeQL documents a fixed language list and says custom or niche dependencies need additional models. | [GitHub CodeQL documentation](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning) | Expose unsupported coverage, build versioned framework/ORM adapters, and never infer that an unparsed path is safe. | Current parser supports JS/TS and Express only; adapter registry is planned. |
| Basic taint analysis can stop inside a function. Semgrep documents interprocedural analysis as a separate capability, with cross-file support constrained by language and configuration. | [Semgrep taint analysis documentation](https://docs.semgrep.dev/writing-rules/data-flow/taint-mode/overview) | Add bounded, evidence-carrying local helper propagation independent of a vendor tier; retain Semgrep as a baseline rather than the decision maker. | Implemented for parser-resolved JS/TS route handlers; not general interprocedural analysis. |
| Product support varies across language, package manager, framework, SCM and execution surface. Snyk publishes a support matrix and recommends checking availability before a scan. | [Snyk support documentation](https://docs.snyk.io/supported-languages/supported-languages-package-managers-and-frameworks) | Treat coverage as a first-class report object. A scan states what parsed, what resolved, and what was skipped. | Implemented for source files, routes and handler resolution; broader ecosystem coverage is planned. |
| Traditional static pattern matching commonly misses context-dependent access-control and business-logic issues. | [Anthropic's description of the limitation](https://www.anthropic.com/news/claude-code-security) | Make application invariants and attack paths the central objects, then require source or sandbox evidence. | Architecture designed; current implementation covers BOLA only, not full workflow/state analysis. |
| Model-driven tools still need project context, validation and feedback to reduce noise. Codex Security describes editable threat models, sandbox validation and feedback-driven refinement. | [OpenAI Codex Security overview](https://openai.com/index/codex-security-now-in-research-preview/) | Keep the model replaceable and advisory; version the policy, tests and evidence gates so quality does not depend on a single provider. | Evidence gating and model-reference validation are implemented; editable threat models and sandbox validation are next-stage work. |

The practical promise should therefore be: **Invaria produces fewer, inspectable, policy-backed security hypotheses and improves them against measured evidence.** It should not claim to outperform Codex, Claude, CodeQL, Semgrep, or Snyk until a reproducible benchmark demonstrates that result.

## Current limits

INVARIANT v1 is a strong foundation, not a security certificate. It detects sensitive single-write business mutations and supports declared policy coverage, but it does not yet prove runtime authentication, database row policies, post-query authorization, semantic correctness of control markers, atomicity, locking, idempotency, type behavior, dynamic router construction, custom sanitizers, non-JS/TS frameworks, distributed services, or multi-step exploitability. The confidence value is a transparent heuristic, not a calibrated probability. The report must keep these limitations visible.

## Validation completed

- Existing engine tests: vulnerable and fixed BOLA, injection and credential fixtures; negative controls for comments, strings, user-supplied owner fields, unsafe `OR`, parameterized SQL and secret redaction.
- New INVARIANT tests: request input is traced across a resolved local helper; identity scope passed to that helper suppresses the BOLA finding.
- New business-flow tests: direct payment/refund writes are reported; a declared invariant exposes missing controls; all declared markers suppress only the generic candidate.
- Static checks: Ruff passes for `backend/invaria` and the new test file.
