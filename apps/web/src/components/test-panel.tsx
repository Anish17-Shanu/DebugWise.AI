import { useDebugwiseStore } from "../store/debugwise-store";

interface TestPanelProps {
  onRunTests: () => Promise<void>;
}

export function TestPanel({ onRunTests }: TestPanelProps) {
  const analysis = useDebugwiseStore((state) => state.analysis);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Test generation</p>
          <h2>Suggested test cases</h2>
        </div>
        <button className="secondary-button" type="button" onClick={() => void onRunTests()} disabled={!analysis?.testCases.length}>
          Run tests
        </button>
      </div>
      <div className="stack">
        {analysis?.testCases.length ? (
          analysis.testCases.map((testCase) => (
            <article className="tile" key={testCase.id}>
              <h3>{testCase.title}</h3>
              <p>{testCase.description}</p>
              <pre>{testCase.code}</pre>
            </article>
          ))
        ) : (
          <article className="empty-state">No test suggestions yet. Define a Python function to generate runnable smoke tests.</article>
        )}
      </div>
    </section>
  );
}
