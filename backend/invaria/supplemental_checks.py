"""Bounded checks for source that is outside the Express route parser.

These checks intentionally report only direct, inspectable patterns.  They
do not infer Python request flows or Firebase security rules.
"""

import ast
import re

from .algorithm import decision_record
from .engine import evidence, stable
from .models import Finding

SECRET_NAME = re.compile(
    r"(?:secret|api_?key|password|access_?token|auth_?token|jwt(?:_?secret|_?key))",
    re.I,
)
IGNORE_DEFAULTS = {"", "placeholder", "your-api-key", "changeme", "password"}


def _literal(node):
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, str) else None


def _name(node):
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return ""


def _credential_finding(files, file, line, name, value, reason):
    if not value or len(value) < 8 or value.lower() in IGNORE_DEFAULTS:
        return None
    finding = Finding(
        id=stable("CFG001", file, line, name),
        rule_id="CFG001",
        title="Credential-like default requires production review",
        category="configuration",
        severity="high",
        confidence=0.82,
        summary=f"{name} has a credential-like fallback literal in application configuration.",
        impact="A deployment that omits the intended secret may use a predictable credential or token.",
        remediation="Remove the fallback from production code, require the secret at startup, and rotate it if the deployed value may have been used.",
        assumptions=[
            "The fallback may be limited to local development; confirm production configuration and deployment safeguards.",
            reason,
        ],
        attack_path=[
            file,
            "Credential-like configuration fallback",
            "A deployment starts without the intended external secret",
        ],
        evidence=[evidence(files, file, line, line, "source")],
    )
    finding.algorithm = decision_record(
        finding,
        uncertainties=finding.assumptions,
        risk_signals=["credential fallback"],
    )
    finding.confidence = finding.algorithm["confidence"]
    return finding


def _python_findings(files):
    findings, reviewed, functions, warnings = [], 0, 0, []
    for file, code in files.items():
        if not file.endswith(".py"):
            continue
        try:
            tree = ast.parse(code, filename=file)
        except SyntaxError:
            warnings.append(f"Syntax errors in {file}; Python checks may be incomplete.")
            continue
        reviewed += 1
        functions += sum(isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) for node in ast.walk(tree))
        for node in ast.walk(tree):
            if isinstance(node, (ast.Assign, ast.AnnAssign)):
                value = _literal(node.value)
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                for target in targets:
                    name = _name(target)
                    if value and SECRET_NAME.search(name):
                        finding = _credential_finding(
                            files, file, node.lineno, name, value, "The value is assigned directly in Python source."
                        )
                        if finding:
                            findings.append(finding)
            if not isinstance(node, ast.Call):
                continue
            function = _name(node.func)
            # os.getenv("JWT_SECRET", "fallback") and os.environ.get(...) use a
            # direct credential-like default that can be reviewed at this line.
            if function in {"getenv", "get"} and len(node.args) >= 2:
                env_name, default = _literal(node.args[0]), _literal(node.args[1])
                if env_name and default and SECRET_NAME.search(env_name):
                    finding = _credential_finding(
                        files, file, node.lineno, env_name, default,
                        "The secret is loaded from the environment, but this literal is used when it is absent.",
                    )
                    if finding:
                        findings.append(finding)
            # Pydantic Field(default="...", alias="JWT_SECRET") is a direct
            # configuration default even though it is not an assignment node.
            if function == "Field":
                keywords = {keyword.arg: _literal(keyword.value) for keyword in node.keywords if keyword.arg}
                alias, default = keywords.get("alias"), keywords.get("default")
                if alias and default and SECRET_NAME.search(alias):
                    finding = _credential_finding(
                        files, file, node.lineno, alias, default,
                        "The Pydantic field provides this literal when the environment value is absent.",
                    )
                    if finding:
                        findings.append(finding)
    return findings, {"reviewed_files": reviewed, "functions": functions, "warnings": warnings}


def _firebase_findings(files):
    findings, reviewed = [], 0
    for file, code in files.items():
        if not file.endswith((".html", ".js", ".jsx", ".ts", ".tsx")):
            continue
        if "signInAnonymously" not in code or not re.search(r"\b(?:addDoc|setDoc|updateDoc|deleteDoc)\s*\(", code):
            continue
        reviewed += 1
        auth_line = code[: code.index("signInAnonymously")].count("\n") + 1
        write_match = re.search(r"\b(?:addDoc|setDoc|updateDoc|deleteDoc)\s*\(", code)
        write_line = code[: write_match.start()].count("\n") + 1
        finding = Finding(
            id=stable("FBA001", file, auth_line, write_line),
            rule_id="FBA001",
            title="Anonymous client data access requires rule verification",
            category="authorization",
            severity="medium",
            confidence=0.74,
            summary="The client signs in anonymously and performs a Firebase data write; the authorization decision is delegated to remote Firestore rules.",
            impact="Users may create or change shared records outside the intended scope if remote rules do not enforce the expected user, tenant, or record ownership.",
            remediation="Define and test Firestore rules that scope each read and write to the authenticated user and intended record. Do not rely on client-side state for authorization.",
            assumptions=[
                "Firestore rules are external to this snapshot and may already enforce the intended access policy.",
                "Anonymous authentication can be an intentional product choice; confirm the allowed operations.",
            ],
            attack_path=[
                "Client starts an anonymous Firebase session",
                "Client invokes a Firestore write operation",
                "Remote Firestore rules decide whether that operation is allowed",
            ],
            evidence=[
                evidence(files, file, auth_line, auth_line, "source"),
                evidence(files, file, write_line, write_line, "source"),
            ],
        )
        finding.algorithm = decision_record(
            finding,
            uncertainties=finding.assumptions,
            risk_signals=["anonymous client session", "remote authorization rule dependency"],
        )
        finding.confidence = finding.algorithm["confidence"]
        findings.append(finding)
    return findings, reviewed


def supplemental_findings(files):
    """Return source-backed candidates and coverage for non-Express checks."""

    python, python_coverage = _python_findings(files)
    firebase, firebase_reviewed = _firebase_findings(files)
    unique = {finding.id: finding for finding in [*python, *firebase]}
    return list(unique.values()), {
        "reviewed_files": python_coverage["reviewed_files"] + firebase_reviewed,
        "python_files": python_coverage["reviewed_files"],
        "client_config_files": firebase_reviewed,
        "functions": python_coverage["functions"],
        "warnings": python_coverage["warnings"],
    }
