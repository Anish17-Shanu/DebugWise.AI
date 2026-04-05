import type { AnalysisResponse } from "@debugwise/contracts";

interface ReplayFrame {
  at: string;
  response: AnalysisResponse;
}

const analysisCache = new Map<string, AnalysisResponse>();
const replayCache = new Map<string, ReplayFrame[]>();
const chatCache = new Map<string, string>();

export function buildCacheKey(documentId: string, source: string): string {
  return `${documentId}:${source.length}:${source.slice(0, 120)}`;
}

export function getCachedAnalysis(key: string): AnalysisResponse | undefined {
  return analysisCache.get(key);
}

export function setCachedAnalysis(key: string, documentId: string, response: AnalysisResponse): void {
  analysisCache.set(key, response);
  const frames = replayCache.get(documentId) ?? [];
  frames.unshift({ at: new Date().toISOString(), response });
  replayCache.set(documentId, frames.slice(0, 20));
}

export function getReplay(documentId: string): ReplayFrame[] {
  return replayCache.get(documentId) ?? [];
}

export function buildChatCacheKey(documentId: string, source: string, prompt: string): string {
  return `${documentId}:${source.length}:${prompt}:${source.slice(0, 120)}`;
}

export function getCachedChat(key: string): string | undefined {
  return chatCache.get(key);
}

export function setCachedChat(key: string, response: string): void {
  chatCache.set(key, response);
}
