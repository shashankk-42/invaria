import hashlib
import re

from .models import Evidence, Finding
from .parser import field_text, member, parse, text, walk

SOURCE = re.compile(r"\b(?:req|request)\.(?:params|query|body|headers|cookies)\b")
IDENTITY = re.compile(
    r"\b(?:req|request)\.(?:user|auth|session\.user)\.(?:id|userId|tenantId|organizationId)\b"
)
OWNER_KEYS = {
    "userid",
    "ownerid",
    "tenantid",
    "organizationid",
    "accountid",
    "customerid",
    "patientid",
    "borrowerid",
}
LOOKUPS = {
    "findByPk",
    "findById",
    "findUnique",
    "findFirst",
    "findOne",
    "find",
    "filter",
    "update",
    "delete",
    "destroy",
}


def stable(*parts):
    return hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:20]


def redact(value):
    # Never send literal secret evidence to model providers or report exports.
    return re.sub(
        r"(?i)((?:secret|api[_-]?key|password|token)\s*[:=]\s*)(['\"])([^'\"\n]{8,})\2",
        r"\1\2[REDACTED]\2",
        value,
    )


def evidence(files, file, line, end_line, kind):
    end_line = min(end_line, line + 12)
    return Evidence(
        id=stable(file, line, end_line, kind),
        file=file,
        line=line,
        end_line=end_line,
        snippet=redact("\n".join(files[file].splitlines()[line - 1 : end_line])),
        kind=kind,
    )


def is_tainted(node, aliases):
    if not node:
        return False
    if node.type in {"string", "comment", "regex"}:
        return False
    if node.type == "identifier" and text(node) in aliases:
        return True
    if node.type == "member_expression" and SOURCE.search(text(node)):
        return True
    return any(is_tainted(c, aliases) for c in node.named_children)


def aliases_before(fn, before):
    aliases = set()
    # Sequential local propagation; assignments inside branches are conservative.
    for node in walk(fn):
        if node.start_byte >= before:
            continue
        if node.type == "variable_declarator":
            name, value = node.child_by_field_name("name"), node.child_by_field_name("value")
            if is_tainted(value, aliases):
                aliases.update(
                    text(c)
                    for c in walk(name)
                    if c.type in {"identifier", "shorthand_property_identifier_pattern"}
                )
        if node.type == "assignment_expression" and is_tainted(node.child_by_field_name("right"), aliases):
            left = node.child_by_field_name("left")
            if left.type == "identifier":
                aliases.add(text(left))
    return aliases


def owner_constraint(args):
    # Only count server identity predicates in the same lookup arguments.
    first = args.named_children[0] if args.named_children else None
    constraint = first
    if first and first.type == "object":
        where = next(
            (
                p.child_by_field_name("value")
                for p in first.named_children
                if p.type == "pair" and field_text(p, "key").strip("'\"") == "where"
            ),
            None,
        )
        constraint = where if where is not None else first
    direct_pairs = constraint.named_children if constraint and constraint.type == "object" else []
    for node in direct_pairs:
        if node.type == "pair" and field_text(node, "key").strip("'\"").lower() in OWNER_KEYS:
            value = node.child_by_field_name("value")
            if value and value.type == "member_expression" and IDENTITY.fullmatch(text(value)):
                return True
    for node in walk(args):
        if node.type == "binary_expression":
            left, right = node.child_by_field_name("left"), node.child_by_field_name("right")
            operator = field_text(node, "operator")
            if operator in {"===", "=="}:
                for a, b in ((left, right), (right, left)):
                    if member(a)[1].lower() in OWNER_KEYS and IDENTITY.fullmatch(text(b)):
                        # OR conditions do not constrain every accepted record.
                        parent = node.parent
                        unsafe_or = False
                        while parent and parent != args:
                            if parent.type == "binary_expression" and field_text(parent, "operator") == "||":
                                unsafe_or = True
                            parent = parent.parent
                        if not unsafe_or:
                            return True
    return False


def verify(finding, files):
    if not finding.evidence:
        return False
    for item in finding.evidence:
        lines = files.get(item.file, "").splitlines()
        if not 1 <= item.line <= item.end_line <= len(lines):
            return False
        if item.snippet != redact("\n".join(lines[item.line - 1 : item.end_line])):
            return False
    return True


def analyze(files):
    units, routes, warnings = parse(files)
    findings, nodes, edges = [], {}, []

    def add_node(id, kind, label, **extra):
        nodes[id] = {"id": id, "kind": kind, "label": label, **extra}

    def edge(source, target, kind):
        value = {"source": source, "target": target, "kind": kind}
        if value not in edges:
            edges.append(value)

    schemas = []
    for file, code in files.items():
        if file.endswith((".prisma", ".sql")):
            for m in re.finditer(r"(?:model|CREATE\s+TABLE)\s+[\"`]?([A-Za-z_]\w*)", code, re.I):
                schemas.append({"name": m[1], "file": file, "line": code[: m.start()].count("\n") + 1})
                add_node(stable("model", m[1].lower()), "Model", m[1], file=file)

    for route in routes:
        rid = stable(route.file, route.line, route.path)
        label = f"{route.method} {route.path}"
        add_node(rid, "Route", label, file=route.file, line=route.line)
        route_ev = evidence(files, route.file, route.line, route.line, "route")
        for param in re.findall(r":(\w+)", route.path):
            pid = stable(rid, param)
            add_node(pid, "Input", param)
            edge(rid, pid, "RECEIVES")
        for middleware in route.middleware:
            mid = stable(route.file, middleware)
            add_node(mid, "Middleware", middleware)
            edge(rid, mid, "GUARDED_BY")
        for handler_index, (file, fn) in enumerate(route.handlers):
            fid = stable(file, fn.start_byte)
            add_node(
                fid,
                "Function",
                field_text(fn, "name") or route.handler_name,
                file=file,
                line=fn.start_point.row + 1,
            )
            if handler_index == 0:
                edge(rid, fid, "CALLS")
            else:
                function_name = field_text(fn, "name") or field_text(fn.parent, "name")
                for caller_file, caller in route.handlers:
                    if caller == fn and caller_file == file:
                        continue
                    if any(
                        c.type == "call_expression"
                        and field_text(c, "function").split(".")[-1] == function_name
                        for c in walk(caller)
                    ):
                        edge(stable(caller_file, caller.start_byte), fid, "CALLS")
            for call in walk(fn):
                if call.type != "call_expression":
                    continue
                callee = call.child_by_field_name("function")
                obj, method = member(callee)
                args = call.child_by_field_name("arguments")
                aliases = aliases_before(fn, call.start_byte)
                tainted = is_tainted(args, aliases)
                if not args:
                    continue
                query = method in LOOKUPS and obj not in {"app", "router", "res", "console"}
                if query:
                    qid = stable(file, call.start_byte, "query")
                    add_node(qid, "Query", f"{obj}.{method}", file=file, line=call.start_point.row + 1)
                    edge(fid, qid, "QUERIES")
                    model_id = stable("model", obj.lower())
                    add_node(model_id, "Model", obj)
                    edge(
                        qid,
                        model_id,
                        "READS" if method.startswith("find") or method == "filter" else "WRITES",
                    )
                    owned = owner_constraint(args)
                    if owned:
                        identity_id = stable(rid, "identity")
                        add_node(identity_id, "Identity", "Authenticated user / tenant")
                        edge(qid, identity_id, "CONSTRAINED_BY")
                    if tainted and not owned:
                        sink_ev = evidence(
                            files, file, call.start_point.row + 1, call.end_point.row + 1, "lookup"
                        )
                        auth = any(re.search(r"auth|session|protect|jwt", m, re.I) for m in route.middleware)
                        findings.append(
                            Finding(
                                id=stable("BOLA001", rid, file, call.start_byte),
                                rule_id="BOLA001",
                                title="Potential broken object-level authorization",
                                category="authorization",
                                severity="high",
                                confidence=0.84 if auth else 0.72,
                                route=label,
                                summary=f"Request-controlled input reaches {obj}.{method} without a recognized owner or tenant constraint in that lookup.",
                                impact="A caller may read or change another user's records if this resource is private and no separate authorization control protects it.",
                                remediation="Constrain the lookup by both the requested object ID and the authenticated user's owner or tenant ID. Reject access when no authorized record matches.",
                                assumptions=[
                                    "The resource is user- or tenant-scoped; confirm its intended access policy.",
                                    "External middleware, database row policies, and post-query checks require manual review.",
                                ]
                                + (
                                    [
                                        "Authentication-like middleware is present; its implementation is not proven."
                                    ]
                                    if auth
                                    else [
                                        "No recognized authentication middleware was observed on this route."
                                    ]
                                ),
                                attack_path=[
                                    label,
                                    "Caller supplies an object identifier",
                                    f"{obj}.{method} consumes request-derived input",
                                    "No recognized ownership predicate in the lookup",
                                ],
                                evidence=[route_ev, sink_ev],
                            )
                        )
                sink = field_text(call, "function")
                unsafe_kind = None
                first = args.named_children[0] if args.named_children else None
                if (
                    method in {"query", "$queryRawUnsafe", "$executeRawUnsafe", "execute"}
                    and first
                    and is_tainted(first, aliases)
                ):
                    unsafe_kind = "SQL injection"
                elif (sink in {"eval", "exec", "execSync"} or method in {"exec", "execSync"}) and tainted:
                    unsafe_kind = "Code or command injection"
                if unsafe_kind:
                    sink_ev = evidence(files, file, call.start_point.row + 1, call.end_point.row + 1, "sink")
                    findings.append(
                        Finding(
                            id=stable("INJ001", rid, file, call.start_byte),
                            rule_id="INJ001",
                            title=f"Potential {unsafe_kind.lower()}",
                            category="injection",
                            severity="high",
                            confidence=0.91,
                            route=label,
                            summary=f"Request-derived data reaches {sink} in an executable argument.",
                            impact="An attacker may change query semantics or execute unintended operations with the application's privileges.",
                            remediation="Use parameterized SQL with values passed separately. For commands, avoid a shell and pass validated arguments to a fixed executable. Do not evaluate user input.",
                            assumptions=[
                                "Validation in external functions is not modeled; review the recorded input-to-sink path."
                            ],
                            attack_path=[label, "Untrusted request input", sink, "Executable sink"],
                            evidence=[route_ev, sink_ev],
                        )
                    )
    # AST-only literal secret detection excludes comments and environment lookups.
    for file, unit in units.items():
        for node in walk(unit.tree.root_node):
            if node.type not in {"variable_declarator", "pair", "assignment_expression"}:
                continue
            name = field_text(node, "name") or field_text(node, "key") or field_text(node, "left")
            value = node.child_by_field_name("value") or node.child_by_field_name("right")
            if (
                not re.search(r"secret|api_?key|password|access_?token", name, re.I)
                or not value
                or value.type != "string"
            ):
                continue
            literal = text(value).strip("'\"")
            if len(literal) < 8 or literal in {
                "[REDACTED]",
                "your-api-key",
                "changeme",
                "password",
                "placeholder",
            }:
                continue
            ev = evidence(files, file, node.start_point.row + 1, node.end_point.row + 1, "secret")
            findings.append(
                Finding(
                    id=stable("SEC001", file, node.start_byte),
                    rule_id="SEC001",
                    title="Hardcoded credential candidate",
                    category="secrets",
                    severity="high",
                    confidence=0.87,
                    summary=f"{name} is assigned a credential-like string literal.",
                    impact="A real credential committed to source may be accessible to anyone with repository access.",
                    remediation="Revoke and rotate the credential if real. Load its replacement from a secret manager or environment variable and remove it from source history.",
                    assumptions=[
                        "The literal may be a test value; confirm before rotating a real credential."
                    ],
                    attack_path=[
                        file,
                        "Credential-like literal in source",
                        "Repository access exposes the value",
                    ],
                    evidence=[ev],
                )
            )
    valid = {f.id: f for f in findings if verify(f, files)}
    return {
        "findings": list(valid.values()),
        "graph": {"nodes": list(nodes.values()), "edges": edges},
        "routes": [
            {
                "method": r.method,
                "path": r.path,
                "file": r.file,
                "line": r.line,
                "middleware": r.middleware,
                "resolved": bool(r.handlers),
            }
            for r in routes
        ],
        "schemas": schemas,
        "warnings": warnings,
        "coverage": {
            "source_files": len(files),
            "parsed_files": len(units),
            "routes": len(routes),
            "resolved_routes": sum(bool(r.handlers) for r in routes),
            "functions": sum(len(u.functions) for u in units.values()),
        },
    }
