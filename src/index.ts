import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { discoverAgents } from "./agents.ts";
import { readSettings } from "./settings.ts";
import { type SubagentResult, runSubagent } from "./spawn.ts";

interface SubagentDetails {
  result: SubagentResult | null;
  errorMessage?: string;
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    const agents = discoverAgents(ctx.cwd).agents;
    const parameters = Type.Object({
      agent: Type.String({
        ...(agents.length ? { enum: agents.map((a) => a.name) } : {}),
        description:
          "Name of an available role to spawn. Roles are markdown files in ~/.pi/agent/agents/ (or the nearest project .pi/agents/). Each role pins its own model.",
      }),
      task: Type.String({
        description:
          "The focused task for the subagent. Include scope, expected return shape, and any context the role needs (it starts with no session history).",
      }),
    });

    pi.registerTool<typeof parameters, SubagentDetails>({
      name: "subagent",
      label: "Subagent",
      description: "Spawn a role-shaped child pi process to handle one focused task and return its response.",
      parameters,

      async execute(_toolCallId, params, signal, _onUpdate, ctx) {
        const discovery = discoverAgents(ctx.cwd);
        const agent = discovery.agents.find((a) => a.name === params.agent);
        if (!agent) {
          const available = discovery.agents.map((a) => a.name).join(", ") || "(none)";
          const text = `Unknown subagent "${params.agent}". Available: ${available}.`;
          return {
            content: [{ type: "text" as const, text }],
            details: { result: null, errorMessage: text },
            isError: true,
          };
        }

        const result = await runSubagent({
          cwd: ctx.cwd,
          agent,
          task: params.task,
          settings: readSettings(),
          signal,
        });
        if (result.exitCode !== 0 && !result.text) {
          const text =
            `Subagent "${agent.name}" failed (exit ${result.exitCode}).` +
            (result.stderr ? `\n\nstderr:\n${result.stderr.trim().slice(-2000)}` : "");
          return {
            content: [{ type: "text" as const, text }],
            details: { result },
            isError: true,
          };
        }

        return {
          content: [{ type: "text" as const, text: result.text || "(empty response)" }],
          details: { result },
        };
      },
    });
  });

  pi.on("before_agent_start", (event) => {
    const roles = discoverAgents(event.systemPromptOptions.cwd).agents
      .map((a) => `- ${a.name}: ${a.description}`)
      .join("\n");
    return {
      systemPrompt: `${event.systemPrompt}\n\n## Available subagent roles\nRole files are loaded from ~/.pi/agent/agents/ or the nearest project .pi/agents/.\n${roles || "(none)"}`,
    };
  });
}
