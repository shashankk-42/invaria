"""Tree-sitter JS/TS structural extraction and bounded local import resolution.

No type inference or complete JS control-flow analysis is claimed. Unsupported
handlers are surfaced in coverage, never silently interpreted as safe.
"""

import posixpath
import re
from dataclasses import dataclass, field

import tree_sitter_javascript as javascript
import tree_sitter_typescript as typescript
from tree_sitter import Language, Parser

JS = Language(javascript.language())
TS = Language(typescript.language_typescript())
TSX = Language(typescript.language_tsx())
FUNCTIONS = {
    "function_declaration",
    "function_expression",
    "arrow_function",
    "generator_function_declaration",
}


def walk(node):
    yield node
    for child in node.named_children:
        yield from walk(child)


def text(node) -> str:
    return node.text.decode("utf-8") if node else ""


def field_text(node, name):
    return text(node.child_by_field_name(name))


def member(node):
    if node and node.type == "member_expression":
        return field_text(node, "object"), field_text(node, "property")
    return "", ""


@dataclass
class Unit:
    file: str
    code: str
    tree: object
    functions: dict = field(default_factory=dict)
    imports: dict = field(default_factory=dict)
    routers: set = field(default_factory=set)


@dataclass
class Route:
    file: str
    method: str
    path: str
    line: int
    end_line: int
    handler_name: str
    handlers: list = field(default_factory=list)  # (file, syntax node)
    middleware: list[str] = field(default_factory=list)
    unresolved: list[str] = field(default_factory=list)


def resolve_import(file, specifier, files):
    if not specifier.startswith("."):
        return None
    base = posixpath.normpath(posixpath.join(posixpath.dirname(file), specifier))
    candidates = [
        base,
        *[base + ext for ext in (".ts", ".js", ".tsx", ".mjs")],
        base + "/index.ts",
        base + "/index.js",
    ]
    return next((p for p in candidates if p in files), None)


def parse(files: dict[str, str]):
    units, warnings = {}, []
    for file, code in files.items():
        if not file.endswith((".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs")):
            continue
        parser = Parser(TSX if file.endswith(".tsx") else TS if file.endswith(".ts") else JS)
        tree = parser.parse(code.encode())
        unit = Unit(file, code, tree)
        if tree.root_node.has_error:
            warnings.append(f"Syntax errors in {file}; extraction may be incomplete.")
        for node in walk(tree.root_node):
            if node.type in FUNCTIONS:
                name = field_text(node, "name")
                if not name and node.parent and node.parent.type == "variable_declarator":
                    name = field_text(node.parent, "name")
                if not name and node.parent and node.parent.type == "assignment_expression":
                    name = field_text(node.parent, "left").split(".")[-1]
                if name:
                    unit.functions[name] = node
            if node.type == "import_statement":
                source = field_text(node, "source").strip("'\"")
                target = resolve_import(file, source, files)
                if target:
                    for child in walk(node):
                        if child.type == "import_specifier":
                            unit.imports[field_text(child, "alias") or field_text(child, "name")] = (
                                target,
                                field_text(child, "name"),
                            )
                        elif child.type == "import_clause":
                            for c in child.named_children:
                                if c.type == "identifier":
                                    unit.imports[text(c)] = (target, text(c))
            if node.type == "variable_declarator":
                name, value = field_text(node, "name"), field_text(node, "value")
                if re.fullmatch(r"(?:express\s*\(\s*\)|(?:express\.)?Router\s*\(\s*\))", value):
                    unit.routers.add(name)
                match = re.match(r"require\(['\"](.+?)['\"]\)", value)
                if match:
                    target = resolve_import(file, match[1], files)
                    if target:
                        for binding in re.findall(r"[A-Za-z_$][\w$]*", name):
                            unit.imports[binding] = (target, binding)
        units[file] = unit

    def resolve(file, name):
        unit = units[file]
        if name in unit.functions:
            return file, unit.functions[name]
        target, imported = unit.imports.get(name.split(".")[0], (None, None))
        if target in units:
            candidate = name.split(".")[-1] if "." in name else imported
            found = units[target].functions.get(candidate)
            if found:
                return target, found
        return None

    routes = []
    for file, unit in units.items():
        global_middleware = []
        for node in walk(unit.tree.root_node):
            if node.type != "call_expression":
                continue
            obj, method = member(node.child_by_field_name("function"))
            if obj not in unit.routers:
                continue
            args_node = node.child_by_field_name("arguments")
            args = args_node.named_children if args_node else []
            if method == "use" and args:
                global_middleware.extend(text(a) for a in args if a.type == "identifier")
            if method not in {"get", "post", "put", "patch", "delete", "options", "head"} or len(args) < 2:
                continue
            if args[0].type != "string":
                warnings.append(f"Dynamic route at {file}:{node.start_point.row + 1} is unsupported.")
                continue
            route = Route(
                file,
                method.upper(),
                text(args[0]).strip("'\""),
                node.start_point.row + 1,
                node.end_point.row + 1,
                text(args[-1])[:100],
            )
            route.middleware = global_middleware.copy() + [
                text(a) for a in args[1:-1] if a.type not in FUNCTIONS
            ]
            handler = args[-1]
            if handler.type in FUNCTIONS:
                route.handler_name = "inline handler"
                route.handlers.append((file, handler))
            else:
                found = resolve(file, text(handler))
                if found:
                    route.handlers.append(found)
                else:
                    route.unresolved.append(text(handler))
            # Follow statically named local functions, with cycle/depth bounds.
            visited = set()
            index = 0
            while index < len(route.handlers) and index < 12:
                handler_file, fn = route.handlers[index]
                index += 1
                key = (handler_file, fn.start_byte)
                if key in visited:
                    continue
                visited.add(key)
                for call in walk(fn):
                    if call.type == "call_expression":
                        found = resolve(handler_file, field_text(call, "function"))
                        if (
                            found
                            and (found[0], found[1].start_byte) not in visited
                            and all(
                                (f, n.start_byte) != (found[0], found[1].start_byte)
                                for f, n in route.handlers
                            )
                        ):
                            route.handlers.append(found)
            route.handlers = route.handlers[:12]
            if route.unresolved:
                warnings.append(f"Unresolved handler {route.unresolved[0]} at {file}:{route.line}.")
            routes.append(route)
    # Prefix relative router paths when one unambiguous app.use('/prefix', router) mount exists.
    mounts = {}
    for file, unit in units.items():
        for node in walk(unit.tree.root_node):
            if node.type != "call_expression" or member(node.child_by_field_name("function"))[1] != "use":
                continue
            args_node = node.child_by_field_name("arguments")
            args = args_node.named_children if args_node else []
            if len(args) == 2 and args[0].type == "string":
                target = unit.imports.get(text(args[1]), (None, None))[0]
                if target:
                    mounts.setdefault(target, []).append(text(args[0]).strip("'\""))
    for route in routes:
        if len(mounts.get(route.file, [])) == 1:
            route.path = mounts[route.file][0].rstrip("/") + "/" + route.path.lstrip("/")
    return units, routes, warnings
