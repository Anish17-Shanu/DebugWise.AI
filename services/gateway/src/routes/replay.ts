import type { Request, Response } from "express";
import { getReplay } from "../services/cache.js";

export function replayRoute(request: Request, response: Response): void {
  const documentId = Array.isArray(request.params.documentId)
    ? request.params.documentId[0]
    : request.params.documentId;

  response.json({
    documentId,
    frames: getReplay(documentId),
  });
}
