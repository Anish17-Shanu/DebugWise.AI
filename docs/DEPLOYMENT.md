# Deployment Guide

## Recommended target

The simplest production deployment is a Linux VM with Docker Engine, Docker Compose, and a locally reachable Ollama instance. DebugWise.AI is then deployed as:

1. `analysis` service
2. `gateway` service
3. `web` service
4. `proxy` service

For local development, the gateway can fall back to native runtimes when Docker is unavailable. Production should still prefer Docker or another isolated execution layer.

## Production Docker deployment

1. Copy the production env:

```bash
cp infra/docker/.env.prod.example infra/docker/.env.prod
```

2. Review these values:

- `DEBUGWISE_OLLAMA_URL`
- `DEBUGWISE_HTTP_PORT`
- image tags if you publish images externally

3. Deploy:

```bash
bash scripts/deploy-prod.sh
```

Windows operators can use:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-prod.ps1
```

## TLS

The bundled proxy serves plain HTTP on port `80`. For public internet deployment, terminate TLS in one of these ways:

- Replace the Nginx proxy with Caddy/Traefik and automatic certificates.
- Put the VM behind a cloud load balancer that handles TLS.
- Add certbot-managed certificates to the Nginx layer.

## Kubernetes

Kubernetes manifests are included under `infra/k8s/`. They assume:

- an NGINX ingress controller is installed
- an Ollama service is reachable in-cluster or over private networking
- images are available in your registry

## CI/CD

- `ci.yml` verifies builds and analysis tests.
- `docker-images.yml` publishes tagged images to GHCR.

## Post-deploy checks

1. `curl http://<host>/health`
2. Confirm `sandbox.mode` is `docker` for internet-facing deployments.
3. Load the web IDE in a browser.
4. Confirm Ollama-backed assistant responses are streaming.
5. Run a sample analysis against `/api/analyze`.
