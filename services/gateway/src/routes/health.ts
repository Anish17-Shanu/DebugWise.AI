import type { Request, Response } from "express";
import { getHealth } from "../services/analysis-client.js";
import { getSandboxHealth } from "../services/sandbox-service.js";

export async function healthRoute(_request: Request, response: Response): Promise<void> {
  const analysis = await getHealth();
  const sandbox = await getSandboxHealth();
  response.json({
    status: "ok",
    now: new Date().toISOString(),
    analysis,
    sandbox,
  });
}
