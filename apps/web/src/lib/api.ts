import type { AnalysisRequest, AnalysisResponse, ExecutionResult } from "@debugwise/contracts";

function resolveGatewayUrl(): string {
  const configured = import.meta.env.VITE_DEBUGWISE_GATEWAY_URL;
  if (configured) {
    if (configured.startsWith("/")) {
      return `${window.location.origin}${configured}`;
    }
    return configured;
  }
  return import.meta.env.DEV ? "http://localhost:4000/api" : `${window.location.origin}/api`;
}

const gatewayUrl = resolveGatewayUrl();

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (response.ok) {
    return response.json() as Promise<T>;
  }

  let detail = "";
  try {
    const payload = (await response.json()) as { error?: string };
    detail = payload.error ? ` ${payload.error}` : "";
  } catch {
    detail = "";
  }

  throw new Error(`${fallbackMessage} (${response.status}).${detail}`.trim());
}

export async function analyzeDocument(payload: AnalysisRequest): Promise<AnalysisResponse> {
  const response = await fetch(`${gatewayUrl}/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  return readJson<AnalysisResponse>(response, "Analysis request failed");
}

export async function fetchReplay(documentId: string): Promise<unknown> {
  const response = await fetch(`${gatewayUrl}/replay/${encodeURIComponent(documentId)}`);
  return response.json();
}

export async function executeDocument(language: string, source: string): Promise<ExecutionResult> {
  const response = await fetch(`${gatewayUrl}/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ language, source }),
  });
  return readJson<ExecutionResult>(response, "Execution request failed");
}

export async function streamAssistantReply(body: object, onDelta: (delta: string) => void): Promise<void> {
  const response = await fetch(`${gatewayUrl}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Chat failed with ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      return;
    }

    buffer += decoder.decode(chunk.value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const line = event
        .split("\n")
        .find((entry) => entry.startsWith("data: "));
      if (!line) {
        continue;
      }

      const payload = JSON.parse(line.slice(6)) as { delta?: string };
      if (payload.delta) {
        onDelta(payload.delta);
      }
    }
  }
}
