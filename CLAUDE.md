# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A **Pi extension** published to npm as `@marks/pi-subagent`. Pi (`pi`, installed at `~/.nvm/versions/node/v22.14.0/bin/pi`) is an AI coding-assistant CLI with a TypeScript extension API. This extension registers a single `subagent` tool that spawns role-shaped child `pi` processes for delegated work and returns only their final text to the parent.

Roles are markdown files with frontmatter (`name`, `description`, `model`, `thinking`), resolved from `~/.pi/agent/agents/` and overridden per-project by the nearest `<repo>/.pi/agents/`.

There is no build step — Pi runs the TypeScript directly via the `pi.extensions` field in `package.json`.

## Layout

```
src/
  index.ts      # tool registration, schema refresh, result formatting
  agents.ts     # discover + load markdown roles
  spawn.ts      # resolve the pi CLI, spawn the child, parse JSON-mode output
  settings.ts   # ~/.pi/agent/settings.json["pi-subagent"]
agents/         # bundled role markdowns
```

## Commands

- `npm test` — unit tests (Node's built-in runner, `--experimental-strip-types`)
- `npm run test:integration` — live-model tests; needs a reachable provider, so it is kept out of `npm test` and CI
- `npm run typecheck` — `tsc --noEmit`
- `pi -e ./src/index.ts` — load this extension into an interactive pi session
- `pi install $(pwd)` / `pi list` — persistent registration

## Design invariants

Changing any of these is a behavior change, not a refactor. Each is covered by a test that explains why.

- **Register the tool at load time, not from `session_start`.** Pi's `detectExtensionConflicts` runs a single pass over each extension's tools after loading. Registering later bypasses it, so a second extension owning the name `subagent` silently shadows this one instead of erroring. `session_start` / `before_agent_start` only *re-register* the same name to refresh the schema.
- **The `agent` enum is omitted when no roles are discovered.** An empty `enum: []` makes the tool uncallable. `registeredNames` starts as `null`, not `""`, so a genuinely empty role set still registers once.
- **Never reuse `process.argv[1]` without checking it is the pi CLI.** Node does not realpath `argv[1]`, so a global install appears as the bin symlink (`…/bin/pi`), not the package path — `resolvePiSpawn` resolves it before matching. Inside a host that merely embeds pi, `argv[1]` is the host's script and spawning it would start the wrong program.
- **A child that exits 0 is not necessarily a success.** Provider failures (connection refused, bad auth, rate limit) come back as exit 0 with empty content and `stopReason: "error"` / `errorMessage` on the message. `toToolResult` reports those as errors; treating them as `"(empty response)"` hides real failures from the parent.
- **Only the child's final assistant text crosses back.** Keeping child token usage out of the parent's context is the point of the extension.

## Child process contract

`runSubagent` invokes `pi --mode json -p --no-session --no-extensions`, plus `--extension` for each entry in the `pi-subagent.extensions` setting, `--model` / `--thinking` from role frontmatter, and `--append-system-prompt` pointing at a temp file holding the role body. Output is parsed line-by-line; only `message_end` events with `role: "assistant"` are folded into the result.

Provider extensions must be listed in settings — children run with `--no-extensions`, so a role pinned to e.g. a llama-cpp model fails with "Model not found" unless the provider extension is passed through.

## Workflow: tickets

Work is tracked with `tk` (Tickety, installed globally); `.tickets/*.md` are the working unit.

- `tk ready` — open/in-progress tickets whose deps are resolved
- `tk show <id>` — full ticket (partial ID match works)
- `tk start <id>` / `tk close <id>` — status transitions
- `tk add-note <id>` — append findings (pipe via stdin)

Record research findings and decisions in the ticket via `tk add-note`, not in separate docs.

Note: the `pt-*` tickets describe an earlier, more elaborate `fork({tasks: [...]})` design that was **not** built. The shipped tool is the simpler single-task `subagent({agent, task})`; treat `pt-*` as historical context, and the `ps-*` tickets as current.

## Releasing

`.github/workflows/publish.yml` fires on `v*` tags and runs `npm ci`, typecheck, and tests before `npm publish --provenance` via OIDC (no `NPM_TOKEN`). Bump `version` in `package.json`, commit, then tag.
