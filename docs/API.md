# API Documentation

## Gateway REST

### `GET /health`
Returns service and dependency health.

### `POST /api/analyze`
Request body:

```json
{
  "documentId": "demo.ts",
  "language": "typescript",
  "source": "const total = list.reduce((sum, n) => sum + n);",
  "cursorOffset": 24,
  "sessionId": "local-session"
}
```

### `POST /api/chat`
Streams assistant tokens over Server-Sent Events.

### `POST /api/execute`
Runs sandbox execution requests with timeout and memory limits.

### `GET /api/replay/:documentId`
Returns recent analysis snapshots for timeline playback.

## Gateway WebSocket

Endpoint: `ws://localhost:4000/ws`

Events:

- `analysis:request`
- `analysis:result`
- `chat:request`
- `chat:chunk`
- `chat:complete`

## Analysis service

### `GET /health`
Health probe for engine and Ollama connectivity.

### `POST /analyze`
Runs the hybrid debugging pipeline.

### `POST /chat`
Starts a streaming assistant session.

### `POST /tests/generate`
Returns generated test cases for the supplied source code.

