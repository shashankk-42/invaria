import json
from pathlib import Path

import pytest
from invaria.engine import analyze, verify
from invaria.ingestion import inventory, parse_github_url
from invaria.reasoning import validate_reasoning

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("family", ["bola", "injection", "secrets"])
def test_vulnerable_fixed_pairs(family):
    vulnerable = analyze(inventory(ROOT / "fixtures" / f"{family}-vulnerable")[0])
    fixed = analyze(inventory(ROOT / "fixtures" / f"{family}-fixed")[0])
    assert len(vulnerable["findings"]) == 1
    assert not fixed["findings"]


def test_cross_file_graph_and_evidence():
    files = inventory(ROOT / "fixtures/bola-vulnerable")[0]
    result = analyze(files)
    assert result["routes"][0]["path"] == "/api/orders/:id"
    assert result["routes"][0]["resolved"]
    assert {e["kind"] for e in result["graph"]["edges"]} >= {
        "CALLS",
        "QUERIES",
        "READS",
        "RECEIVES",
        "GUARDED_BY",
    }
    assert {e.file for e in result["findings"][0].evidence} == {"routes.ts", "controller.ts"}
    assert verify(result["findings"][0], files)
    result["findings"][0].evidence[0].line = 999
    assert not verify(result["findings"][0], files)


def app(body):
    return {
        "app.js": "const express = require('express'); const app = express();\napp.get('/orders/:id', (req, res) => {\n"
        + body
        + "\n});"
    }


def test_comments_and_strings_are_not_code():
    result = analyze(
        app("// eval(req.body.code);\nconst x = 'eval(req.body.code)';\nreturn res.json({ok:true});")
    )
    assert not result["findings"]


def test_user_supplied_owner_is_not_authorization():
    result = analyze(app("return Order.findOne({where: {id: req.params.id, userId: req.body.userId}});"))
    assert len(result["findings"]) == 1


def test_write_owner_and_or_branch_do_not_prove_authorization():
    for code in [
        "return Order.update({where:{id:req.params.id},data:{userId:req.user.id}});",
        "return Order.findOne({where:{OR:[{id:req.params.id},{userId:req.user.id}]}});",
        "return orders.find(o => o.id === req.params.id || o.userId === req.user.id);",
    ]:
        assert len(analyze(app(code))["findings"]) == 1


def test_same_query_owner_predicate_is_recognized():
    result = analyze(app("return orders.find(o => o.id === req.params.id && o.userId === req.user.id);"))
    assert not result["findings"]


def test_unresolved_handler_is_coverage_gap():
    result = analyze(
        {"routes.ts": "import express from 'express'; const app=express(); app.get('/x', externalHandler);"}
    )
    assert result["coverage"]["routes"] == 1
    assert result["coverage"]["resolved_routes"] == 0
    assert result["warnings"]


def test_unrelated_owner_check_does_not_hide_lookup():
    result = analyze(app("const owner = req.user.id;\nreturn Order.findByPk(req.params.id);"))
    assert len(result["findings"]) == 1


def test_parameterized_query_and_command_array():
    result = analyze(
        app(
            "db.query('select * from x where id = ?', [req.params.id]);\nspawn('tool', [req.params.id], {shell:false});"
        )
    )
    assert not result["findings"]


def test_destructured_request_alias():
    result = analyze(app("const { id } = req.params; return orders.find(o => o.id === id);"))
    assert len(result["findings"]) == 1


def test_secret_is_redacted():
    finding = analyze(inventory(ROOT / "fixtures/secrets-vulnerable")[0])["findings"][0]
    assert "fixture-only" not in finding.model_dump_json()
    assert "[REDACTED]" in finding.evidence[0].snippet


def test_fabricated_model_reference_rejected():
    finding = analyze(inventory(ROOT / "fixtures/bola-vulnerable")[0])["findings"][0]
    raw = {
        "verdict": "consistent",
        "explanation": "A candidate",
        "assumptions": [],
        "remediation": "Scope it",
        "evidence_ids": ["invented"],
    }
    with pytest.raises(ValueError, match="unknown evidence"):
        validate_reasoning(json.dumps(raw), finding)
    raw["evidence_ids"] = [finding.evidence[0].id]
    assert validate_reasoning(json.dumps(raw), finding).verdict == "consistent"
    raw["explanation"] = "The vulnerability is at invented.ts:999"
    with pytest.raises(ValueError, match="unsupported source location"):
        validate_reasoning(json.dumps(raw), finding)


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost/x",
        "https://github.com.evil/a/b",
        "https://user:pass@github.com/a/b",
        "file:///etc/passwd",
        "https://github.com/a/b/tree/main",
        "https://github.com/a/..",
    ],
)
def test_reject_unsafe_repo_urls(url):
    with pytest.raises(ValueError):
        parse_github_url(url)


def test_github_url():
    assert parse_github_url(
        "https://github.com/shashankk-42/taskforge-decentralized-compute-marketplace.git"
    ) == ("shashankk-42", "taskforge-decentralized-compute-marketplace")
