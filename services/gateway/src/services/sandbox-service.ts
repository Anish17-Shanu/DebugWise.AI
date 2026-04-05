import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { env } from "../config/env.js";

export interface ExecutionRequest {
  language: string;
  source: string;
  timeoutMs?: number;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  command: string[];
}

interface RuntimeCommand {
  fileName: string;
  dockerCommand: string;
  localCommand: string;
  localArgs: string[];
}

const imageByLanguage: Record<string, string> = {
  javascript: "node:22-alpine",
  typescript: "node:22-alpine",
  python: env.DEBUGWISE_SANDBOX_IMAGE,
  java: "eclipse-temurin:21-jdk-alpine",
};

const preparedImages = new Set<string>();
let dockerAvailability: boolean | undefined;

function resolveJavaClassName(source: string): string {
  const publicClassMatch = source.match(/\bpublic\s+class\s+([A-Za-z_]\w*)/);
  const classMatch = publicClassMatch ?? source.match(/\bclass\s+([A-Za-z_]\w*)/);
  return classMatch?.[1] ?? "Main";
}

function resolveRuntime(payload: ExecutionRequest, workspace = "/workspace"): RuntimeCommand {
  if (payload.language === "java") {
    const className = resolveJavaClassName(payload.source);
    const fileName = `${className}.java`;
    return {
      fileName,
      dockerCommand: `javac ${workspace}/${fileName} && java -cp ${workspace} ${className}`,
      localCommand: "javac",
      localArgs: [fileName],
    };
  }

  if (payload.language === "python") {
    return {
      fileName: "main.py",
      dockerCommand: `python ${workspace}/main.py`,
      localCommand: "python",
      localArgs: ["main.py"],
    };
  }

  if (payload.language === "typescript") {
    return {
      fileName: "main.ts",
      dockerCommand: `node --experimental-strip-types ${workspace}/main.ts`,
      localCommand: "node",
      localArgs: ["--experimental-strip-types", "main.ts"],
    };
  }

  return {
    fileName: "main.js",
    dockerCommand: `node ${workspace}/main.js`,
    localCommand: "node",
    localArgs: ["main.js"],
  };
}

function runProcess(
  command: string,
  args: string[],
  timeoutMs: number,
  cwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number | null; timedOut: boolean }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        stdout,
        stderr: `${stderr}${error.message}`,
        exitCode: 1,
        timedOut,
      });
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      resolve({ stdout, stderr, exitCode, timedOut });
    });
  });
}

async function canUseDocker(): Promise<boolean> {
  if (dockerAvailability !== undefined) {
    return dockerAvailability;
  }

  const result = await runProcess("docker", ["version", "--format", "{{.Server.Version}}"], 5_000);
  dockerAvailability = result.exitCode === 0;
  return dockerAvailability;
}

async function ensureImage(image: string): Promise<void> {
  if (preparedImages.has(image)) {
    return;
  }

  const inspect = await runProcess("docker", ["image", "inspect", image], 8_000);
  if (inspect.exitCode !== 0) {
    const pull = await runProcess("docker", ["pull", image], 180_000);
    if (pull.exitCode !== 0) {
      throw new Error(`Failed to pull sandbox image ${image}: ${pull.stderr || pull.stdout}`);
    }
  }

  preparedImages.add(image);
}

async function runInDocker(payload: ExecutionRequest): Promise<ExecutionResult> {
  const runtime = resolveRuntime(payload);
  const image = imageByLanguage[payload.language] ?? imageByLanguage.javascript;
  await ensureImage(image);

  const encoded = Buffer.from(payload.source, "utf8").toString("base64");
  const bootstrap = [
    "run",
    "--rm",
    "--network",
    "none",
    "--memory",
    "256m",
    "--cpus",
    "0.50",
    image,
    "sh",
    "-lc",
    `mkdir -p /workspace && echo ${encoded} | base64 -d > /workspace/${runtime.fileName} && ${runtime.dockerCommand}`,
  ];

  const result = await runProcess("docker", bootstrap, payload.timeoutMs ?? 12_000);
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    command: ["docker", ...bootstrap],
  };
}

async function runLocally(payload: ExecutionRequest): Promise<ExecutionResult> {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "debugwise-"));
  const timeoutMs = payload.timeoutMs ?? 12_000;

  try {
    const runtime = resolveRuntime(payload, tempDirectory.replace(/\\/g, "/"));
    const filePath = path.join(tempDirectory, runtime.fileName);
    await writeFile(filePath, payload.source, "utf8");

    if (payload.language === "java") {
      const compileResult = await runProcess(runtime.localCommand, runtime.localArgs, timeoutMs, tempDirectory);
      if (compileResult.exitCode !== 0 || compileResult.timedOut) {
        return {
          stdout: compileResult.stdout,
          stderr: compileResult.stderr,
          exitCode: compileResult.exitCode,
          timedOut: compileResult.timedOut,
          command: ["javac", runtime.fileName],
        };
      }

      const className = runtime.fileName.replace(/\.java$/, "");
      const runResult = await runProcess("java", ["-cp", tempDirectory, className], timeoutMs, tempDirectory);
      return {
        stdout: `${compileResult.stdout}${runResult.stdout}`,
        stderr: `${compileResult.stderr}${runResult.stderr}`,
        exitCode: runResult.exitCode,
        timedOut: runResult.timedOut,
        command: ["javac", runtime.fileName, "&&", "java", "-cp", tempDirectory, className],
      };
    }

    const result = await runProcess(runtime.localCommand, runtime.localArgs, timeoutMs, tempDirectory);
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      command: [runtime.localCommand, ...runtime.localArgs],
    };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

export async function runInSandbox(payload: ExecutionRequest): Promise<ExecutionResult> {
  if (await canUseDocker()) {
    return runInDocker(payload);
  }

  return runLocally(payload);
}

export async function getSandboxHealth(): Promise<{ status: "ok"; mode: "docker" | "local" }> {
  return {
    status: "ok",
    mode: (await canUseDocker()) ? "docker" : "local",
  };
}
