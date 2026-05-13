import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDir, parseFrontmatter } from "@mariozechner/pi-coding-agent";

export interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  filePath: string;
  model?: string;
  thinking?: string;
}

export interface AgentDiscovery {
  agents: AgentConfig[];
  projectAgentsDir: string | null;
}

function firstString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function loadFromDir(dir: string): AgentConfig[] {
  if (!fs.existsSync(dir)) return [];
  const agents: AgentConfig[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.name.endsWith(".md")) continue;
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;
    const filePath = path.join(dir, entry.name);
    let parsed: { frontmatter: Record<string, unknown>; body: string };
    try {
      parsed = parseFrontmatter<Record<string, unknown>>(fs.readFileSync(filePath, "utf-8"));
    } catch {
      continue;
    }
    const name = firstString(parsed.frontmatter.name);
    const description = firstString(parsed.frontmatter.description);
    if (!name || !description) continue;
    agents.push({
      name,
      description,
      systemPrompt: parsed.body.trim(),
      filePath,
      model: firstString(parsed.frontmatter.model),
      thinking: firstString(parsed.frontmatter.thinking),
    });
  }
  return agents;
}

function findProjectAgentsDir(cwd: string): string | null {
  let dir = cwd;
  while (true) {
    const candidate = path.join(dir, ".pi", "agents");
    try {
      if (fs.statSync(candidate).isDirectory()) return candidate;
    } catch {
      // keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function discoverAgents(cwd: string): AgentDiscovery {
  const userDir = path.join(getAgentDir(), "agents");
  const projectDir = findProjectAgentsDir(cwd);
  const byName = new Map<string, AgentConfig>();
  for (const a of loadFromDir(userDir)) byName.set(a.name, a);
  if (projectDir) for (const a of loadFromDir(projectDir)) byName.set(a.name, a);
  return {
    agents: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)),
    projectAgentsDir: projectDir,
  };
}
