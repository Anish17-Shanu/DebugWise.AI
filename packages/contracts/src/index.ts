export type Severity = "info" | "warning" | "error" | "critical";
export type FixKind = "quick-fix" | "smart-fix" | "optimized-refactor";

export interface AnalysisRequest {
  documentId: string;
  sessionId: string;
  language: string;
  source: string;
  cursorOffset?: number;
}

export interface FixSuggestion {
  id: string;
  title: string;
  description: string;
  kind: FixKind;
  confidence: number;
  patch: string;
  rationale: string;
  candidateSource?: string;
}

export interface SuggestedTestCase {
  id: string;
  title: string;
  description: string;
  code: string;
}

export interface DiagnosticInsight {
  id: string;
  line: number;
  column: number;
  severity: Severity;
  category: "syntax" | "logic" | "runtime" | "performance" | "style";
  title: string;
  message: string;
  whyItMatters: string;
  suggestedAction: string;
}

export interface HeatmapCell {
  line: number;
  errorCount: number;
  riskScore: number;
}

export interface LearningInsight {
  weakness: string;
  trend: "improving" | "steady" | "worsening";
  recommendation: string;
}

export interface ExternalReference {
  title: string;
  source: "stackexchange" | "github";
  url: string;
  summary: string;
}

export interface AnalysisResponse {
  requestId: string;
  codeQualityScore: number;
  diagnostics: DiagnosticInsight[];
  fixes: FixSuggestion[];
  testCases: SuggestedTestCase[];
  heatmap: HeatmapCell[];
  learningInsights: LearningInsight[];
  externalReferences: ExternalReference[];
  summary: string;
}

export interface ChatRequest {
  sessionId: string;
  documentId: string;
  language: string;
  source: string;
  prompt: string;
}

export interface ChatChunk {
  requestId: string;
  delta: string;
  done?: boolean;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  command: string[];
}
