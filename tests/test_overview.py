from types import SimpleNamespace

import pytest
from invaria.overview import BusinessImpactOverview, ProductOverview, business_impact_context, overview_context
from pydantic import ValidationError


def test_overview_context_is_bounded_and_excludes_unreadable_documents_and_findings():
    scan = SimpleNamespace(repository="some/project", source="github", payload={
        "findings": [{"snippet": "sensitive literal"}],
        "graph": {"nodes": [{"kind": "Function", "label": "readOrders"}]},
    })
    docs = [SimpleNamespace(status="ingested", name=f"doc{i}", content="a" * 50000) for i in range(10)]
    docs.insert(0, SimpleNamespace(status="unreadable", name="bad", content="never include"))
    context = overview_context(scan, docs)
    assert len(str(context)) < 20000
    assert "sensitive literal" not in str(context)
    assert "never include" not in str(context)
    assert context["code_structure"] == [{"kind": "Function", "label": "readOrders"}]


def test_overview_rejects_empty_or_unbounded_model_output():
    with pytest.raises(ValidationError):
        ProductOverview(summary="", activities=[], document_context="Missing")
    with pytest.raises(ValidationError):
        ProductOverview(summary="A supported product description.", activities=["x" * 251], document_context="Missing")


def test_business_impact_context_keeps_business_context_separate_from_source_snippets():
    scan = SimpleNamespace(repository="some/project", source="github", payload={
        "findings": [{"id": "finding-1", "title": "Missing ownership check", "summary": "A record lookup lacks a supported check.", "impact": "Potential record access.", "evidence": [{"snippet": "secret"}]}],
        "graph": {"nodes": []},
        "product_overview": {"summary": "An application that manages customer orders."},
    })
    context = business_impact_context(scan, [])
    assert context["product_overview"] == "An application that manages customer orders."
    assert context["findings"][0]["finding_id"] == "finding-1"
    assert "evidence" not in context["findings"][0]
    assert "secret" not in str(context)
    assert BusinessImpactOverview.model_validate({
        "summary": "Potential access-control gaps could affect trusted customer workflows.",
        "impacts": [{
            "finding_id": "finding-1",
            "business_impact": "A user could potentially reach another customer's order workflow if the candidate issue is confirmed.",
            "affected_areas": ["customer trust"],
            "caveat": "This is an advisory scenario and needs human review.",
        }],
    }).impacts[0].finding_id == "finding-1"
