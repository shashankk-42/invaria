"""Optional repository-local business invariants for INVARIANT.

The policy is source-controlled with the application so reviewers can version
the security intent with the code. It is never treated as source evidence and
is never sent to a model as instructions.
"""

import fnmatch
import json
import re
from dataclasses import dataclass

POLICY_PATH = ".invaria/invariants.json"
IDENTIFIER = re.compile(r"[A-Za-z_$][\w$]{0,80}$")


@dataclass(frozen=True)
class BusinessInvariant:
    id: str
    route: str
    fields: frozenset[str]
    controls: tuple[str, ...]
    description: str


def load_invariants(files):
    """Load a small, strict policy format and surface malformed policy as coverage."""

    source = files.get(POLICY_PATH)
    if source is None:
        return [], []
    try:
        body = json.loads(source)
    except json.JSONDecodeError:
        return [], [f"Could not parse {POLICY_PATH}; business invariants were not applied."]
    if not isinstance(body, dict) or body.get("version") != 1 or not isinstance(body.get("invariants"), list):
        return [], [f"{POLICY_PATH} must contain version 1 and an invariants list."]

    invariants, warnings, seen = [], [], set()
    for index, item in enumerate(body["invariants"], start=1):
        if not isinstance(item, dict):
            warnings.append(f"Ignored invariant {index} in {POLICY_PATH}: expected an object.")
            continue
        identifier = item.get("id")
        route = item.get("route")
        fields = item.get("fields")
        controls = item.get("controls", [])
        description = item.get("description", "")
        valid = (
            isinstance(identifier, str)
            and IDENTIFIER.fullmatch(identifier)
            and identifier not in seen
            and isinstance(route, str)
            and route
            and isinstance(fields, list)
            and fields
            and all(isinstance(field, str) and field.strip() for field in fields)
            and isinstance(controls, list)
            and all(isinstance(control, str) and IDENTIFIER.fullmatch(control) for control in controls)
            and isinstance(description, str)
        )
        if not valid:
            warnings.append(
                f"Ignored invariant {index} in {POLICY_PATH}: invalid id, route, fields, or controls."
            )
            continue
        seen.add(identifier)
        invariants.append(
            BusinessInvariant(
                id=identifier,
                route=route,
                fields=frozenset(field.lower() for field in fields),
                controls=tuple(controls),
                description=description[:500],
            )
        )
    return invariants, warnings


def matching_invariants(invariants, route, fields):
    fields = {field.lower() for field in fields}
    return [
        invariant
        for invariant in invariants
        if fnmatch.fnmatchcase(route, invariant.route) and invariant.fields.intersection(fields)
    ]
