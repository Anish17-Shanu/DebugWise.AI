import http from "node:http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import type { AnalysisRequest, ChatRequest } from "@debugwise/contracts";
import { env } from "./config/env.js";
import { healthRoute } from "./routes/health.js";
import { analysisRoute } from "./routes/analysis.js";
import { chatRoute } from "./routes/chat.js";
import { executeRoute } from "./routes/execute.js";
import { replayRoute } from "./routes/replay.js";
import { analyzeCode, generateChatStream } from "./services/analysis-client.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (_request, response) => {
  response.json({
    service: "debugwise-gateway",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (request, response) => {
  void healthRoute(request, response);
});

app.post("/api/analyze", (request, response) => {
  void analysisRoute(request, response);
});

app.post("/api/chat", (request, response) => {
  void chatRoute(request, response);
});

app.post("/api/execute", (request, response) => {
  void executeRoute(request, response);
});

app.get("/api/replay/:documentId", replayRoute);

const server = http.createServer(app);
const socketServer = new WebSocketServer({ server, path: "/ws" });

socketServer.on("connection", (socket) => {
  socket.on("message", async (raw) => {
    const message = JSON.parse(raw.toString()) as { event: string; payload: AnalysisRequest | ChatRequest };

    if (message.event === "analysis:request") {
      const result = await analyzeCode(message.payload as AnalysisRequest);
      socket.send(JSON.stringify({ event: "analysis:result", payload: result }));
      return;
    }

    if (message.event === "chat:request") {
      const response = await generateChatStream(message.payload as ChatRequest);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        socket.send(JSON.stringify({ event: "chat:complete", payload: { delta: "", done: true } }));
        return;
      }

      while (true) {
        const chunk = await reader.read();
        if (chunk.done) {
          socket.send(JSON.stringify({ event: "chat:complete", payload: { done: true } }));
          break;
        }

        socket.send(
          JSON.stringify({
            event: "chat:chunk",
            payload: { delta: decoder.decode(chunk.value) },
          }),
        );
      }
    }
  });
});

server.on("error", (error) => {
  if ("code" in error && error.code === "EADDRINUSE") {
    console.error(
      `DebugWise gateway could not start because port ${env.DEBUGWISE_PORT} is already in use. ` +
        "Stop the existing process or run scripts/stop-local.ps1 before restarting.",
    );
    process.exit(1);
  }

  console.error("DebugWise gateway failed to start.", error);
  process.exit(1);
});

server.listen(env.DEBUGWISE_PORT, () => {
  console.log(`DebugWise gateway listening on http://localhost:${env.DEBUGWISE_PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    socketServer.close();
    server.close(() => process.exit(0));
  });
}
