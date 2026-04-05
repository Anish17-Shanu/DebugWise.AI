import { create } from "zustand";
import type { AnalysisResponse, ExecutionResult } from "@debugwise/contracts";

export const starterSources: Record<string, string> = {
  typescript: [
    "function sum(items: number[]) {",
    "  console.log('debug');",
    "  return items.reduce((acc, value) => acc + value, 0);",
    "}",
    "",
    "console.log(sum([1, 2, 3]));",
  ].join("\n"),
  javascript: [
    "function sum(items) {",
    "  console.log('debug');",
    "  return items.reduce((acc, value) => acc + value, 0);",
    "}",
    "",
    "console.log(sum([1, 2, 3]));",
  ].join("\n"),
  python: [
    "def sum_items(items):",
    "    total = sum(items)",
    "    return total",
    "",
    "print(sum_items([1, 2, 3]))",
  ].join("\n"),
  java: [
    "public class Main {",
    "    public static void main(String[] args) {",
    "        int a = 10;",
    "        int b = a - 3;",
    "        System.out.println(a + b);",
    "    }",
    "}",
  ].join("\n"),
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface WorkspaceFile {
  id: string;
  name: string;
  language: string;
  source: string;
}

export const starterFiles: WorkspaceFile[] = [
  {
    id: "playground-py",
    name: "playground.py",
    language: "python",
    source: starterSources.python,
  },
  {
    id: "runtime-bug.py",
    name: "runtime-bug.py",
    language: "python",
    source: ["a = 10", "b-10", "print(a, b)"].join("\n"),
  },
  {
    id: "edge-cases.py",
    name: "edge-cases.py",
    language: "python",
    source: [
      "def divide(a, b):",
      "    return a / b",
      "",
      "print(divide(6, 0))",
    ].join("\n"),
  },
];

interface State {
  sessionId: string;
  documentId: string;
  language: string;
  source: string;
  mode: "beginner" | "expert";
  files: WorkspaceFile[];
  selectedFixId?: string;
  fixPreviewSource?: string;
  backendStatus: "unknown" | "connected" | "degraded";
  isAnalyzing: boolean;
  isExecuting: boolean;
  analysis?: AnalysisResponse;
  analysisError?: string;
  assistantError?: string;
  executionError?: string;
  replay: unknown[];
  chat: ChatMessage[];
  execution?: ExecutionResult;
  setSource: (source: string) => void;
  setLanguage: (language: string) => void;
  setMode: (mode: State["mode"]) => void;
  openFile: (fileId: string) => void;
  setBackendStatus: (status: State["backendStatus"]) => void;
  setAnalysis: (analysis: AnalysisResponse | undefined) => void;
  setAnalysisError: (message?: string) => void;
  setAnalyzing: (value: boolean) => void;
  setExecuting: (value: boolean) => void;
  setExecution: (execution: ExecutionResult | undefined) => void;
  setExecutionError: (message?: string) => void;
  setAssistantError: (message?: string) => void;
  previewFix: (fixId: string, candidateSource?: string) => void;
  clearFixPreview: () => void;
  applyFixPreview: () => void;
  appendChatMessage: (message: ChatMessage) => void;
  appendAssistantDelta: (delta: string) => void;
  setReplay: (frames: unknown[]) => void;
}

export const useDebugwiseStore = create<State>((set) => ({
  sessionId: "local-web-session",
  documentId: "playground.py",
  language: "python",
  source: starterSources.python,
  mode: "beginner",
  files: starterFiles,
  backendStatus: "unknown",
  isAnalyzing: false,
  isExecuting: false,
  replay: [],
  chat: [
    {
      role: "assistant",
      content: "DebugWise.AI is ready. I can debug Python, JavaScript, TypeScript, and Java with local execution, targeted remediations, and optional online research enrichment.",
    },
  ],
  setSource: (source) =>
    set((state) => ({
      source,
      files: state.files.map((file) => (file.name === state.documentId ? { ...file, source } : file)),
    })),
  setLanguage: (language) =>
    set(() => ({
      language,
      documentId: `playground.${language === "python" ? "py" : language === "javascript" ? "js" : language === "java" ? "java" : "ts"}`,
      source: starterSources[language] ?? starterSources.typescript,
      analysis: undefined,
      analysisError: undefined,
      execution: undefined,
      executionError: undefined,
      fixPreviewSource: undefined,
      selectedFixId: undefined,
    })),
  setMode: (mode) => set({ mode }),
  openFile: (fileId) =>
    set((state) => {
      const file = state.files.find((item) => item.id === fileId);
      if (!file) {
        return state;
      }
      return {
        documentId: file.name,
        language: file.language,
        source: file.source,
        analysis: undefined,
        analysisError: undefined,
        execution: undefined,
        executionError: undefined,
        fixPreviewSource: undefined,
        selectedFixId: undefined,
      };
    }),
  setBackendStatus: (backendStatus) => set({ backendStatus }),
  setAnalysis: (analysis) => set({ analysis }),
  setAnalysisError: (analysisError) => set({ analysisError }),
  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setExecuting: (isExecuting) => set({ isExecuting }),
  setExecution: (execution) => set({ execution }),
  setExecutionError: (executionError) => set({ executionError }),
  setAssistantError: (assistantError) => set({ assistantError }),
  previewFix: (selectedFixId, candidateSource) => set({ selectedFixId, fixPreviewSource: candidateSource }),
  clearFixPreview: () => set({ selectedFixId: undefined, fixPreviewSource: undefined }),
  applyFixPreview: () =>
    set((state) => {
      if (!state.fixPreviewSource) {
        return state;
      }
      return {
        source: state.fixPreviewSource,
        selectedFixId: undefined,
        fixPreviewSource: undefined,
        files: state.files.map((file) =>
          file.name === state.documentId ? { ...file, source: state.fixPreviewSource as string } : file,
        ),
      };
    }),
  appendChatMessage: (message) => set((state) => ({ chat: [...state.chat, message] })),
  appendAssistantDelta: (delta) =>
    set((state) => {
      const chat = [...state.chat];
      const last = chat[chat.length - 1];
      if (!last || last.role !== "assistant") {
        chat.push({ role: "assistant", content: delta });
      } else {
        last.content += delta;
      }
      return { chat };
    }),
  setReplay: (replay) => set({ replay }),
}));
