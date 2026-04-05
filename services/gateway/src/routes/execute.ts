import type { Request, Response } from "express";
import { z } from "zod";
import { runInSandbox } from "../services/sandbox-service.js";

const schema = z.object({
  language: z.string(),
  source: z.string(),
  timeoutMs: z.number().optional(),
});

export async function executeRoute(request: Request, response: Response): Promise<void> {
  try {
    const payload = schema.parse(request.body);
    const result = await runInSandbox(payload);
    response.json(result);
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : "Sandbox execution failed.",
    });
  }
}
