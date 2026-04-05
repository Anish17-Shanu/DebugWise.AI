import { useDebugwiseStore } from "../store/debugwise-store";

export function ExecutionPanel() {
  const execution = useDebugwiseStore((state) => state.execution);
  const language = useDebugwiseStore((state) => state.language);
  const executionError = useDebugwiseStore((state) => state.executionError);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Execution sandbox</p>
          <h2>Runtime output</h2>
        </div>
        <span className="badge">{language}</span>
      </div>
      {executionError ? (
        <article className="alert-banner error">{executionError}</article>
      ) : execution ? (
        <div className="stack">
          <article className="tile">
            <div className="tile-title-row">
              <h3>Stdout</h3>
              <span className="confidence">{execution.exitCode ?? "n/a"}</span>
            </div>
            <pre>{execution.stdout || "No stdout produced."}</pre>
          </article>
          <article className="tile">
            <h3>Stderr</h3>
            <pre>{execution.stderr || "No stderr."}</pre>
          </article>
          <article className="tile">
            <h3>Execution summary</h3>
            <p>{execution.timedOut ? "Execution timed out." : "Execution completed."}</p>
            <p className="muted">Command: {execution.command.join(" ")}</p>
          </article>
        </div>
      ) : (
        <article className="empty-state">
          Run the current file in the local sandbox to inspect actual stdout, stderr, exit code, and timeout behavior.
        </article>
      )}
    </section>
  );
}
