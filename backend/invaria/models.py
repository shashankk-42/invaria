from typing import Literal

from pydantic import BaseModel, Field


class Evidence(BaseModel):
    id: str
    file: str
    line: int = Field(ge=1)
    end_line: int = Field(ge=1)
    snippet: str
    kind: str


class Finding(BaseModel):
    id: str
    rule_id: str
    title: str
    category: Literal["authorization", "business_logic", "injection", "secrets", "configuration"]
    severity: Literal["critical", "high", "medium", "low"]
    confidence: float = Field(ge=0, le=1)
    route: str | None = None
    summary: str
    impact: str
    remediation: str
    assumptions: list[str] = Field(default_factory=list)
    attack_path: list[str] = Field(default_factory=list)
    evidence: list[Evidence]
    references: list[dict] = Field(default_factory=list)
    # The deterministic INVARIANT ledger records why a candidate passed its
    # evidence gate. It is intentionally separate from optional model prose.
    algorithm: dict | None = None
    verification: str = "static-evidence-verified"
    reasoning: dict | None = None
    review_status: Literal["open", "confirmed", "dismissed"] = "open"
    review_note: str = ""


class Reasoning(BaseModel):
    verdict: Literal["consistent", "uncertain", "not_supported"]
    explanation: str = Field(max_length=4000)
    assumptions: list[str] = Field(max_length=12)
    remediation: str = Field(max_length=4000)
    evidence_ids: list[str] = Field(min_length=1, max_length=30)


class ScanRequest(BaseModel):
    source: Literal["github", "fixture"] = "github"
    repository: str = Field(min_length=1, max_length=300)
    use_model: bool = False


class Feedback(BaseModel):
    status: Literal["open", "confirmed", "dismissed"]
    note: str = Field(default="", max_length=2000)
