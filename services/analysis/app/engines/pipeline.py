from uuid import uuid4
from ..models.contracts import AnalysisRequest, AnalysisResponse
from .heuristics import (
    build_heatmap,
    code_quality_score,
    detect_generic_issues,
    generate_test_cases,
    learning_insights,
    suggest_fixes,
)
from ..plugins.registry import registry


def normalize_diagnostics(diagnostics: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    for index, item in enumerate(diagnostics, start=1):
        normalized.append(
            {
                "id": item.get("id", f"diag-{item['category']}-{item['line']}-{index}"),
                **item,
            }
        )
    return normalized


def analyze(payload: AnalysisRequest) -> AnalysisResponse:
    diagnostics = detect_generic_issues(payload.language, payload.source)
    plugin_results = registry.run(payload.language, payload.source)
    diagnostics.extend(plugin_results)
    diagnostics = normalize_diagnostics(diagnostics)

    fixes = suggest_fixes(payload.source, diagnostics)
    test_cases = generate_test_cases(payload.language, payload.source)
    heatmap = build_heatmap(diagnostics, payload.source)
    learning = learning_insights(diagnostics)
    score = code_quality_score(diagnostics)

    summary = (
        f"Detected {len(diagnostics)} issue(s), proposed {len(fixes)} remediation option(s), "
        f"and generated {len(test_cases)} test case(s). Current quality score: {score}/100."
    )

    return AnalysisResponse(
        requestId=str(uuid4()),
        codeQualityScore=score,
        diagnostics=diagnostics,
        fixes=fixes,
        testCases=test_cases,
        heatmap=heatmap,
        learningInsights=learning,
        externalReferences=[],
        summary=summary,
    )
