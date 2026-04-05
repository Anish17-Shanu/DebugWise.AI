import { useDebugwiseStore } from "../store/debugwise-store";

function diffLines(before: string, after: string): Array<{ kind: "same" | "removed" | "added"; text: string }> {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const max = Math.max(beforeLines.length, afterLines.length);
  const rows: Array<{ kind: "same" | "removed" | "added"; text: string }> = [];

  for (let index = 0; index < max; index += 1) {
    const original = beforeLines[index];
    const updated = afterLines[index];

    if (original === updated && original !== undefined) {
      rows.push({ kind: "same", text: `  ${original}` });
      continue;
    }

    if (original !== undefined) {
      rows.push({ kind: "removed", text: `- ${original}` });
    }

    if (updated !== undefined) {
      rows.push({ kind: "added", text: `+ ${updated}` });
    }
  }

  return rows;
}

export function FixPreviewPanel() {
  const source = useDebugwiseStore((state) => state.source);
  const fixPreviewSource = useDebugwiseStore((state) => state.fixPreviewSource);
  const clearFixPreview = useDebugwiseStore((state) => state.clearFixPreview);
  const applyFixPreview = useDebugwiseStore((state) => state.applyFixPreview);

  if (!fixPreviewSource) {
    return null;
  }

  const rows = diffLines(source, fixPreviewSource);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Diff view</p>
          <h2>Fix preview</h2>
        </div>
        <div className="editor-controls">
          <button className="secondary-button" type="button" onClick={clearFixPreview}>
            Close
          </button>
          <button className="run-button" type="button" onClick={applyFixPreview}>
            Apply fix
          </button>
        </div>
      </div>
      <div className="diff-view">
        {rows.map((row, index) => (
          <pre className={`diff-row ${row.kind}`} key={`${row.kind}-${index}`}>
            {row.text}
          </pre>
        ))}
      </div>
    </section>
  );
}
