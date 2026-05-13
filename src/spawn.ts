import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentConfig } from "./agents.ts";
import type { Settings } from "./settings.ts";

export interface SubagentResult {
  agent: string;
  model: string | null;
  text: string;
  stopReason: string | null;
  exitCode: number;
  usage: { input: number; output: number; turns: number };
  stderr: string;
}

interface AssistantContentPart {
  type?: string;
  text?: string;
}

interface PiUsage {
  input?: number;
  output?: number;
}

interface PiMessage {
  role?: string;
  content?: AssistantContentPart[] | string;
  text?: string;
  stopReason?: string;
  usage?: PiUsage;
}

function extractText(content: PiMessage["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((p): p is AssistantContentPart => !!p && typeof p === "object")
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text!)
    .join("\n")
    .trim();
}

function buildArgs(opts: {
  agent: AgentConfig;
  task: string;
  systemPromptPath: string | null;
  settings: Settings;
}): string[] {
  const { agent, task, systemPromptPath, settings } = opts;
  const args = ["--mode", "json", "-p", "--no-session", "--no-extensions"];
  for (const ext of settings.extensions) args.push("--extension", ext);
  const model = agent.model ?? settings.model;
  if (model) args.push("--model", model);
  if (agent.thinking) args.push("--thinking", agent.thinking);
  if (systemPromptPath) args.push("--append-system-prompt", systemPromptPath);
  args.push(task);
  return args;
}

function resolvePiSpawn(): { command: string; prefix: string[] } {
  // Re-use the same node + pi script the parent is running under.
  const isNode = /[\\/]node$/i.test(process.execPath);
  if (isNode && process.argv[1]) return { command: process.execPath, prefix: [process.argv[1]] };
  return { command: process.execPath, prefix: [] };
}

export interface RunOptions {
  cwd: string;
  agent: AgentConfig;
  task: string;
  settings: Settings;
  signal?: AbortSignal;
}

export async function runSubagent(opts: RunOptions): Promise<SubagentResult> {
  const { cwd, agent, task, settings, signal } = opts;

  let tmpDir: string | null = null;
  let systemPromptPath: string | null = null;
  if (agent.systemPrompt) {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-"));
    systemPromptPath = path.join(tmpDir, "system-prompt.md");
    fs.writeFileSync(systemPromptPath, agent.systemPrompt, { encoding: "utf-8", mode: 0o600 });
  }

  const result: SubagentResult = {
    agent: agent.name,
    model: agent.model ?? settings.model,
    text: "",
    stopReason: null,
    exitCode: -1,
    usage: { input: 0, output: 0, turns: 0 },
    stderr: "",
  };

  try {
    const args = buildArgs({ agent, task, systemPromptPath, settings });
    const { command, prefix } = resolvePiSpawn();

    const exitCode = await new Promise<number>((resolve) => {
      const proc = spawn(command, [...prefix, ...args], {
        cwd,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      });
      proc.stdin.on("error", () => {});
      proc.stdin.end();

      let buffer = "";
      let settled = false;
      const finish = (code: number) => {
        if (settled) return;
        settled = true;
        if (signal && abortHandler) signal.removeEventListener("abort", abortHandler);
        resolve(code);
      };

      const handleLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let event: PiMessage;
        try {
          event = JSON.parse(trimmed);
        } catch {
          return;
        }
        if (event.role !== "assistant") return;
        const text = extractText(event.content);
        if (text) result.text = text;
        if (event.stopReason) result.stopReason = event.stopReason;
        if (event.usage) {
          if (typeof event.usage.input === "number") result.usage.input += event.usage.input;
          if (typeof event.usage.output === "number") result.usage.output += event.usage.output;
          result.usage.turns += 1;
        }
      };

      proc.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) handleLine(line);
      });
      proc.stderr.on("data", (chunk: Buffer) => {
        result.stderr += chunk.toString();
      });
      proc.on("close", (code) => {
        if (buffer.trim()) handleLine(buffer);
        finish(code ?? 0);
      });
      proc.on("error", (err) => {
        if (!result.stderr) result.stderr = err.message;
        finish(1);
      });

      let abortHandler: (() => void) | undefined;
      if (signal) {
        abortHandler = () => proc.kill("SIGTERM");
        if (signal.aborted) abortHandler();
        else signal.addEventListener("abort", abortHandler, { once: true });
      }
    });

    result.exitCode = exitCode;
    return result;
  } finally {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
}
