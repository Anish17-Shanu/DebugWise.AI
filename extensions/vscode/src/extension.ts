import * as vscode from "vscode";
import type { AnalysisResponse } from "@debugwise/contracts";

const gatewayUrl = "http://localhost:4000";
const diagnosticCollection = vscode.languages.createDiagnosticCollection("debugwise");
const latestAnalysis = new Map<string, AnalysisResponse>();

async function analyzeDocument(document: vscode.TextDocument): Promise<void> {
  if (document.isUntitled || document.languageId === "log") {
    return;
  }

  const response = await fetch(`${gatewayUrl}/api/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      documentId: document.fileName,
      sessionId: "vscode-session",
      language: document.languageId,
      source: document.getText(),
    }),
  });

  if (!response.ok) {
    return;
  }

  const analysis = (await response.json()) as AnalysisResponse;
  latestAnalysis.set(document.uri.toString(), analysis);

  const diagnostics = analysis.diagnostics.map((item) => {
    const range = new vscode.Range(
      Math.max(item.line - 1, 0),
      Math.max(item.column - 1, 0),
      Math.max(item.line - 1, 0),
      Math.max(item.column, 1),
    );
    const diagnostic = new vscode.Diagnostic(range, item.message, toSeverity(item.severity));
    diagnostic.source = "DebugWise.AI";
    diagnostic.code = item.id;
    return diagnostic;
  });

  diagnosticCollection.set(document.uri, diagnostics);
}

function toSeverity(
  severity: "info" | "warning" | "error" | "critical",
): vscode.DiagnosticSeverity {
  switch (severity) {
    case "critical":
    case "error":
      return vscode.DiagnosticSeverity.Error;
    case "warning":
      return vscode.DiagnosticSeverity.Warning;
    default:
      return vscode.DiagnosticSeverity.Information;
  }
}

class DebugwiseCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(document: vscode.TextDocument): vscode.CodeAction[] {
    const analysis = latestAnalysis.get(document.uri.toString());
    if (!analysis) {
      return [];
    }

    return analysis.fixes.map((fix) => {
      const action = new vscode.CodeAction(fix.title, vscode.CodeActionKind.QuickFix);
      action.command = {
        title: fix.title,
        command: "debugwise.openAssistant",
        arguments: [`Suggested fix: ${fix.title}\n\n${fix.patch}`],
      };
      action.isPreferred = fix.kind === "quick-fix";
      return action;
    });
  }
}

function createAssistantPanel(context: vscode.ExtensionContext, initialPrompt = ""): void {
  const panel = vscode.window.createWebviewPanel(
    "debugwiseAssistant",
    "DebugWise Assistant",
    vscode.ViewColumn.Beside,
    { enableScripts: true },
  );

  panel.webview.html = getWebviewHtml(initialPrompt);

  panel.webview.onDidReceiveMessage(async (message) => {
    if (message.type !== "ask") {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    const document = editor?.document;
    const payload = {
      sessionId: "vscode-session",
      documentId: document?.fileName ?? "untitled",
      language: document?.languageId ?? "plaintext",
      source: document?.getText() ?? "",
      prompt: message.prompt,
    };

    const response = await fetch(`${gatewayUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) {
      return;
    }

    let buffer = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        panel.webview.postMessage({ type: "done" });
        break;
      }

      buffer += decoder.decode(chunk.value);
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part
          .split("\n")
          .find((entry) => entry.startsWith("data: "));
        if (!line) {
          continue;
        }

        const payload = JSON.parse(line.replace("data: ", "")) as { delta?: string };
        if (payload.delta) {
          panel.webview.postMessage({ type: "chunk", delta: payload.delta });
        }
      }
    }
  });

  context.subscriptions.push(panel);
}

function getWebviewHtml(initialPrompt: string): string {
  return `
    <!doctype html>
    <html lang="en">
      <body style="font-family:Segoe UI,sans-serif;padding:16px;background:#0f1720;color:#f5efe5;">
        <h2>DebugWise.AI Assistant</h2>
        <p>Offline-first debugging guidance streamed from your local backend.</p>
        <textarea id="prompt" style="width:100%;min-height:120px;">${initialPrompt}</textarea>
        <button id="send" style="margin-top:12px;padding:8px 14px;">Ask</button>
        <pre id="output" style="white-space:pre-wrap;margin-top:16px;background:#151f2c;padding:12px;border-radius:10px;"></pre>
        <script>
          const vscode = acquireVsCodeApi();
          const output = document.getElementById('output');
          document.getElementById('send').addEventListener('click', () => {
            output.textContent = '';
            vscode.postMessage({ type: 'ask', prompt: document.getElementById('prompt').value });
          });
          window.addEventListener('message', (event) => {
            const message = event.data;
            if (message.type === 'chunk') {
              output.textContent += message.delta;
            }
          });
        </script>
      </body>
    </html>
  `;
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(diagnosticCollection);

  const provider = vscode.languages.registerCodeActionsProvider({ scheme: "file" }, new DebugwiseCodeActionProvider());
  context.subscriptions.push(provider);

  let timeout: NodeJS.Timeout | undefined;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        void analyzeDocument(event.document);
      }, 350);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("debugwise.openAssistant", (initialPrompt?: string) => {
      createAssistantPanel(context, typeof initialPrompt === "string" ? initialPrompt : "");
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("debugwise.runAnalysis", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await analyzeDocument(editor.document);
      }
    }),
  );
}

export function deactivate(): void {
  diagnosticCollection.clear();
}
