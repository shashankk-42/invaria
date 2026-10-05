import hashlib
import re
from collections import defaultdict

from .algorithm import decision_record, scan_ledger
from .models import Evidence, Finding
from .parser import field_text, member, parse, text, walk
from .policy import load_invariants, matching_invariants

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
    "create",
    "upsert",
    "save",
    "increment",
    "decrement",
}
WRITE_METHODS = {"update", "delete", "destroy", "create", "upsert", "save", "increment", "decrement"}
SENSITIVE_BUSINESS_FIELDS = {
    "amount",
    "balance",
    "credit",
    "debit",
    "discount",
    "inventory",
    "limit",
    "price",
    "quantity",
    "refund",
    "status",
    "stock",
    "total",
}
FINANCIAL_TERMS = {
    "amount",
    "balance",
    "credit",
    "debit",
    "payment",
    "refund",
    "transfer",
    "wallet",
    "withdraw",
}
COMMERCE_TERMS = {"cart", "coupon", "discount", "inventory", "order", "price", "quantity", "stock"}


def stable(*parts):
    return hashlib.sha256("|".join(map(str, parts)).encode()).hexdigest()[:20]


def redact(value):
    # Never send literal secret evidence to model providers or report exports.
    value = re.sub(
        r"(?i)((?:secret|api[_-]?key|password|token)\s*[:=]\s*)(['\"])([^'\"\n]{8,})\2",
        r"\1\2[REDACTED]\2",
        value,
    )
    value = re.sub(
        r"(?i)(os\.(?:getenv|environ\.get)\(\s*['\"][^'\"]*(?:secret|api[_-]?key|password|token)[^'\"]*['\"]\s*,\s*)(['\"])([^'\"\n]{8,})\2",
        r"\1\2[REDACTED]\2",
        value,
    )
    return re.sub(
        r"(?i)(Field\(\s*default\s*=\s*)(['\"])([^'\"\n]{8,})\2(?=\s*,\s*alias\s*=\s*['\"][^'\"]*(?:secret|api[_-]?key|password|token)[^'\"]*['\"])",
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


def aliases_before(fn, before, initial=()):
    aliases = set(initial)
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


def is_identity(node, aliases=()):
    return bool(
        node
        and (
            (node.type == "identifier" and text(node) in aliases)
            or (node.type == "member_expression" and IDENTITY.fullmatch(text(node)))
        )
    )


def identity_aliases_before(fn, before, initial=()):
    aliases = set(initial)
    for node in walk(fn):
        if node.start_byte >= before:
            continue
        if node.type == "variable_declarator":
            name, value = node.child_by_field_name("name"), node.child_by_field_name("value")
            if is_identity(value, aliases):
                aliases.update(text(c) for c in walk(name) if c.type == "identifier")
        if node.type == "assignment_expression" and is_identity(node.child_by_field_name("right"), aliases):
            left = node.child_by_field_name("left")
            if left and left.type == "identifier":
                aliases.add(text(left))
    return aliases


def function_parameters(fn):
    parameters = fn.child_by_field_name("parameters")
    if not parameters:
        return []
    result = []
    for parameter in parameters.named_children:
        if parameter.type == "identifier":
            result.append(text(parameter))
        else:
            name = parameter.child_by_field_name("pattern") or parameter.child_by_field_name("name")
            if name and name.type == "identifier":
                result.append(text(name))
    return result


def function_name(fn):
    return field_text(fn, "name") or field_text(fn.parent, "name")


def request_controlled_business_fields(args, aliases):
    """Return high-impact fields written directly from a request-controlled value."""

    fields = set()
    for node in walk(args):
        if node.type != "pair":
            continue
        field = field_text(node, "key").strip("'\"").lower()
        value = node.child_by_field_name("value")
        if field in SENSITIVE_BUSINESS_FIELDS and is_tainted(value, aliases):
            fields.add(field)
    return sorted(fields)


def business_domain(route, model, fields):
    terms = set(re.findall(r"[a-z]+", f"{route} {model} {' '.join(fields)}".lower()))
    if terms.intersection(FINANCIAL_TERMS):
        return "financial"
    if terms.intersection(COMMERCE_TERMS):
        return "commerce"
    # State transitions are only high-interest when they affect a business
    # endpoint; a generic in-memory status field is excluded above.
    return (
        "state"
        if "status" in fields and terms.intersection(COMMERCE_TERMS | {"account", "patient"})
        else None
    )


def policy_controls(route, invariants):
    """Report exact, declared control markers observed in route handlers.

    A marker is evidence that named code is present, not proof that the control
    is correct. The distinction remains visible in the finding's assumptions.
    """

    required = sorted({control for invariant in invariants for control in invariant.controls})
    code = "\n".join(text(fn) for _, fn in route.handlers)
    observed = [control for control in required if re.search(rf"\b{re.escape(control)}\b", code)]
    return required, observed


def route_flow_context(route):
    """Track direct, resolved argument-to-parameter hops within one route.

    This is intentionally bounded by parser-resolved route handlers.  It does
    not claim general JavaScript interprocedural analysis; ambiguous function
    names are left unpropagated rather than guessed.
    """

    handlers = {(file, fn.start_byte): (file, fn) for file, fn in route.handlers}
    by_name = defaultdict(list)
    for key, (_, fn) in handlers.items():
        name = function_name(fn)
        if name:
            by_name[name].append(key)
    tainted, identities, flows = defaultdict(set), defaultdict(set), defaultdict(list)

    # A route handler may call several helpers. Iterate to a stable bounded
    # state so a two-hop local path is captured without unbounded recursion.
    for _ in range(max(1, min(len(handlers), 12))):
        changed = False
        for caller_key, (caller_file, caller) in handlers.items():
            for call in walk(caller):
                if call.type != "call_expression":
                    continue
                target_name = field_text(call, "function").split(".")[-1]
                targets = by_name.get(target_name, [])
                if len(targets) != 1:
                    continue
                target_key = targets[0]
                arguments = call.child_by_field_name("arguments")
                if not arguments:
                    continue
                input_aliases = aliases_before(caller, call.start_byte, tainted[caller_key])
                identity_aliases = identity_aliases_before(caller, call.start_byte, identities[caller_key])
                for parameter, argument in zip(
                    function_parameters(handlers[target_key][1]), arguments.named_children
                ):
                    if is_tainted(argument, input_aliases) and parameter not in tainted[target_key]:
                        tainted[target_key].add(parameter)
                        flows[target_key].append(
                            (caller_file, call.start_point.row + 1, call.end_point.row + 1)
                        )
                        changed = True
                    if is_identity(argument, identity_aliases) and parameter not in identities[target_key]:
                        identities[target_key].add(parameter)
                        changed = True
        if not changed:
            break
    return tainted, identities, flows


def owner_constraint(args, identity_aliases=()):
    # Only count server identity predicates in the same lookup arguments.
    constraints = []
    for argument in args.named_children:
        if argument.type != "object":
            continue
        constraints.append(argument)
        constraints.extend(
            p.child_by_field_name("value")
            for p in argument.named_children
            if p.type == "pair" and field_text(p, "key").strip("'\"") == "where"
        )
    for constraint in constraints:
        for node in constraint.named_children if constraint and constraint.type == "object" else []:
            if node.type == "pair" and field_text(node, "key").strip("'\"").lower() in OWNER_KEYS:
                if is_identity(node.child_by_field_name("value"), identity_aliases):
                    return True
    for node in walk(args):
        if node.type == "binary_expression":
            left, right = node.child_by_field_name("left"), node.child_by_field_name("right")
            operator = field_text(node, "operator")
            if operator in {"===", "=="}:
                for a, b in ((left, right), (right, left)):
                    if member(a)[1].lower() in OWNER_KEYS and is_identity(b, identity_aliases):
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
    # The Express graph remains the rich route model. These bounded checks add
    # direct Python and Firebase configuration evidence without claiming
    # cross-language request-flow analysis.
    from .supplemental_checks import supplemental_findings

    supplemental, supplemental_coverage = supplemental_findings(files)
    warnings += supplemental_coverage["warnings"]
    invariants, policy_warnings = load_invariants(files)
    warnings += policy_warnings
    findings, nodes, edges = list(supplemental), {}, []

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
        route_taint, route_identity, route_flows = route_flow_context(route)
        for handler_index, (file, fn) in enumerate(route.handlers):
            handler_key = (file, fn.start_byte)
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
                aliases = aliases_before(fn, call.start_byte, route_taint[handler_key])
                identity_aliases = identity_aliases_before(fn, call.start_byte, route_identity[handler_key])
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
                    owned = owner_constraint(args, identity_aliases)
                    if owned:
                        identity_id = stable(rid, "identity")
                        add_node(identity_id, "Identity", "Authenticated user / tenant")
                        edge(qid, identity_id, "CONSTRAINED_BY")
                    if tainted and not owned:
                        sink_ev = evidence(
                            files, file, call.start_point.row + 1, call.end_point.row + 1, "lookup"
                        )
                        auth = any(re.search(r"auth|session|protect|jwt", m, re.I) for m in route.middleware)
                        flow_evidence = [
                            evidence(files, flow_file, flow_line, flow_end, "flow")
                            for flow_file, flow_line, flow_end in route_flows[handler_key][:2]
                        ]
                        finding = Finding(
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
                                else ["No recognized authentication middleware was observed on this route."]
                            ),
                            attack_path=[
                                label,
                                "Caller supplies an object identifier",
                                f"{obj}.{method} consumes request-derived input",
                                "No recognized ownership predicate in the lookup",
                            ],
                            evidence=[route_ev, *flow_evidence, sink_ev],
                        )
                        finding.algorithm = decision_record(
                            finding,
                            uncertainties=finding.assumptions,
                            risk_signals=[
                                "state-changing operation"
                                if method in {"update", "delete", "destroy"}
                                else "private-data operation"
                            ],
                        )
                        finding.confidence = finding.algorithm["confidence"]
                        findings.append(finding)
                    if method in WRITE_METHODS:
                        business_fields = request_controlled_business_fields(args, aliases)
                        domain = business_domain(label, obj, business_fields)
                        if business_fields and domain:
                            operation_id = stable("business-operation", rid, obj, method)
                            add_node(
                                operation_id,
                                "BusinessOperation",
                                f"{domain.title()} mutation: {obj}.{method}",
                                file=file,
                                line=call.start_point.row + 1,
                                fields=business_fields,
                            )
                            edge(qid, operation_id, "MUTATES")
                            matched = matching_invariants(invariants, label, business_fields)
                            required_controls, observed_controls = policy_controls(route, matched)
                            missing_controls = sorted(set(required_controls) - set(observed_controls))
                            policy = {
                                "matched_invariants": [
                                    {
                                        "id": invariant.id,
                                        "description": invariant.description,
                                        "required_controls": list(invariant.controls),
                                    }
                                    for invariant in matched
                                ],
                                "observed_control_markers": observed_controls,
                                "missing_control_markers": missing_controls,
                                "coverage": (
                                    "declared controls observed; semantic correctness is not proven"
                                    if matched and not missing_controls
                                    else "declared policy has missing control markers"
                                    if matched
                                    else "no repository policy matched"
                                ),
                            }
                            # A repository owner can declare exact control markers for a
                            # flow. When they all exist, record coverage instead of
                            # generating the generic candidate. A later semantic verifier
                            # must still test whether they enforce the policy correctly.
                            if matched and not missing_controls:
                                continue
                            mutation_ev = evidence(
                                files, file, call.start_point.row + 1, call.end_point.row + 1, "mutation"
                            )
                            flow_evidence = [
                                evidence(files, flow_file, flow_line, flow_end, "flow")
                                for flow_file, flow_line, flow_end in route_flows[handler_key][:2]
                            ]
                            severity = "high" if domain == "financial" else "medium"
                            confidence = 0.84 if matched else 0.72
                            finding = Finding(
                                id=stable("BFL001", rid, file, call.start_byte),
                                rule_id="BFL001",
                                title="Potential unverified sensitive business mutation",
                                category="business_logic",
                                severity=severity,
                                confidence=confidence,
                                route=label,
                                summary=(
                                    f"Request-controlled {', '.join(business_fields)} reaches {obj}.{method} "
                                    f"in a {domain} operation without a fully observed declared invariant."
                                ),
                                impact=(
                                    "A caller may alter transaction value, balance, inventory, discount, or state "
                                    "outside the business rules intended by the application."
                                ),
                                remediation=(
                                    "Derive sensitive values and allowed transitions from authoritative server-side "
                                    "state. Enforce the mutation in an atomic transaction, require idempotency for "
                                    "retriable operations, and declare the expected invariant in .invaria/invariants.json."
                                ),
                                assumptions=[
                                    "A request-controlled sensitive field reaches a persistent write; runtime policy "
                                    "and transaction semantics require review.",
                                    "Observed control markers prove code presence, not the semantic correctness of a control.",
                                ],
                                attack_path=[
                                    label,
                                    f"Caller supplies {', '.join(business_fields)}",
                                    f"{obj}.{method} performs a persistent mutation",
                                    "Business invariant is absent or its declared markers are incomplete",
                                ],
                                evidence=[route_ev, *flow_evidence, mutation_ev],
                            )
                            finding.algorithm = decision_record(
                                finding,
                                uncertainties=finding.assumptions,
                                risk_signals=[f"{domain} mutation", *business_fields],
                                policy=policy,
                            )
                            finding.confidence = finding.algorithm["confidence"]
                            findings.append(finding)
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
                    flow_evidence = [
                        evidence(files, flow_file, flow_line, flow_end, "flow")
                        for flow_file, flow_line, flow_end in route_flows[handler_key][:2]
                    ]
                    finding = Finding(
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
                        evidence=[route_ev, *flow_evidence, sink_ev],
                    )
                    finding.algorithm = decision_record(
                        finding, uncertainties=finding.assumptions, risk_signals=["executable sink"]
                    )
                    finding.confidence = finding.algorithm["confidence"]
                    findings.append(finding)
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
            finding = Finding(
                id=stable("SEC001", file, node.start_byte),
                rule_id="SEC001",
                title="Hardcoded credential candidate",
                category="secrets",
                severity="high",
                confidence=0.87,
                summary=f"{name} is assigned a credential-like string literal.",
                impact="A real credential committed to source may be accessible to anyone with repository access.",
                remediation="Revoke and rotate the credential if real. Load its replacement from a secret manager or environment variable and remove it from source history.",
                assumptions=["The literal may be a test value; confirm before rotating a real credential."],
                attack_path=[
                    file,
                    "Credential-like literal in source",
                    "Repository access exposes the value",
                ],
                evidence=[ev],
            )
            finding.algorithm = decision_record(finding, uncertainties=finding.assumptions)
            finding.confidence = finding.algorithm["confidence"]
            findings.append(finding)
    valid = {
        f.id: f for f in findings if verify(f, files) and (f.algorithm or {}).get("decision") == "reported"
    }
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
            "parsed_files": len(units) + supplemental_coverage["reviewed_files"],
            "javascript_files": len(units),
            "python_files": supplemental_coverage["python_files"],
            "client_config_files": supplemental_coverage["client_config_files"],
            "routes": len(routes),
            "resolved_routes": sum(bool(r.handlers) for r in routes),
            "functions": sum(len(u.functions) for u in units.values())
            + supplemental_coverage["functions"],
        },
        "algorithm": scan_ledger(list(valid.values())),
    }
