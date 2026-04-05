import { useEffect, useRef } from "react";
import type { AnalysisRequest, ChatRequest } from "@debugwise/contracts";
import { connectSocket } from "./lib/socket";
import { analyzeDocument, executeDocument, fetchReplay, streamAssistantReply } from "./lib/api";
import { useDebugwiseStore } from "./store/debugwise-store";
import { EditorPane } from "./features/editor/editor-pane";
import { DiagnosticsPanel } from "./components/diagnostics-panel";
import { FixesPanel } from "./features/fixes/fixes-panel";
import { AssistantPanel } from "./features/assistant/assistant-panel";
import { InsightsPanel } from "./features/insights/insights-panel";
import { ExecutionPanel } from "./components/execution-panel";
import { ReferencesPanel } from "./components/references-panel";
import { FileExplorer } from "./components/file-explorer";
import { FixPreviewPanel } from "./components/fix-preview-panel";

function App() {
  const socketRef = useRef<WebSocket | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const sessionId = useDebugwiseStore((state) => state.sessionId);
  const documentId = useDebugwiseStore((state) => state.documentId);
  const language = useDebugwiseStore((state) => state.language);
  const source = useDebugwiseStore((state) => state.source);
  const mode = useDebugwiseStore((state) => state.mode);
  const backendStatus = useDebugwiseStore((state) => state.backendStatus);
  const isAnalyzing = useDebugwiseStore((state) => state.isAnalyzing);
  const setSource = useDebugwiseStore((state) => state.setSource);
  const setAnalysis = useDebugwiseStore((state) => state.setAnalysis);
  const setAnalysisError = useDebugwiseStore((state) => state.setAnalysisError);
  const setBackendStatus = useDebugwiseStore((state) => state.setBackendStatus);
  const setAnalyzing = useDebugwiseStore((state) => state.setAnalyzing);
  const setReplay = useDebugwiseStore((state) => state.setReplay);
  const setAssistantError = useDebugwiseStore((state) => state.setAssistantError);
  const appendAssistantDelta = useDebugwiseStore((state) => state.appendAssistantDelta);
  const appendChatMessage = useDebugwiseStore((state) => state.appendChatMessage);
  const setExecuting = useDebugwiseStore((state) => state.setExecuting);
  const setExecution = useDebugwiseStore((state) => state.setExecution);
  const setExecutionError = useDebugwiseStore((state) => state.setExecutionError);
  const setMode = useDebugwiseStore((state) => state.setMode);

  useEffect(() => {
    let disposed = false;
    const socket = connectSocket((message) => {
      if (disposed) {
        return;
      }
      const event = message as { event: string; payload: any };
      if (event.event === "analysis:result") {
        setAnalysis(event.payload);
        setAnalysisError(undefined);
        setBackendStatus("connected");
        setAnalyzing(false);
        void fetchReplay(documentId).then((replay) => {
          if (disposed) {
            return;
          }
          setReplay((replay as { frames?: unknown[] }).frames ?? []);
        });
      }

      if (event.event === "chat:chunk") {
        setAssistantError(undefined);
        setBackendStatus("connected");
        appendAssistantDelta(event.payload.delta);
      }
    });
    socket.onopen = () => {
      if (!disposed) {
        setBackendStatus("connected");
      }
    };
    socket.onerror = () => {
      if (!disposed) {
        setBackendStatus("degraded");
      }
    };
    socket.onclose = () => {
      if (!disposed) {
        setBackendStatus("degraded");
      }
    };
    socketRef.current = socket;
    return () => {
      disposed = true;
      socket.close();
    };
  }, [appendAssistantDelta, documentId, setAnalysis, setAnalysisError, setAnalyzing, setAssistantError, setBackendStatus, setReplay]);

  function requestAnalysis(source: string) {
    setSource(source);
    setAnalyzing(true);
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const payload: AnalysisRequest = {
        documentId,
        sessionId,
        language,
        source,
      };
      try {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ event: "analysis:request", payload }));
          return;
        }

        const result = await analyzeDocument(payload);
        setAnalysis(result);
        setAnalysisError(undefined);
        setBackendStatus("connected");
        setAnalyzing(false);
      } catch (error) {
        setAnalysis(undefined);
        setAnalysisError(error instanceof Error ? error.message : "Unable to analyze the current document.");
        setBackendStatus("degraded");
        setAnalyzing(false);
      }
    }, 325);
  }

  async function askAssistant(prompt: string) {
    appendChatMessage({ role: "user", content: prompt });
    appendChatMessage({ role: "assistant", content: "" });
    const payload: ChatRequest = {
      sessionId,
      documentId,
      language,
      source,
      prompt: `[${mode} mode] ${prompt}`,
    };
    try {
      await streamAssistantReply(payload, (delta) => {
        setAssistantError(undefined);
        setBackendStatus("connected");
        appendAssistantDelta(delta);
      });
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : "Assistant request failed.");
      setBackendStatus("degraded");
      appendAssistantDelta("I could not reach the assistant pipeline. Check the gateway and analysis services, then try again.");
    }
  }

  async function runCurrentDocument() {
    setExecuting(true);
    try {
      const result = await executeDocument(language, source);
      setExecution(result);
      setExecutionError(undefined);
      setBackendStatus("connected");
    } catch (error) {
      setExecution(undefined);
      setExecutionError(error instanceof Error ? error.message : "Execution failed.");
      setBackendStatus("degraded");
    } finally {
      setExecuting(false);
    }
  }

  useEffect(() => {
    requestAnalysis(source);
    // Run once on load with the bootstrapped sample.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    requestAnalysis(source);
    // Trigger a fresh analysis when the user switches languages/templates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">DebugWise.AI</p>
          <h1>Offline-first autonomous debugging platform</h1>
        </div>
        <div className="topbar-stats">
          <select className="language-select" value={mode} onChange={(event) => setMode(event.target.value as "beginner" | "expert")}>
            <option value="beginner">Beginner mode</option>
            <option value="expert">Expert mode</option>
          </select>
          <span className="badge">Web IDE</span>
          <span className={`status ${backendStatus === "degraded" ? "degraded" : isAnalyzing ? "busy" : "ready"}`}>
            {backendStatus === "degraded" ? "Backend degraded" : isAnalyzing ? "Analyzing..." : "Live"}
          </span>
        </div>
      </header>

      <section className="workspace-grid">
        <FileExplorer />
        <EditorPane onSourceChange={requestAnalysis} onRun={runCurrentDocument} />
        <AssistantPanel onAsk={askAssistant} />
        <DiagnosticsPanel />
        <FixesPanel />
      </section>

      <FixPreviewPanel />
      <ExecutionPanel />
      <ReferencesPanel />
      <InsightsPanel />
    </main>
  );
}

export default App;
