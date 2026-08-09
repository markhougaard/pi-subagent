# pi-subagent

Minimal Pi extension: one `subagent` tool that spawns role-shaped child `pi` processes. Roles are markdown files. The parent LLM decides how many subagents to fan out — the host (Pi) handles parallel tool calls.

Built to keep parent context lean on local-LLM setups where the main session has a tight token budget (e.g. Qwen at ~100k) and slower planning work belongs on a different model (e.g. Gemma).

## What it does

`subagent({ agent, task })` runs `pi --mode json -p --no-session` in a child process with:

- The role markdown's body appended as the child's system prompt (`--append-system-prompt`).
- The role's `model:` and `thinking:` frontmatter (per-role model is the whole point).
- No session history. No extensions unless the role asks for them.

Only the child's final assistant text is returned to the parent. Everything the child thought, called, and read stays in the child's process.

The `agent` parameter is constrained to the roles that actually resolve for the session's working directory, and the same list is appended to the parent's system prompt — so the parent can only ask for roles that exist. Roles added mid-session are picked up on the next turn.

If a child fails — a nonzero exit, or a provider error such as a refused connection or bad credentials — the tool returns an error naming the cause and the model, rather than an empty success.

## Install

From npm (recommended):

```bash
pi install @marks/pi-subagent
mkdir -p ~/.pi/agent/agents
cp node_modules/@marks/pi-subagent/agents/*.md ~/.pi/agent/agents/
```

The package ships the role markdowns in `agents/` inside `node_modules/@marks/pi-subagent/`. Copy or symlink them into `~/.pi/agent/agents/` so Pi can find them — that location is where roles are resolved from.

From a local checkout (for development):

```bash
npm install
pi install $(pwd)
cp agents/*.md ~/.pi/agent/agents/
```

Confirm: `pi list` shows `pi-subagent`. Inside a fresh `pi` session, the `subagent` tool is available.

## Bundled roles

| Role | Model | Use for |
|---|---|---|
| `scout` | `qwen-coder:latest` | Fast file/symbol reconnaissance — dense bullets, no prose |
| `architect` | `gemma4-think:latest` | Implementation plans before coding |
| `researcher` | `gemma4-think:latest` | Investigations, structured briefs |
| `code-reviewer` | `qwen-coder:latest` | Prioritized issue lists on a diff or file |
| `sme` | `qwen-coder:latest` | Focused Q&A from supplied context |

Each lives as a markdown file in `~/.pi/agent/agents/`. Edit the frontmatter (`model`, `thinking`) to swap models per role. Drop your own `<role>.md` into the same folder to add a new role — no rebuild needed.

Project-scoped overrides go in `<repo>/.pi/agents/<role>.md` and win over the user-level file.

## Settings (optional)

In `~/.pi/agent/settings.json`:

```json
{
  "pi-subagent": {
    "model": "qwen-coder:latest",
    "extensions": ["~/.pi/agent/extensions/ollama.ts"]
  }
}
```

- `model` — fallback when a role markdown omits `model:`.
- `extensions` — paths passed through to each child as `--extension`. Useful for provider extensions (e.g. ollama) that children need in order to use a model.

## Parallel use

Tell the parent to call `subagent` more than once in a turn. Pi will run them in parallel:

> Use `scout` to map `src/` and `code-reviewer` to read `README.md` in parallel.

Two child `pi` processes run side by side; both replies land back before the parent continues.

## Layout

```
src/
  index.ts      # registerTool wiring + result formatting
  agents.ts     # discover + load markdown roles
  spawn.ts      # resolve the pi CLI, spawn child, JSON-mode parse
  settings.ts   # ~/.pi/agent/settings.json["pi-subagent"]
agents/         # bundled role markdowns
```

`npm test` runs the unit tests. `npm run test:integration` runs the live-model
tests, which need a reachable provider and are kept out of CI.

No build step — Pi runs the TypeScript directly via `pi.extensions` in `package.json`.
