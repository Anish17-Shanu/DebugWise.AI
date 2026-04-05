import type { AnalysisRequest, AnalysisResponse, ChatRequest } from "@debugwise/contracts";
import { env } from "../config/env.js";

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`Analysis service returned ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function analyzeCode(payload: AnalysisRequest): Promise<AnalysisResponse> {
  const response = await fetch(`${env.DEBUGWISE_ANALYSIS_URL}/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  return readJson<AnalysisResponse>(response);
}

export async function generateChatStream(payload: ChatRequest): Promise<Response> {
  const response = await fetch(`${env.DEBUGWISE_ANALYSIS_URL}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Chat service returned ${response.status}`);
  }

  return response;
}

export async function getHealth(): Promise<unknown> {
  const response = await fetch(`${env.DEBUGWISE_ANALYSIS_URL}/health`);
  return readJson(response);
}

