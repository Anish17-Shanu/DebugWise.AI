from typing import Literal
from pydantic import BaseModel


class AnalysisRequest(BaseModel):
    documentId: str
    sessionId: str
    language: str
    source: str
    cursorOffset: int | None = None


class FixSuggestion(BaseModel):
    id: str
    title: str
    description: str
    kind: Literal["quick-fix", "smart-fix", "optimized-refactor"]
    confidence: float
    patch: str
    rationale: str
    candidateSource: str | None = None


class SuggestedTestCase(BaseModel):
    id: str
    title: str
    description: str
    code: str


class DiagnosticInsight(BaseModel):
    id: str
    line: int
    column: int
    severity: Literal["info", "warning", "error", "critical"]
    category: Literal["syntax", "logic", "runtime", "performance", "style"]
    title: str
    message: str
    whyItMatters: str
    suggestedAction: str


class HeatmapCell(BaseModel):
    line: int
    errorCount: int
    riskScore: float


class LearningInsight(BaseModel):
    weakness: str
    trend: Literal["improving", "steady", "worsening"]
    recommendation: str


class ExternalReference(BaseModel):
    title: str
    source: Literal["stackexchange", "github"]
    url: str
    summary: str


class AnalysisResponse(BaseModel):
    requestId: str
    codeQualityScore: int
    diagnostics: list[DiagnosticInsight]
    fixes: list[FixSuggestion]
    testCases: list[SuggestedTestCase]
    heatmap: list[HeatmapCell]
    learningInsights: list[LearningInsight]
    externalReferences: list[ExternalReference]
    summary: str


class ChatRequest(BaseModel):
    sessionId: str
    documentId: str
    language: str
    source: str
    prompt: str
