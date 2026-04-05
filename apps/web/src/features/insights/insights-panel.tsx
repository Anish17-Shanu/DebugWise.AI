import { useDebugwiseStore } from "../../store/debugwise-store";

export function InsightsPanel() {
  const analysis = useDebugwiseStore((state) => state.analysis);

  return (
    <section className="panel insights-grid insights-grid-three">
      <article className="tile hero-metric">
        <p className="eyebrow">Quality score</p>
        <h2>{analysis?.codeQualityScore ?? "--"}</h2>
        <p>{analysis?.summary ?? "Run an analysis to see system guidance and score trends."}</p>
      </article>
      <article className="tile">
        <p className="eyebrow">Error heatmap</p>
        <div className="heatmap">
          {(analysis?.heatmap ?? []).map((cell) => (
            <div className="heatmap-row" key={cell.line}>
              <span>L{cell.line}</span>
              <div className="heatmap-bar">
                <div className="heatmap-fill" style={{ width: `${Math.max(8, cell.riskScore * 100)}%` }} />
              </div>
              <strong>{cell.errorCount}</strong>
            </div>
          ))}
        </div>
      </article>
      <article className="tile">
        <p className="eyebrow">Learning mode</p>
        <div className="stack tight">
          {(analysis?.learningInsights ?? []).map((item, index) => (
            <div key={`${item.weakness}-${index}`}>
              <h3>{item.weakness}</h3>
              <p className="muted">{item.trend}</p>
              <p>{item.recommendation}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
