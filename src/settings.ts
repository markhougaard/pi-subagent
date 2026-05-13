import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getAgentDir } from "@mariozechner/pi-coding-agent";

export interface Settings {
  model: string | null;
  extensions: string[];
}

function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") return path.join(os.homedir(), p.slice(1));
  return p;
}

export function readSettings(): Settings {
  const settingsPath = path.join(getAgentDir(), "settings.json");
  let model: string | null = null;
  let extensions: string[] = [];
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    const block = raw["pi-subagent"];
    if (block && typeof block === "object") {
      if (typeof block.model === "string") model = block.model;
      if (Array.isArray(block.extensions)) {
        extensions = block.extensions
          .filter((e: unknown): e is string => typeof e === "string")
          .map(expandHome);
      }
    }
  } catch {
    // missing or malformed — fall through to defaults
  }
  return { model, extensions };
}
