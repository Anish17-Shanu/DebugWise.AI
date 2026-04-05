import ast
import builtins
import random
import re
from collections import Counter


PYTHON_BUILTINS = set(dir(builtins))
JS_DECLARATION_RE = re.compile(r"\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)")
JAVA_DECLARATION_RE = re.compile(
    r"\b(?:byte|short|int|long|float|double|boolean|char|String|var|final\s+\w+)\s+([A-Za-z_]\w*)"
)


def _line_at(source: str, line_number: int) -> str:
    lines = source.splitlines()
    if 1 <= line_number <= len(lines):
        return lines[line_number - 1].rstrip()
    return ""


def _replace_line(source: str, line_number: int, replacement: str) -> str:
    lines = source.splitlines()
    if not (1 <= line_number <= len(lines)):
        return source
    lines[line_number - 1] = replacement
    return "\n".join(lines)


def _insert_before_line(source: str, line_number: int, insertion: str) -> str:
    lines = source.splitlines()
    index = max(0, min(len(lines), line_number - 1))
    lines.insert(index, insertion)
    return "\n".join(lines)


def _delete_line(source: str, line_number: int) -> str:
    lines = source.splitlines()
    if 1 <= line_number <= len(lines):
        del lines[line_number - 1]
    return "\n".join(lines)


def _make_issue(
    *,
    line: int,
    column: int,
    severity: str,
    category: str,
    title: str,
    message: str,
    why: str,
    action: str,
    metadata: dict | None = None,
) -> dict:
    return {
        "line": line,
        "column": column,
        "severity": severity,
        "category": category,
        "title": title,
        "message": message,
        "whyItMatters": why,
        "suggestedAction": action,
        "metadata": metadata or {},
    }


def detect_python_syntax(source: str) -> tuple[list[dict], ast.AST | None]:
    try:
        tree = ast.parse(source)
        return [], tree
    except SyntaxError as error:
        return [
            _make_issue(
                line=error.lineno or 1,
                column=error.offset or 1,
                severity="critical",
                category="syntax",
                title="Python syntax error",
                message=error.msg,
                why="The interpreter cannot parse the file, so execution stops immediately.",
                action="Fix the malformed token or indentation near the highlighted line.",
                metadata={"syntaxMessage": error.msg},
            )
        ], None


class PythonIssueVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.defined_names = set(PYTHON_BUILTINS)
        self.issues: list[dict] = []

    def _add_issue(self, issue: dict) -> None:
        signature = (issue["line"], issue["title"], issue["message"])
        existing = {(item["line"], item["title"], item["message"]) for item in self.issues}
        if signature not in existing:
            self.issues.append(issue)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self.defined_names.add(node.name)
        original = set(self.defined_names)
        for argument in node.args.args:
            self.defined_names.add(argument.arg)
        self.generic_visit(node)
        self.defined_names = original | {node.name}

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self.visit_FunctionDef(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:
        self.defined_names.add(node.name)
        self.generic_visit(node)

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            self.defined_names.add(alias.asname or alias.name.split(".")[0])

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        for alias in node.names:
            self.defined_names.add(alias.asname or alias.name)

    def visit_Assign(self, node: ast.Assign) -> None:
        for target in node.targets:
            for name in self._extract_store_names(target):
                self.defined_names.add(name)
        self.generic_visit(node)

    def visit_AnnAssign(self, node: ast.AnnAssign) -> None:
        for name in self._extract_store_names(node.target):
            self.defined_names.add(name)
        self.generic_visit(node)

    def visit_AugAssign(self, node: ast.AugAssign) -> None:
        for name in self._extract_store_names(node.target):
            self.defined_names.add(name)
        self.generic_visit(node)

    def visit_For(self, node: ast.For) -> None:
        for name in self._extract_store_names(node.target):
            self.defined_names.add(name)
        self.generic_visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        if isinstance(node.ctx, ast.Load) and node.id not in self.defined_names:
            self._add_issue(
                _make_issue(
                    line=node.lineno,
                    column=node.col_offset + 1,
                    severity="error",
                    category="runtime",
                    title="Undefined variable risk",
                    message=f"`{node.id}` is used before it is defined.",
                    why="This raises a NameError at runtime and usually hides a typo or missed assignment.",
                    action=f"Define `{node.id}` before this line or replace it with the intended variable.",
                    metadata={"name": node.id},
                )
            )

    def visit_Expr(self, node: ast.Expr) -> None:
        value = node.value
        if isinstance(value, ast.Compare):
            first_op = value.ops[0] if value.ops else None
            if isinstance(first_op, ast.Eq):
                self._add_issue(
                    _make_issue(
                        line=node.lineno,
                        column=node.col_offset + 1,
                        severity="warning",
                        category="logic",
                        title="Unused equality comparison",
                        message="This equality comparison does not affect program state.",
                        why="It often means `==` was written where assignment or a real condition was intended.",
                        action="Use `=` for assignment or move the comparison into an `if` statement.",
                        metadata={"operator": "=="},
                    )
                )

        if isinstance(value, ast.BinOp) and isinstance(value.op, (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod)):
            self._add_issue(
                _make_issue(
                    line=node.lineno,
                    column=node.col_offset + 1,
                    severity="warning",
                    category="logic",
                    title="Unused arithmetic expression",
                    message="This arithmetic expression is evaluated and then discarded.",
                    why="A bare math expression usually means assignment was forgotten or the wrong line was edited.",
                    action="Assign the result to a variable or remove the line if it was accidental.",
                )
            )

        if (
            isinstance(value, ast.Call)
            and isinstance(value.func, ast.Name)
            and value.func.id == "print"
            and any(isinstance(arg, ast.Constant) and isinstance(arg.value, str) and "debug" in arg.value.lower() for arg in value.args)
        ):
            self._add_issue(
                _make_issue(
                    line=node.lineno,
                    column=node.col_offset + 1,
                    severity="info",
                    category="style",
                    title="Transient debug print",
                    message="This print statement looks like temporary debugging output.",
                    why="Temporary debug output makes production behavior harder to reason about once the real fix lands.",
                    action="Remove it after the issue is understood, or switch to intentional structured logging.",
                )
            )

        self.generic_visit(node)

    def visit_BinOp(self, node: ast.BinOp) -> None:
        if isinstance(node.op, (ast.Div, ast.FloorDiv, ast.Mod)) and isinstance(node.right, ast.Constant) and node.right.value == 0:
            self._add_issue(
                _make_issue(
                    line=node.lineno,
                    column=node.col_offset + 1,
                    severity="critical",
                    category="runtime",
                    title="Division by zero",
                    message="This expression divides by a literal zero.",
                    why="It fails every time this code path executes.",
                    action="Guard the denominator or replace the literal with a valid non-zero value.",
                    metadata={"denominator": 0},
                )
            )
        self.generic_visit(node)

    def _extract_store_names(self, node: ast.AST) -> list[str]:
        if isinstance(node, ast.Name):
            return [node.id]
        if isinstance(node, (ast.Tuple, ast.List)):
            names: list[str] = []
            for element in node.elts:
                names.extend(self._extract_store_names(element))
            return names
        return []


def detect_python_issues(source: str) -> list[dict]:
    syntax_issues, tree = detect_python_syntax(source)
    if tree is None:
        return syntax_issues

    visitor = PythonIssueVisitor()
    visitor.visit(tree)
    return syntax_issues + visitor.issues


def detect_js_ts_issues(source: str) -> list[dict]:
    diagnostics: list[dict] = []
    declared_names = set(JS_DECLARATION_RE.findall(source))

    for index, line in enumerate(source.splitlines(), start=1):
        stripped = line.strip()

        if "==" in line and ("if " not in line and "while " not in line and "for " not in line):
            diagnostics.append(
                _make_issue(
                    line=index,
                    column=line.index("==") + 1,
                    severity="warning",
                    category="logic",
                    title="Unused equality comparison",
                    message="This equality comparison does not affect program state.",
                    why="It often means assignment or a real condition was intended.",
                    action="Use `=` for assignment or move the comparison into a real condition.",
                    metadata={"operator": "=="},
                )
            )

        if "console.log(" in line and "debug" in line.lower():
            diagnostics.append(
                _make_issue(
                    line=index,
                    column=line.index("console.log(") + 1,
                    severity="info",
                    category="style",
                    title="Transient debug log",
                    message="This console log looks like temporary debugging output.",
                    why="Temporary logging can hide the real signal once the bug is fixed.",
                    action="Remove the log after validation or route it through intentional observability.",
                )
            )

        arithmetic_match = re.match(r"^([A-Za-z_$][\w$]*)\s*([-+*/])\s*.+;?$", stripped)
        if arithmetic_match and "=" not in stripped:
            variable_name = arithmetic_match.group(1)
            severity = "error" if variable_name not in declared_names else "warning"
            title = "Undefined variable risk" if variable_name not in declared_names else "Unused arithmetic expression"
            message = (
                f"`{variable_name}` is referenced before declaration."
                if variable_name not in declared_names
                else "This arithmetic expression is evaluated and discarded."
            )
            why = (
                "It will throw at runtime in strict environments and likely reflects a typo."
                if variable_name not in declared_names
                else "Bare arithmetic statements usually mean the result was meant to be assigned."
            )
            action = (
                f"Declare `{variable_name}` before this line or replace it with the intended symbol."
                if variable_name not in declared_names
                else "Assign the result to a variable or remove the accidental expression."
            )
            diagnostics.append(
                _make_issue(
                    line=index,
                    column=1,
                    severity=severity,
                    category="runtime" if severity == "error" else "logic",
                    title=title,
                    message=message,
                    why=why,
                    action=action,
                    metadata={"name": variable_name},
                )
            )

        if re.search(r"for\s*\(.*;.*;.*\)", line) and ".length" in line:
            diagnostics.append(
                _make_issue(
                    line=index,
                    column=1,
                    severity="warning",
                    category="performance",
                    title="Loop may do repeated bounds work",
                    message="Loop bounds appear to depend on a collection length in each iteration.",
                    why="This is a common hotspot pattern in large loops and can hide clearer intent.",
                    action="Cache the length or switch to an iterator-based loop if that reads better.",
                )
            )

        if "eval(" in line:
            diagnostics.append(
                _make_issue(
                    line=index,
                    column=line.index("eval(") + 1,
                    severity="critical",
                    category="runtime",
                    title="Dynamic execution risk",
                    message="The code executes dynamic source at runtime.",
                    why="Dynamic evaluation creates security, correctness, and observability risks.",
                    action="Replace it with explicit function dispatch or safe parsing.",
                )
            )

    if source.count("{") != source.count("}"):
        diagnostics.append(
            _make_issue(
                line=max(1, len(source.splitlines())),
                column=1,
                severity="error",
                category="syntax",
                title="Unbalanced curly braces",
                message="The number of opening and closing braces does not match.",
                why="Unbalanced blocks break parsing and can mask deeper logic issues.",
                action="Check recent edits for a missing or extra closing brace.",
            )
        )

    return diagnostics


def detect_java_issues(source: str) -> list[dict]:
    diagnostics: list[dict] = []
    declared_names = set(JAVA_DECLARATION_RE.findall(source))
    has_class = bool(re.search(r"\bclass\s+[A-Za-z_]\w*", source))

    if not has_class:
        diagnostics.append(
            _make_issue(
                line=1,
                column=1,
                severity="error",
                category="syntax",
                title="Missing class declaration",
                message="Java execution requires the code to be inside a class.",
                why="`javac` cannot compile free-floating statements like a scripting language can.",
                action="Wrap the code in a class such as `public class Main { ... }`.",
            )
        )

    for index, line in enumerate(source.splitlines(), start=1):
        stripped = line.strip()

        if "System.out.println(" in line and "debug" in line.lower():
            diagnostics.append(
                _make_issue(
                    line=index,
                    column=line.index("System.out.println(") + 1,
                    severity="info",
                    category="style",
                    title="Transient debug print",
                    message="This Java print statement looks like temporary debugging output.",
                    why="Temporary prints make production behavior noisier once the real fix is in place.",
                    action="Remove it after validation or route it through intentional application logging.",
                )
            )

        arithmetic_match = re.match(r"^([A-Za-z_]\w*)\s*([-+*/])\s*.+;?$", stripped)
        if arithmetic_match and "=" not in stripped and not stripped.startswith("return "):
            variable_name = arithmetic_match.group(1)
            known = variable_name in declared_names
            diagnostics.append(
                _make_issue(
                    line=index,
                    column=1,
                    severity="error" if not known else "warning",
                    category="runtime" if not known else "logic",
                    title="Undefined variable risk" if not known else "Unused arithmetic expression",
                    message=(
                        f"`{variable_name}` is referenced before declaration."
                        if not known
                        else "This arithmetic expression is evaluated and discarded."
                    ),
                    why=(
                        "Compilation or execution will fail because the symbol is unknown."
                        if not known
                        else "A bare arithmetic statement usually means assignment was forgotten."
                    ),
                    action=(
                        f"Declare `{variable_name}` before this line or replace it with the intended variable."
                        if not known
                        else "Assign the result to a variable or remove the accidental expression."
                    ),
                    metadata={"name": variable_name},
                )
            )

    if source.count("{") != source.count("}"):
        diagnostics.append(
            _make_issue(
                line=max(1, len(source.splitlines())),
                column=1,
                severity="error",
                category="syntax",
                title="Unbalanced curly braces",
                message="The number of opening and closing braces does not match.",
                why="Java block structure depends on braces, so one missing brace breaks compilation.",
                action="Check recent edits for a missing or extra closing brace.",
            )
        )

    return diagnostics


def detect_generic_issues(language: str, source: str) -> list[dict]:
    if language == "python":
        return detect_python_issues(source)
    if language == "java":
        return detect_java_issues(source)
    return detect_js_ts_issues(source)


def suggest_fixes(source: str, diagnostics: list[dict]) -> list[dict]:
    fixes: list[dict] = []
    lines = source.splitlines()

    for item in diagnostics:
        title = item["title"]
        metadata = item.get("metadata", {})
        line_text = _line_at(source, item["line"])

        if title in {"Transient debug log", "Transient debug print"}:
            candidate = _delete_line(source, item["line"])
            fixes.append(
                {
                    "id": f"fix-{item['line']}-debug-output",
                    "title": "Remove temporary debugging output",
                    "description": "Keep only intentional user-facing output or durable application logging.",
                    "kind": "quick-fix",
                    "confidence": 0.86,
                    "patch": f"Delete line {item['line']} if it is only for debugging, or replace `{line_text.strip()}` with structured logging.",
                    "rationale": "Debug prints are helpful in the moment but become misleading noise once the incident is resolved.",
                    "candidateSource": candidate,
                }
            )
        elif title == "Undefined variable risk":
            name = metadata.get("name", "variable")
            candidate = _insert_before_line(source, item["line"], f"{name} = 0")
            fixes.append(
                {
                    "id": f"fix-{item['line']}-undefined-{name}",
                    "title": f"Define `{name}` before it is read",
                    "description": "Initialize the missing symbol or replace it with the correct in-scope name.",
                    "kind": "smart-fix",
                    "confidence": 0.93,
                    "patch": f"Insert an assignment immediately before line {item['line']}, for example `{name} = ...`, or replace `{name}` with the intended declared variable.",
                    "rationale": "Undefined symbol failures are usually fast to correct and often reveal the true bug location.",
                    "candidateSource": candidate,
                }
            )
        elif title == "Unused equality comparison":
            candidate = _replace_line(source, item["line"], line_text.replace("==", "="))
            fixes.append(
                {
                    "id": f"fix-{item['line']}-comparison",
                    "title": "Turn the stray comparison into real logic",
                    "description": "Use assignment if you meant to store a value, or move the comparison into control flow if it is a condition.",
                    "kind": "smart-fix",
                    "confidence": 0.9,
                    "patch": f"Rewrite line {item['line']} from `{line_text.strip()}` into an assignment or an `if` condition with an explicit branch.",
                    "rationale": "A bare comparison has no effect and is almost always accidental.",
                    "candidateSource": candidate,
                }
            )
        elif title == "Unused arithmetic expression":
            candidate = _delete_line(source, item["line"])
            fixes.append(
                {
                    "id": f"fix-{item['line']}-arithmetic",
                    "title": "Capture or remove the discarded calculation",
                    "description": "Store the result of the arithmetic expression if it matters; otherwise remove the dead line.",
                    "kind": "smart-fix",
                    "confidence": 0.89,
                    "patch": f"Replace line {item['line']} with an assignment such as `result = {line_text.strip()}` or delete it if it was accidental.",
                    "rationale": "Discarded arithmetic often points to the exact line where intent and implementation diverged.",
                    "candidateSource": candidate,
                }
            )
        elif title == "Division by zero":
            fixes.append(
                {
                    "id": f"fix-{item['line']}-divide-zero",
                    "title": "Guard the denominator",
                    "description": "Prevent the expression from dividing by zero on this path.",
                    "kind": "smart-fix",
                    "confidence": 0.95,
                    "patch": f"Replace the zero denominator on line {item['line']} or add a guard before evaluating `{line_text.strip()}`.",
                    "rationale": "A literal zero denominator is a deterministic runtime failure.",
                    "candidateSource": None,
                }
            )
        elif title == "Dynamic execution risk":
            fixes.append(
                {
                    "id": f"fix-{item['line']}-eval",
                    "title": "Replace dynamic execution with explicit dispatch",
                    "description": "Use known handlers or a parser instead of runtime code evaluation.",
                    "kind": "optimized-refactor",
                    "confidence": 0.86,
                    "patch": "Introduce a switch, map of commands, or dedicated parser so only known operations can run.",
                    "rationale": "Eliminating dynamic code paths improves security and makes failures easier to reason about.",
                    "candidateSource": None,
                }
            )
        elif title == "Missing class declaration":
            fixes.append(
                {
                    "id": "fix-java-class-wrapper",
                    "title": "Wrap the snippet in an executable class",
                    "description": "Turn the snippet into a valid Java program entry point.",
                    "kind": "quick-fix",
                    "confidence": 0.92,
                    "patch": "Create `public class Main { public static void main(String[] args) { ... } }` and move the statements into `main`.",
                    "rationale": "Java requires a class-based structure before execution can succeed.",
                    "candidateSource": None,
                }
            )
        elif item["category"] == "syntax":
            fixes.append(
                {
                    "id": f"fix-{item['line']}-syntax",
                    "title": "Repair parse-breaking syntax",
                    "description": "Correct the malformed token, delimiter, or structure that prevents parsing or compilation.",
                    "kind": "quick-fix",
                    "confidence": 0.8,
                    "patch": f"Inspect line {item['line']} and the nearby block structure for missing delimiters, bad indentation, or extra braces.",
                    "rationale": "Syntax issues must be fixed before deeper analysis becomes reliable.",
                    "candidateSource": None,
                }
            )

    if "while true" in source.lower() or "while(True)" in source or "while (true)" in source:
        fixes.append(
            {
                "id": "fix-loop-guard",
                "title": "Add a loop termination guard",
                "description": "Protect the loop with a clear exit condition and timeout strategy.",
                "kind": "optimized-refactor",
                "confidence": 0.74,
                "patch": "Introduce a bounded retry counter, cancellation token, or explicit break condition.",
                "rationale": "Infinite loops are a common source of incidents and hanging local runs.",
                "candidateSource": None,
            }
        )

    deduped: list[dict] = []
    seen_ids: set[str] = set()
    for fix in fixes:
        if fix["id"] in seen_ids:
            continue
        seen_ids.add(fix["id"])
        deduped.append(fix)
    return deduped


def generate_test_cases(language: str, source: str) -> list[dict]:
    if language != "python":
        return []

    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []

    first_function = next((node for node in tree.body if isinstance(node, ast.FunctionDef)), None)
    if not first_function:
        return []

    function_name = first_function.name
    parameter_names = [argument.arg for argument in first_function.args.args]
    args_empty = ", ".join("[]" if "item" in name or "list" in name else "0" for name in parameter_names)
    args_smoke = ", ".join("[1, 2, 3]" if "item" in name or "list" in name else "3" for name in parameter_names)
    args_edge = ", ".join("[-1, 0, 1]" if "item" in name or "list" in name else "-1" for name in parameter_names)

    return [
        {
            "id": f"{function_name}-empty",
            "title": "Empty input smoke test",
            "description": "Checks that the function handles empty-style inputs without crashing.",
            "code": (
                f"def test_{function_name}_empty():\n"
                f"    result = {function_name}({args_empty})\n"
                f"    assert result is not None\n"
            ),
        },
        {
            "id": f"{function_name}-standard",
            "title": "Typical input smoke test",
            "description": "Exercises a common happy path with representative values.",
            "code": (
                f"def test_{function_name}_standard():\n"
                f"    result = {function_name}({args_smoke})\n"
                f"    assert result is not None\n"
            ),
        },
        {
            "id": f"{function_name}-edge",
            "title": "Edge value smoke test",
            "description": "Uses negative or boundary-like values to surface brittle logic.",
            "code": (
                f"def test_{function_name}_edge():\n"
                f"    result = {function_name}({args_edge})\n"
                f"    assert result is not None\n"
            ),
        },
    ]


def build_heatmap(diagnostics: list[dict], source: str) -> list[dict]:
    counts = Counter(item["line"] for item in diagnostics)
    lines = source.splitlines() or [""]
    heatmap: list[dict] = []
    for line_number in range(1, len(lines) + 1):
        error_count = counts.get(line_number, 0)
        if error_count == 0 and random.random() > 0.12:
            continue
        risk_score = round(min(1.0, error_count * 0.35 + len(lines[line_number - 1]) / 240), 2)
        heatmap.append({"line": line_number, "errorCount": error_count, "riskScore": risk_score})
    return heatmap


def learning_insights(diagnostics: list[dict]) -> list[dict]:
    categories = Counter(item["category"] for item in diagnostics)
    recommendations = {
        "syntax": "Work in smaller edits and re-run checks after each structural change.",
        "logic": "Turn suspicious expressions into explicit assignments or conditions before moving on.",
        "runtime": "Focus on variable initialization and failure guards before executing again.",
        "performance": "Reserve performance work for verified hot paths and keep loops intention-revealing.",
        "style": "Keep only intentional output and replace temporary debugging noise with purposeful logging.",
    }
    insights: list[dict] = []
    for category, count in categories.most_common(3):
        insights.append(
            {
                "weakness": f"{category} issues repeated {count} time(s)",
                "trend": "worsening" if count >= 3 else "steady",
                "recommendation": recommendations[category],
            }
        )
    return insights or [
        {
            "weakness": "No dominant issue pattern yet",
            "trend": "improving",
            "recommendation": "Keep the current workflow and validate behavior with small runtime checks as you edit.",
        }
    ]


def code_quality_score(diagnostics: list[dict]) -> int:
    penalty = 0
    for item in diagnostics:
        penalty += {
            "critical": 22,
            "error": 14,
            "warning": 7,
            "info": 3,
        }[item["severity"]]
    return max(0, 100 - penalty)
