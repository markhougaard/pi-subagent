import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { discoverAgents } from "./agents.ts";
import { readSettings } from "./settings.ts";
import { type SubagentResult, runSubagent } from "./spawn.ts";

const SubagentParams = Type.Object({
  agent: Type.String({
    description:
      "Name of the role to spawn. Roles are markdown files in ~/.pi/agent/agents/ (or project .pi/agents/). Each role pins its own model.",
  }),
  task: Type.String({
    description:
      "The focused task for the subagent. Include scope, expected return shape, and any context the role needs (it starts with no session history).",
  }),
});

interface SubagentDetails {
  result: SubagentResult | null;
  errorMessage?: string;
}

function unknownAgentDetails(message: string): SubagentDetails {
  return { result: null, errorMessage: message };
}

export default function (pi: ExtensionAPI) {
  pi.registerTool<typeof SubagentParams, SubagentDetails>({
    name: "subagent",
    label: "Subagent",
    description:
      "Spawn a role-shaped child pi process to handle one focused task. Roles are markdown files (scout, architect, researcher, code-reviewer, sme, ...). Child runs with no session history; only its final reply returns to the parent. For parallel work, call this tool multiple times in the same turn.",
    parameters: SubagentParams,

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const discovery = discoverAgents(ctx.cwd);
      const agent = discovery.agents.find((a) => a.name === params.agent);
      if (!agent) {
        const available = discovery.agents.map((a) => a.name).join(", ") || "(none)";
        const msg = `Unknown subagent "${params.agent}". Available: ${available}.`;
        return {
          content: [{ type: "text" as const, text: msg }],
          details: unknownAgentDetails(msg),
          isError: true,
        };
      }

      const settings = readSettings();
      const result = await runSubagent({
        cwd: ctx.cwd,
        agent,
        task: params.task,
        settings,
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
}
