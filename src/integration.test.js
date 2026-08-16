import assert from "node:assert/strict";
import test from "node:test";
import { discoverAgents } from "./agents.ts";
import { readSettings } from "./settings.ts";
import { runSubagent } from "./spawn.ts";

test("integration: scout maps the pi-subagent repository", async (t) => {
  const agents = discoverAgents(process.cwd());
  const scout = agents.agents.find((a) => a.name === "scout");
  assert.ok(scout, "scout role not found");

  const settings = readSettings();
  const result = await runSubagent({
    cwd: process.cwd(),
    agent: scout,
    task: "Quickly map the pi-subagent repository structure. Report: (1) directory structure with key dirs, (2) key source files and their purpose, (3) bundled roles, (4) whether tests exist. Bullet points only, no prose.",
    settings,
  });

  // Verify the child process completed successfully
  assert.equal(result.exitCode, 0, `scout exited with code ${result.exitCode}: ${result.stderr}`);
  assert.ok(result.text.length > 0, "scout returned empty text");
  assert.ok(result.model === "qwen-coder:latest", `scout used model ${result.model}, expected qwen-coder:latest`);
  assert.ok(result.usage.turns >= 1, "scout did not record any turns");

  // Verify response mentions key artifacts
  const mentions = {
    "src/": result.text.includes("src/"),
    agents: result.text.includes("agents") || result.text.includes("role"),
    scout: result.text.includes("scout"),
    test: result.text.toLowerCase().includes("test"),
  };
  const mentionCount = Object.values(mentions).filter(Boolean).length;
  assert.ok(mentionCount >= 3, `scout response mentioned only ${mentionCount}/4 key artifacts: ${JSON.stringify(mentions)}`);

  // Store scout output for architect test
  return { scoutOutput: result.text };
});

test("integration: architect plans based on scout findings", async (t) => {
  const agents = discoverAgents(process.cwd());
  const architect = agents.agents.find((a) => a.name === "architect");
  assert.ok(architect, "architect role not found");

  const settings = readSettings();

  // Architect task based on scout findings
  const task = `Based on the pi-subagent repository structure, plan how to add a "Daily Use" section to the README showing:
(1) How to load the extension in pi (pi -e ./src/index.ts)
(2) How to call scout and architect
(3) Example output from each role

Return a structured plan with: Context, Approach, Files to touch, Risks, Verification.`;

  const result = await runSubagent({
    cwd: process.cwd(),
    agent: architect,
    task,
    settings,
  });

  // Verify the child process completed successfully
  assert.equal(result.exitCode, 0, `architect exited with code ${result.exitCode}: ${result.stderr}`);
  assert.ok(result.text.length > 0, "architect returned empty text");
  assert.ok(
    result.model === "gemma4-think:latest",
    `architect used model ${result.model}, expected gemma4-think:latest`
  );
  assert.ok(result.usage.turns >= 1, "architect did not record any turns");

  // Verify response has planning structure
  const hasContext = result.text.toLowerCase().includes("context");
  const hasApproach = result.text.toLowerCase().includes("approach");
  const hasFiles = result.text.toLowerCase().includes("readme") || result.text.toLowerCase().includes("file");
  const hasVerify = result.text.toLowerCase().includes("verif");

  assert.ok(
    hasContext || hasApproach || hasFiles,
    `architect response lacked structure; has: context=${hasContext}, approach=${hasApproach}, files=${hasFiles}, verify=${hasVerify}`
  );
});

test("integration: code-reviewer evaluates code snippets", async (t) => {
  const agents = discoverAgents(process.cwd());
  const reviewer = agents.agents.find((a) => a.name === "code-reviewer");
  assert.ok(reviewer, "code-reviewer role not found");

  const settings = readSettings();

  // Give reviewer some actual code from the extension
  const codeSnippet = `
export async function runSubagent(opts: RunOptions): Promise<SubagentResult> {
  const { cwd, agent, task, settings, signal } = opts;
  let tmpDir: string | null = null;
  let systemPromptPath: string | null = null;
  if (agent.systemPrompt) {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-"));
    systemPromptPath = path.join(tmpDir, "system-prompt.md");
    fs.writeFileSync(systemPromptPath, agent.systemPrompt, { encoding: "utf-8", mode: 0o600 });
  }
  // ... rest of implementation
}`;

  const task = `Review this TypeScript code from pi-subagent's spawn.ts for:
(1) Resource leaks — are temp files cleaned up?
(2) Error handling — what happens if the child process fails?
(3) Signal handling — does abort signal work correctly?

Return a list of issues, if any, in priority order.

Code:
\`\`\`
${codeSnippet}
\`\`\``;

  const result = await runSubagent({
    cwd: process.cwd(),
    agent: reviewer,
    task,
    settings,
  });

  // Verify the child process completed successfully
  assert.equal(result.exitCode, 0, `code-reviewer exited with code ${result.exitCode}: ${result.stderr}`);
  assert.ok(result.text.length > 0, "code-reviewer returned empty text");
  assert.ok(result.model === "qwen-coder:latest", `code-reviewer used model ${result.model}, expected qwen-coder:latest`);
});

test("integration: researcher investigates a topic", async (t) => {
  const agents = discoverAgents(process.cwd());
  const researcher = agents.agents.find((a) => a.name === "researcher");
  assert.ok(researcher, "researcher role not found");

  const settings = readSettings();

  const task = `Investigate: What are the trade-offs between hot-swapping models (like llama-swap) vs. running a single large model?

Consider: inference latency, VRAM overhead, context efficiency, and usefulness for an LLM-based coding agent.

Return a structured brief with: Trade-off summary, Scenario A (hot-swap), Scenario B (single large), and Recommendation.`;

  const result = await runSubagent({
    cwd: process.cwd(),
    agent: researcher,
    task,
    settings,
  });

  // Verify the child process completed successfully
  assert.equal(result.exitCode, 0, `researcher exited with code ${result.exitCode}: ${result.stderr}`);
  assert.ok(result.text.length > 0, "researcher returned empty text");
  assert.ok(result.model === "gemma4-think:latest", `researcher used model ${result.model}, expected gemma4-think:latest`);
  assert.ok(result.usage.turns >= 1, "researcher did not record any turns");

  // Verify response addresses the question
  const addressesTopic = result.text.toLowerCase().includes("trade-off") || result.text.toLowerCase().includes("swap");
  assert.ok(addressesTopic, "researcher response did not address the trade-offs question");
});

test("integration: sme answers a focused question", async (t) => {
  const agents = discoverAgents(process.cwd());
  const sme = agents.agents.find((a) => a.name === "sme");
  assert.ok(sme, "sme role not found");

  const settings = readSettings();

  // Provide context about our extension
  const context = `
pi-subagent is a minimal Pi extension that:
- Exposes one tool: subagent({agent: string, task: string})
- Fresh-spawns child pi processes with no session history
- Discovers agent roles from ~/.pi/agent/agents/*.md
- Returns only the child's final text to the parent

Each agent role is a markdown file with YAML frontmatter:
- name, description, model, thinking
- Plus a system prompt body defining the role

Available roles: scout, architect, researcher, code-reviewer, sme.
`;

  const task = `Based on the pi-subagent extension description provided, answer: Why does the extension spawn fresh child pi processes instead of reusing the parent's session?`;

  const result = await runSubagent({
    cwd: process.cwd(),
    agent: sme,
    task: `Context:\n${context}\n\nQuestion: ${task}`,
    settings,
  });

  // Verify the child process completed successfully
  assert.equal(result.exitCode, 0, `sme exited with code ${result.exitCode}: ${result.stderr}`);
  assert.ok(result.text.length > 0, "sme returned empty text");
  assert.ok(result.model === "qwen-coder:latest", `sme used model ${result.model}, expected qwen-coder:latest`);

  // Verify response addresses the question
  const answers = result.text.toLowerCase();
  const addressesQuestion = answers.includes("context") || answers.includes("session") || answers.includes("fresh");
  assert.ok(addressesQuestion, "sme response did not answer the question about fresh processes");
});
