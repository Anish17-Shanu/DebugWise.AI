import Editor from "@monaco-editor/react";
import { useDebugwiseStore } from "../../store/debugwise-store";

interface EditorPaneProps {
  onSourceChange: (source: string) => void;
  onRun: () => Promise<void>;
}

export function EditorPane({ onSourceChange, onRun }: EditorPaneProps) {
  const { source, language, isExecuting, setLanguage } = useDebugwiseStore();

  return (
    <section className="panel editor-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Realtime IDE</p>
          <h2>Autonomous debugging workspace</h2>
        </div>
        <div className="editor-controls">
          <select className="language-select" value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
          <button className="run-button" type="button" onClick={() => void onRun()} disabled={isExecuting}>
            {isExecuting ? "Running..." : "Run Code"}
          </button>
        </div>
      </div>
      <div className="editor-shell">
        <Editor
          height="100%"
          theme="vs-dark"
          language={language}
          value={source}
          onChange={(value) => onSourceChange(value ?? "")}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            smoothScrolling: true,
            automaticLayout: true,
          }}
        />
      </div>
    </section>
  );
}
