import { useDebugwiseStore } from "../store/debugwise-store";

export function ReferencesPanel() {
  const analysis = useDebugwiseStore((state) => state.analysis);
  const references = analysis?.externalReferences ?? [];

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Research mode</p>
          <h2>Online references</h2>
        </div>
      </div>
      <div className="stack">
        {references.length ? (
          references.map((reference) => (
            <article className="tile" key={reference.url}>
              <div className="tile-title-row">
                <h3>{reference.title}</h3>
                <span className="confidence">{reference.source}</span>
              </div>
              <p>{reference.summary}</p>
              <a className="link" href={reference.url} rel="noreferrer" target="_blank">
                Open reference
              </a>
            </article>
          ))
        ) : (
          <article className="empty-state">
            No external references yet. When online research is enabled, DebugWise can enrich findings with public web sources.
          </article>
        )}
      </div>
    </section>
  );
}
