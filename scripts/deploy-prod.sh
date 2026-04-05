#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infra/docker/docker-compose.prod.yml"
ENV_FILE="$ROOT_DIR/infra/docker/.env.prod"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT_DIR/infra/docker/.env.prod.example" "$ENV_FILE"
  echo "Created $ENV_FILE from template. Review it before exposing the stack publicly."
fi

cd "$ROOT_DIR"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

