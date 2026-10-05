from invaria.engine import analyze


def test_invariant_traces_request_data_through_resolved_local_helper():
    report = analyze(
        {
            "route.ts": (
                'import express from "express"; import { readOrder } from "./service"; '
                'const app = express(); app.get("/orders/:id", authenticate, '
                "(req, res) => readOrder(req.params.id, req.user.id, res));"
            ),
            "service.ts": "export function readOrder(id, userId, res) { return Order.findByPk(id); }",
        }
    )

    finding = report["findings"][0]
    assert finding.rule_id == "BOLA001"
    assert {item.kind for item in finding.evidence} == {"route", "flow", "lookup"}
    assert finding.algorithm["code_name"] == "INVARIANT"
    assert finding.algorithm["evidence_gate"]["passed"]
    assert finding.algorithm["evidence_gate"]["interprocedural_trace"]
    assert report["algorithm"]["with_interprocedural_trace"] == 1


def test_invariant_does_not_report_when_helper_scopes_lookup_to_identity():
    report = analyze(
        {
            "route.ts": (
                'import express from "express"; import { readOrder } from "./service"; '
                'const app = express(); app.get("/orders/:id", authenticate, '
                "(req, res) => readOrder(req.params.id, req.user.id, res));"
            ),
            "service.ts": (
                "export function readOrder(id, userId, res) { "
                "return Order.findOne({ where: { id, userId } }); }"
            ),
        }
    )

    assert report["findings"] == []
