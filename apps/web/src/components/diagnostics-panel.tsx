import { useDebugwiseStore } from "../store/debugwise-store";

export function DiagnosticsPanel() {
  const analysis = useDebugwiseStore((state) => state.analysis);
  const isAnalyzing = useDebugwiseStore((state) => state.isAnalyzing);
  const analysisError = useDebugwiseStore((state) => state.analysisError);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Layered analysis</p>
          <h2>Active findings</h2>
        </div>
      </div>
      <div className="stack">
        {analysisError ? (
          <article className="alert-banner error">{analysisError}</article>
        ) : isAnalyzing && !analysis ? (
          <article className="empty-state">Analyzing the current document...</article>
        ) : analysis?.diagnostics.length ? (
          analysis.diagnostics.map((diagnostic) => (
            <article className={`tile diagnostic ${diagnostic.severity}`} key={diagnostic.id}>
              <div className="tile-title-row">
                <h3>{diagnostic.title}</h3>
                <span>{diagnostic.severity}</span>
              </div>
              <p>{diagnostic.message}</p>
              <p className="muted">{diagnostic.whyItMatters}</p>
              <p>{diagnostic.suggestedAction}</p>
              <strong>
                Line {diagnostic.line}, Col {diagnostic.column}
              </strong>
            </article>
          ))
        ) : (
          <article className="empty-state">No findings yet.</article>
        )}
      </div>
    </section>
  );
}
