import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  DEBUGWISE_PORT: z.coerce.number().default(4000),
  DEBUGWISE_ANALYSIS_URL: z.string().url().default("http://localhost:8000"),
  DEBUGWISE_OLLAMA_URL: z.string().url().default("http://localhost:11434"),
  DEBUGWISE_SANDBOX_IMAGE: z.string().default("python:3.12-alpine"),
});

export const env = envSchema.parse(process.env);

