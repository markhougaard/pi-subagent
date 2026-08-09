import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentConfig } from "./agents.ts";
import type { Settings } from "./settings.ts";

export interface SubagentResult {
  agent: string;
  model: string | null;
  text: string;
  stopReason: string | null;
  /** Provider-reported failure. Present even when the child exits 0. */
  errorMessage: string | null;
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
  errorMessage?: string;
  usage?: PiUsage;
}

interface PiEvent {
  type?: string;
  message?: PiMessage;
}

export function extractText(content: PiMessage["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((p): p is AssistantContentPart => !!p && typeof p === "object")
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text!)
    .join("\n")
    .trim();
}

/**
 * Parse one line of pi --mode json output and fold its information into the
 * result accumulator. Returns true if the line was a recognized event we
 * acted on. Exported for unit testing.
 */
export function parseLine(line: string, result: SubagentResult): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  let event: PiEvent;
  try {
    event = JSON.parse(trimmed);
  } catch {
    return false;
  }
  // We only care about finalized assistant messages — one per turn.
  if (event.type !== "message_end") return false;
  const message = event.message;
  if (!message || message.role !== "assistant") return false;

  const text = extractText(message.content);
  if (text) result.text = text;
  if (message.stopReason) result.stopReason = message.stopReason;
  // A provider failure (auth, connection, rate limit) still exits 0, so the
  // only signal the parent gets is here.
  if (message.errorMessage) result.errorMessage = message.errorMessage;
  if (message.usage) {
    if (typeof message.usage.input === "number") result.usage.input += message.usage.input;
    if (typeof message.usage.output === "number") result.usage.output += message.usage.output;
    result.usage.turns += 1;
  }
  return true;
}

export function buildArgs(opts: {
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

const PI_CLI_PACKAGE = "@earendil-works/pi-coding-agent";
const PI_CLI_PATH_RE = /[\\/]@earendil-works[\\/]pi-coding-agent[\\/]/i;

export interface SpawnEnv {
  execPath: string;
  argv1: string | undefined;
  execArgv: string[];
  /** Resolve symlinks. Node does NOT realpath argv[1], so a global install
   * surfaces as the bin symlink (…/bin/pi) rather than the package path. */
  realpath: (p: string) => string;
  /** Locate the pi CLI through normal module resolution. Used when the parent
   * is some other Node host that merely depends on pi. */
  resolvePackage: (specifier: string) => string | null;
}

function defaultResolvePackage(specifier: string): string | null {
  try {
    const url = import.meta.resolve(specifier);
    const entry = fileURLToPath(url);
    // The package main lives beside the CLI entrypoint (dist/index.js → dist/cli.js).
    const cli = path.join(path.dirname(entry), "cli.js");
    return fs.existsSync(cli) ? cli : null;
  } catch {
    return null;
  }
}

export function defaultSpawnEnv(): SpawnEnv {
  return {
    execPath: process.execPath,
    argv1: process.argv[1],
    execArgv: process.execArgv,
    realpath: (p) => fs.realpathSync(p),
    resolvePackage: defaultResolvePackage,
  };
}

/**
 * Decide how to launch a child pi process.
 *
 * Reusing the parent's node + argv[1] is only correct when argv[1] really is
 * the pi CLI. Inside a host that embeds pi as a library, argv[1] belongs to
 * the host, and spawning it would start the wrong program. Exported for tests.
 */
export function resolvePiSpawn(env: SpawnEnv = defaultSpawnEnv()): {
  command: string;
  prefix: string[];
} {
  const isNode = /[\\/]node(\.exe)?$/i.test(env.execPath);

  // Not node: either pi shipped as a compiled binary (execPath *is* pi), or we
  // are inside some other compiled host that cannot be reused as a launcher.
  if (!isNode) {
    const self = path.basename(env.execPath).replace(/\.exe$/i, "");
    return self === "pi"
      ? { command: env.execPath, prefix: [] }
      : { command: "pi", prefix: [] };
  }

  const nodeFlags = env.execArgv.filter((f) => f.startsWith("--experimental-"));
  const viaNode = (script: string) => ({
    command: env.execPath,
    prefix: [...nodeFlags, script],
  });

  // Parent is the pi CLI itself — reuse it, resolving the bin symlink first.
  if (env.argv1) {
    let entry = env.argv1;
    try {
      entry = env.realpath(env.argv1);
    } catch {
      // keep the unresolved path
    }
    if (PI_CLI_PATH_RE.test(entry)) return viaNode(entry);
  }

  // Parent is a different Node host: find the pi it depends on.
  const resolved = env.resolvePackage(PI_CLI_PACKAGE);
  if (resolved) return viaNode(resolved);

  // Last resort: whatever `pi` is on PATH.
  return { command: "pi", prefix: [] };
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
    errorMessage: null,
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

      proc.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) parseLine(line, result);
      });
      proc.stderr.on("data", (chunk: Buffer) => {
        result.stderr += chunk.toString();
      });
      proc.on("close", (code) => {
        if (buffer.trim()) parseLine(buffer, result);
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
