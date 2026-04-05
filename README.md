# DebugWise.AI

DebugWise.AI is an offline-first, AI-powered auto-debugging platform built as a modular monorepo. It ships with a React web IDE, a VS Code extension, a Node.js API gateway, and a Python analysis engine designed to run locally first, with optional online research enrichment when explicitly enabled.

Author / Lead Developer: Anish Kumar

The current platform is hybrid by design:

- offline-first local debugging with Ollama and Docker
- optional online research enrichment through public web APIs
- Python, JavaScript, TypeScript, and Java editor/runtime flows

## Monorepo layout

- `apps/web`: React + Monaco + Zustand web IDE.
- `services/gateway`: Node.js API gateway, WebSocket hub, orchestration, sandbox execution bridge.
- `services/analysis`: Python FastAPI service for static analysis, rule engine, AI reasoning, and research enrichment.
- `packages/contracts`: Shared TypeScript contracts used across the web app, gateway, and extension.
- `extensions/vscode`: Offline VS Code extension connected to the local gateway.
- `docs`: API and architecture documentation.
- `sandbox`: Secure execution assets for Docker-based code simulation.

## Local run

### Fresh clone quick start

1. Clone the repo.
2. Install Node.js 22+ and Python 3.12+.
3. Run the environment doctor:
   - `npm run doctor`
4. Bootstrap local dependencies:
   - `npm run bootstrap`
5. Start the product:
   - `npm run start:local`
6. Open `http://localhost:5173`

If Ollama is missing, the assistant still works in deterministic fallback mode.
If Docker is missing, code execution falls back to local runtimes automatically.

### Native mode

1. Install Node.js 22+, Python 3.12+, and optionally Docker and Ollama.
2. Run the bootstrap script:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-local.ps1`
3. Start the native dev stack:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -Mode Native`
4. Open:
   - Web IDE: `http://localhost:5173`
   - Gateway health: `http://localhost:4000/health`
   - Analysis health: `http://localhost:8000/health`

If Docker is not running, DebugWise.AI automatically falls back to local execution for Python, JavaScript, TypeScript, and Java.
If Ollama is not installed or not running, the platform still runs with deterministic diagnostics and fallback assistant behavior. Install Ollama later to enable full local reasoning and model-backed chat.
Bootstrap does not pull large models by default. The default coding model is `deepseek-coder:6.7b`.
To pull the recommended local models after Ollama is installed:
- `powershell -ExecutionPolicy Bypass -File .\scripts\pull-models.ps1`

To bootstrap and pull models in one pass:
- `powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-local.ps1 -PullModels`

### Docker mode

1. Copy env defaults if needed:
   - `Copy-Item .env.example .env`
2. Start the full stack:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1 -Mode Docker`
3. Open:
   - Web IDE: `http://localhost:4173`

### Stop local services

- Native mode: `powershell -ExecutionPolicy Bypass -File .\scripts\stop-local.ps1`
- Docker mode: `docker compose -f infra/docker/docker-compose.local.yml down`

## Platform capabilities

- Real-time diagnostics with syntax, logic, runtime-risk, and language-aware structure checks.
- Hybrid fix engine with quick fixes, smart fixes, and refactor-grade recommendations.
- Offline chat assistant with streaming responses from Ollama or deterministic fallback guidance.
- Execution through Docker isolation when available, with automatic local runtime fallback when Docker is unavailable.
- Learning mode with weakness tracking, repeat-error insights, and coaching prompts.
- Heatmap and replay-oriented telemetry for error hotspots.
- Optional online reference enrichment from public Stack Exchange and GitHub APIs when the issue is non-trivial. It is disabled by default in fresh clones to preserve local-first behavior.

## Deployment

### Docker Compose on a Linux VM

1. Copy the production env template:
   - `cp infra/docker/.env.prod.example infra/docker/.env.prod`
2. Review `infra/docker/.env.prod` and set your Ollama endpoint.
3. Deploy:
   - `bash scripts/deploy-prod.sh`
4. Expose the VM on ports `80` and optionally `443` through your cloud firewall or reverse proxy/TLS layer.

Production compose lives at `infra/docker/docker-compose.prod.yml` and routes browser traffic through `infra/nginx/proxy.conf`.

### Kubernetes

Apply the manifests in order:

1. `kubectl apply -f infra/k8s/namespace.yaml`
2. `kubectl apply -f infra/k8s/configmap.yaml`
3. `kubectl apply -f infra/k8s/analysis.yaml`
4. `kubectl apply -f infra/k8s/gateway.yaml`
5. `kubectl apply -f infra/k8s/web.yaml`
6. `kubectl apply -f infra/k8s/ingress.yaml`

### CI/CD

- `.github/workflows/ci.yml` runs workspace builds and Python tests.
- `.github/workflows/docker-images.yml` builds and publishes container images to GHCR on version tags.

Production notes, deployment setup, API details, and extension usage are documented in `docs/`.
