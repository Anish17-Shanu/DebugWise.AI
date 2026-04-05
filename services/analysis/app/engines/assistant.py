from ..models.contracts import AnalysisResponse, ChatRequest


def _top(items: list, count: int = 3):
    return items[:count]


def build_grounded_reply(payload: ChatRequest, analysis: AnalysisResponse) -> str:
    diagnostics = _top(analysis.diagnostics, 3)
    fixes = _top(analysis.fixes, 3)
    learning = analysis.learningInsights[0] if analysis.learningInsights else None

    lines: list[str] = []
    lines.append(f"DebugWise analysis for {payload.language}:")
    lines.append(analysis.summary)
    lines.append("")

    if diagnostics:
        lines.append("What is failing:")
        for item in diagnostics:
            lines.append(f"- Line {item.line}: {item.title}. {item.message}")
    else:
        lines.append("What is failing:")
        lines.append("- No deterministic issues were detected in the current snippet.")

    lines.append("")
    lines.append("Most likely root cause:")
    if diagnostics:
        primary = diagnostics[0]
        lines.append(f"- {primary.whyItMatters}")
    else:
        lines.append("- The issue may depend on runtime context, inputs, or missing project files.")

    lines.append("")
    lines.append("What to change next:")
    if fixes:
        for fix in fixes:
            lines.append(f"- {fix.title}: {fix.patch}")
    else:
        lines.append("- Run the code path with representative inputs and inspect the first failing branch.")

    if learning:
        lines.append("")
        lines.append("Better engineering habit:")
        lines.append(f"- {learning.recommendation}")

    if analysis.externalReferences:
        lines.append("")
        lines.append("Relevant references:")
        for reference in _top(analysis.externalReferences, 2):
            lines.append(f"- {reference.source}: {reference.title} ({reference.url})")

    lines.append("")
    lines.append("Production-trust note:")
    lines.append("- Trust the deterministic findings first, then use the model for deeper explanation once the immediate failure is fixed.")

    return "\n".join(lines)
