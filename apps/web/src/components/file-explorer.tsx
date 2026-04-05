import { useDebugwiseStore } from "../store/debugwise-store";

export function FileExplorer() {
  const files = useDebugwiseStore((state) => state.files);
  const documentId = useDebugwiseStore((state) => state.documentId);
  const openFile = useDebugwiseStore((state) => state.openFile);

  return (
    <section className="panel explorer-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>File explorer</h2>
        </div>
      </div>
      <div className="stack">
        {files.map((file) => (
          <button
            key={file.id}
            type="button"
            className={`file-item ${file.name === documentId ? "active" : ""}`}
            onClick={() => openFile(file.id)}
          >
            <strong>{file.name}</strong>
            <span>{file.language}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
