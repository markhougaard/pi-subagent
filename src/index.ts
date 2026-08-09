import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type TSchema, Type } from "@sinclair/typebox";
import { type AgentConfig, discoverAgents } from "./agents.ts";
import { readSettings } from "./settings.ts";
import { type SubagentResult, runSubagent } from "./spawn.ts";

const DESCRIPTION =
  "Spawn a role-shaped child pi process to handle one focused task. Roles are markdown files (scout, architect, researcher, code-reviewer, sme, ...). Child runs with no session history; only its final reply returns to the parent. For parallel work, call this tool multiple times in the same turn.";

interface SubagentDetails {
  result: SubagentResult | null;
  errorMessage?: string;
}

function agentDescription(agents: AgentConfig[]): string {
  const base =
    "Name of the role to spawn. Roles are markdown files in ~/.pi/agent/agents/ (or the nearest project .pi/agents/). Each role pins its own model.";
  if (!agents.length) return base;
  return `${base} Available here: ${agents.map((a) => a.name).join(", ")}.`;
}

function buildParameters(agents: AgentConfig[]) {
  return Type.Object({
    agent: Type.String({
      // Constrain to what actually exists so the model cannot invent a role.
      // Omitted when nothing is discoverable, otherwise the tool is uncallable.
      ...(agents.length ? { enum: agents.map((a) => a.name) } : {}),
      description: agentDescription(agents),
    }),
    task: Type.String({
      description:
        "The focused task for the subagent. Include scope, expected return shape, and any context the role needs (it starts with no session history).",
    }),
  });
}

export interface ToolResult {
  content: { type: "text"; text: string }[];
  details: SubagentDetails;
  isError?: boolean;
}

function errorResult(text: string, result: SubagentResult | null): ToolResult {
  return {
    content: [{ type: "text", text }],
    details: { result, errorMessage: text },
    isError: true,
  };
}

/** Turn a finished child run into a tool result. Exported for tests. */
export function toToolResult(agentName: string, result: SubagentResult): ToolResult {
  if (result.exitCode !== 0 && !result.text) {
    return errorResult(
      `Subagent "${agentName}" failed (exit ${result.exitCode}).` +
        (result.errorMessage ? `\n\n${result.errorMessage}` : "") +
        (result.stderr ? `\n\nstderr:\n${result.stderr.trim().slice(-2000)}` : ""),
      result,
    );
  }

  // A provider error (connection refused, bad auth, rate limit) still exits 0
  // with no content. Reporting that as an empty success hides a real failure.
  if (!result.text && (result.errorMessage || result.stopReason === "error")) {
    return errorResult(
      `Subagent "${agentName}" produced no output: ${result.errorMessage ?? "provider reported an error"}` +
        (result.model ? ` (model: ${result.model})` : ""),
      result,
    );
  }

  return {
    content: [{ type: "text", text: result.text || "(empty response)" }],
    details: { result },
  };
}

export function rolesPromptSection(agents: AgentConfig[]): string {
  const lines = agents.length
    ? agents.map((a) => `- ${a.name}: ${a.description}`).join("\n")
    : "(none discovered)";
  return `## Available subagent roles\nRole files load from ~/.pi/agent/agents/ or the nearest project .pi/agents/. Spawn one with the \`subagent\` tool; call it several times in one turn to run roles in parallel.\n${lines}`;
}

export default function (pi: ExtensionAPI) {
  // Registered at load time (not from session_start) so pi's duplicate-tool
  // detection still fires against other extensions owning this name. Later
  // calls re-register the same name, which only refreshes the schema.
  // null (not "") means "never registered" — an empty role set is a real state
  // that must still produce a registered tool.
  let registeredNames: string | null = null;

  const register = (agents: AgentConfig[]) => {
    const key = agents.map((a) => a.name).join(" ");
    if (key === registeredNames) return;
    const parameters = buildParameters(agents);

    pi.registerTool<TSchema, SubagentDetails>({
      name: "subagent",
      label: "Subagent",
      description: DESCRIPTION,
      parameters,

      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        const { agent: agentName, task } = params as { agent: string; task: string };
        const discovery = discoverAgents(ctx.cwd);
        const agent = discovery.agents.find((a) => a.name === agentName);
        if (!agent) {
          const available = discovery.agents.map((a) => a.name).join(", ") || "(none)";
          const text = `Unknown subagent "${agentName}". Available in ${ctx.cwd}: ${available}.`;
          return {
            content: [{ type: "text" as const, text }],
            details: { result: null, errorMessage: text },
            isError: true,
          };
        }

        const result = await runSubagent({
          cwd: ctx.cwd,
          agent,
          task,
          settings: readSettings(),
          signal,
        });

        return toToolResult(agent.name, result);
      },
    });

    registeredNames = key;
  };

  // Best guess before any session exists; corrected once pi reports its cwd.
  register(discoverAgents(process.cwd()).agents);

  const refresh = (cwd: string): AgentConfig[] => {
    const agents = discoverAgents(cwd).agents;
    try {
      register(agents);
    } catch {
      // A stale runtime (session replaced mid-flight) must not break the turn;
      // the previously registered schema stays in place.
    }
    return agents;
  };

  pi.on("session_start", (_event, ctx) => {
    refresh(ctx.cwd);
  });

  pi.on("before_agent_start", (event) => {
    // One discovery per turn, shared by the schema refresh and the prompt.
    // Picks up roles added mid-session, before the model sees the schema.
    const agents = refresh(event.systemPromptOptions.cwd);
    return {
      systemPrompt: `${event.systemPrompt}\n\n${rolesPromptSection(agents)}`,
    };
  });
}
