# Architecture

DebugWise.AI uses a modular offline-first topology:

1. `apps/web` provides the primary browser IDE and visual debugging experience.
2. `extensions/vscode` embeds the same assistant and diagnostics inside VS Code.
3. `services/gateway` exposes REST and WebSocket APIs, coordinates analysis runs, streams assistant output, and brokers sandbox execution.
4. `services/analysis` performs deterministic analysis, AI reasoning, patch generation, test generation, and learning insights.
5. `packages/contracts` keeps cross-service payloads stable.

## Analysis pipeline

1. Source changes enter through WebSocket or REST.
2. The gateway debounces requests per document.
3. The Python analysis service runs layered analyzers:
   - Syntax and structural inspection
   - Rule-based code smell detection
   - Runtime risk heuristics
   - Fix suggestion synthesis
   - Test generation
   - Learning insight extraction
4. Optional AI deep analysis is requested from Ollama for logic bugs or chat follow-ups.
5. Results are cached and streamed back to clients.

## Plugin model

- Gateway plugins can extend transports, auth, telemetry, and execution providers.
- Analysis plugins can register new language analyzers and new model providers.
- Frontend panels consume contracts rather than service-specific DTOs to keep UI additions low-friction.

