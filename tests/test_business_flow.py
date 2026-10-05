import json

from invaria.engine import analyze


def payment_route(body):
    return {
        "app.ts": (
            "import express from 'express'; const app = express(); "
            "app.patch('/payments/:id/refund', authenticate, async (req, res) => { " + body + " });"
        )
    }


def scoped_payment_update():
    return (
        "return Payment.update({where: {id: req.params.id, userId: req.user.id}, "
        "data: {amount: req.body.amount, status: req.body.status}});"
    )


def test_sensitive_request_controlled_payment_mutation_is_a_business_flow_candidate():
    report = analyze(payment_route(scoped_payment_update()))

    assert len(report["findings"]) == 1
    finding = report["findings"][0]
    assert finding.rule_id == "BFL001"
    assert finding.category == "business_logic"
    assert finding.severity == "high"
    assert {item.kind for item in finding.evidence} == {"route", "mutation"}
    assert finding.algorithm["evidence_gate"]["passed"]
    assert finding.algorithm["policy"]["coverage"] == "no repository policy matched"


def test_declared_business_invariant_requires_all_exact_control_markers():
    files = payment_route(
        "assertRefundAllowed(); return Payment.update({where: {id: req.params.id, userId: req.user.id}, "
        "data: {amount: req.body.amount}});"
    )
    files[".invaria/invariants.json"] = json.dumps(
        {
            "version": 1,
            "invariants": [
                {
                    "id": "refundControl",
                    "route": "PATCH /payments/:id/refund",
                    "fields": ["amount"],
                    "controls": ["assertRefundAllowed", "withTransaction", "requireIdempotency"],
                    "description": "A refund must be authorized, atomic, and idempotent.",
                }
            ],
        }
    )

    finding = analyze(files)["findings"][0]
    assert finding.rule_id == "BFL001"
    assert finding.algorithm["policy"]["matched_invariants"][0]["id"] == "refundControl"
    assert finding.algorithm["policy"]["missing_control_markers"] == [
        "requireIdempotency",
        "withTransaction",
    ]


def test_declared_business_invariant_with_all_control_markers_suppresses_generic_candidate():
    files = payment_route(
        "assertRefundAllowed(); withTransaction(() => requireIdempotency(req.headers.key)); "
        + scoped_payment_update()
    )
    files[".invaria/invariants.json"] = json.dumps(
        {
            "version": 1,
            "invariants": [
                {
                    "id": "refundControl",
                    "route": "PATCH /payments/:id/refund",
                    "fields": ["amount", "status"],
                    "controls": ["assertRefundAllowed", "withTransaction", "requireIdempotency"],
                    "description": "A refund must be authorized, atomic, and idempotent.",
                }
            ],
        }
    )

    assert analyze(files)["findings"] == []
