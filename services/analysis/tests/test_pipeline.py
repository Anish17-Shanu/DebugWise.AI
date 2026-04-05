from services.analysis.app.engines.pipeline import analyze
from services.analysis.app.models.contracts import AnalysisRequest


def test_pipeline_detects_python_logic_and_runtime_risks():
    payload = AnalysisRequest(
        documentId="demo.py",
        sessionId="session-1",
        language="python",
        source="a = 10\nb-10\nprint(a, b)\n",
    )
    response = analyze(payload)

    assert response.codeQualityScore < 100
    assert response.diagnostics
    assert response.fixes
    assert any(item.title == "Undefined variable risk" for item in response.diagnostics)
    assert any(fix.title.startswith("Define `b`") for fix in response.fixes)
    assert response.externalReferences == []


def test_pipeline_detects_java_structure_issue():
    payload = AnalysisRequest(
        documentId="Main.java",
        sessionId="session-2",
        language="java",
        source='System.out.println("debug");',
    )
    response = analyze(payload)

    assert any(item.title == "Missing class declaration" for item in response.diagnostics)
    assert any("class" in fix.patch.lower() for fix in response.fixes)
