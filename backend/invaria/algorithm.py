"""INVARIANT decision policy for evidence-first security hypotheses.

INVARIANT means Invariant-based Networked Verification and Attack-path
Reasoning.  This module deliberately contains policy, not parser logic: a
detector may propose a candidate, but this layer decides the evidence needed
before the candidate can become a reported finding.
"""

from collections import Counter

CODE_NAME = "INVARIANT"
VERSION = "1.0"

# A report must contain a source/control boundary and a concrete affected
# operation.  A model opinion, RAG document, or business document can never
# satisfy this gate.
REQUIRED_EVIDENCE = {
    "BOLA001": {"route", "lookup"},
    "BFL001": {"route", "mutation"},
    "INJ001": {"route", "sink"},
    "SEC001": {"secret"},
    "CFG001": {"source"},
    "FBA001": {"source"},
}

HYPOTHESES = {
    "BOLA001": "A request-controlled object reference reaches a private data operation without a proven server-side scope predicate.",
    "BFL001": "Request-controlled sensitive business data reaches a state or value mutation without a proven application invariant.",
    "INJ001": "Request-controlled data reaches an executable SQL, command, or code sink.",
    "SEC001": "A credential-like literal is committed in source and may be usable outside the repository.",
    "CFG001": "A credential-like fallback is present in application configuration and may be used when the intended external secret is absent.",
    "FBA001": "An anonymous client session reaches a remote data operation whose authorization policy must be confirmed outside this source snapshot.",
}


def decision_record(finding, *, controls=(), uncertainties=(), risk_signals=(), policy=None):
    """Return the immutable decision ledger stored with a finding.

    The ledger makes the scanner's claim inspectable.  It records what was
    observed, which controls were actually proven, and which facts remain a
    human decision.  A missing evidence kind discards the candidate instead
    of allowing a fluent model response to fill the gap.
    """

    observed = {item.kind for item in finding.evidence}
    # A Semgrep result is a separately executed, deterministic baseline. Its
    # source snippet is already verified by Invaria, but it must not pretend
    # to satisfy a first-party route-to-sink policy it did not run.
    required = REQUIRED_EVIDENCE.get(finding.rule_id, {"semgrep"} if "semgrep" in observed else {"source"})
    missing = sorted(required - observed)
    has_interprocedural_trace = "flow" in observed
    confidence = finding.confidence
    if has_interprocedural_trace:
        # A concrete argument-to-parameter hop strengthens provenance.  It is
        # intentionally a small adjustment: it is still static evidence.
        confidence = min(0.95, round(confidence + 0.03, 2))

    return {
        "code_name": CODE_NAME,
        "version": VERSION,
        "hypothesis": HYPOTHESES.get(
            finding.rule_id,
            "A deterministic baseline reported a source-backed security candidate."
            if "semgrep" in observed
            else finding.summary,
        ),
        "decision": "reported" if not missing else "discarded",
        "evidence_gate": {
            "required_kinds": sorted(required),
            "observed_kinds": sorted(observed),
            "missing_kinds": missing,
            "passed": not missing,
            "interprocedural_trace": has_interprocedural_trace,
        },
        "proven_controls": list(controls),
        "policy": policy or {"matched_invariants": [], "coverage": "no repository policy matched"},
        "risk_signals": list(risk_signals),
        "unresolved_conditions": list(uncertainties),
        "confidence_basis": "static evidence, not a calibrated probability",
        "confidence": confidence,
    }


def scan_ledger(findings):
    """Summarize decision policy execution without exposing source content."""

    records = [finding.algorithm or {} for finding in findings]
    return {
        "code_name": CODE_NAME,
        "version": VERSION,
        "reported_hypotheses": sum(record.get("decision") == "reported" for record in records),
        "by_rule": dict(Counter(finding.rule_id for finding in findings)),
        "with_interprocedural_trace": sum(
            record.get("evidence_gate", {}).get("interprocedural_trace", False) for record in records
        ),
        "policy": "A finding is reported only when its rule-specific source/control and affected-operation evidence gate passes.",
    }
