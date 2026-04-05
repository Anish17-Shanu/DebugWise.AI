import type { Request, Response } from "express";
import { z } from "zod";
import type { ChatRequest } from "@debugwise/contracts";
import { generateChatStream } from "../services/analysis-client.js";
import { buildChatCacheKey, getCachedChat, setCachedChat } from "../services/cache.js";

const schema = z.object({
  sessionId: z.string(),
  documentId: z.string(),
  language: z.string(),
  source: z.string(),
  prompt: z.string(),
});

export async function chatRoute(request: Request, response: Response): Promise<void> {
  try {
    const payload = schema.parse(request.body) as ChatRequest;
    const cacheKey = buildChatCacheKey(payload.documentId, payload.source, payload.prompt);
    const cached = getCachedChat(cacheKey);
    if (cached) {
      response.setHeader("Content-Type", "text/event-stream");
      response.setHeader("Cache-Control", "no-cache");
      response.setHeader("Connection", "keep-alive");
      response.write(`data: ${JSON.stringify({ delta: cached })}\n\n`);
      response.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      response.end();
      return;
    }
    const upstream = await generateChatStream(payload);

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");

    const reader = upstream.body?.getReader();
    if (!reader) {
      response.write(`data: ${JSON.stringify({ delta: "No response stream available.", done: true })}\n\n`);
      response.end();
      return;
    }

    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        setCachedChat(cacheKey, fullText);
        response.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        response.end();
        return;
      }

      const delta = decoder.decode(chunk.value);
      fullText += delta;
      response.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : "Assistant pipeline failed.",
    });
  }
}
