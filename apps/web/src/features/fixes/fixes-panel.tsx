import { useDebugwiseStore } from "../../store/debugwise-store";

export function FixesPanel() {
  const analysis = useDebugwiseStore((state) => state.analysis);
  const analysisError = useDebugwiseStore((state) => state.analysisError);
  const previewFix = useDebugwiseStore((state) => state.previewFix);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Self-healing fixes</p>
          <h2>Suggested remediations</h2>
        </div>
      </div>
      <div className="stack">
        {analysisError ? (
          <article className="empty-state">Fixes are unavailable until the analyzer reconnects.</article>
        ) : analysis?.fixes.length ? (
          analysis.fixes.map((fix) => (
            <article className="tile" key={fix.id}>
              <div className="tile-title-row">
                <h3>{fix.title}</h3>
                <span className="confidence">{Math.round(fix.confidence * 100)}%</span>
              </div>
              <p className="muted">{fix.kind}</p>
              <p>{fix.description}</p>
              <p><strong>Recommended change:</strong> {fix.patch}</p>
              <p className="muted">{fix.rationale}</p>
              <div className="inline-actions">
                <button className="secondary-button" type="button" onClick={() => previewFix(fix.id, fix.candidateSource)}>
                  Preview diff
                </button>
              </div>
            </article>
          ))
        ) : (
          <article className="empty-state">No remediations needed right now.</article>
        )}
      </div>
    </section>
  );
}
