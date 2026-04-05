import type { Request, Response } from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import type { AnalysisRequest } from "@debugwise/contracts";
import { analyzeCode } from "../services/analysis-client.js";
import { buildCacheKey, getCachedAnalysis, setCachedAnalysis } from "../services/cache.js";

const schema = z.object({
  documentId: z.string().min(1),
  sessionId: z.string().min(1),
  language: z.string().min(1),
  source: z.string(),
  cursorOffset: z.number().optional(),
});

export async function analysisRoute(request: Request, response: Response): Promise<void> {
  try {
    const payload = schema.parse(request.body) as AnalysisRequest;
    const key = buildCacheKey(payload.documentId, payload.source);
    const cached = getCachedAnalysis(key);

    if (cached) {
      response.json(cached);
      return;
    }

    const result = await analyzeCode(payload);
    const enriched = { ...result, requestId: result.requestId || uuid() };
    setCachedAnalysis(key, payload.documentId, enriched);
    response.json(enriched);
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : "Analysis pipeline failed.",
    });
  }
}
