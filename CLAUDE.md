# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A **Pi extension** in early scaffolding called `pi-parallel-subagent`. Pi (`pi`, installed at `~/.nvm/versions/node/v22.14.0/bin/pi`) is an AI coding-assistant CLI with a TypeScript extension API. This extension exposes a single synchronous `fork` tool that spawns parallel child `pi` processes for delegated tasks and returns their structured results to the parent.

The codebase is **pre-implementation**: no source files exist yet. Everything is specified through tickets in `.tickets/`. Treat those as the source of truth for design and acceptance criteria.

## Workflow: tickets are the spec

Work is tracked with `tk` (Tickety, installed globally) — `.tickets/*.md` are the working unit. Useful commands:

- `tk ready` — open/in-progress tickets whose deps are resolved (start here)
- `tk show <id>` — full ticket (partial ID match works: `tk show ph8w`)
- `tk dep tree pt-ph8w` — visualize the epic's dependency graph
- `tk start <id>` / `tk close <id>` — status transitions
- `tk add-note <id>` — append findings (pipe via stdin)

**Implementation order** (from `tk dep tree pt-ph8w`):
1. `pt-urgs` — scaffold extension manifest + register stubbed `fork` tool
2. `pt-tn1u` — real child `pi` spawn for a single task (blocks everything below)
3. `pt-42nx` — research: can Pi extensions constrain a child's toolset? (gates `pt-gvr7`)
4. Parallel after `pt-tn1u`: `pt-jaof` (concurrency cap), `pt-xsn9` (example-based validation + retry-once), `pt-pisr` (effort profile mapping), `pt-0zrg` (hard kill on timeout + artifact transcripts), `pt-gvr7` (read-only child default)
5. `pt-upc6` — E2E test on work hardware with Qwen3.6-27b

Record research findings and decisions in the ticket itself via `tk add-note`, not in separate docs.

## The `fork` contract (from pt-ph8w)

```
fork({tasks: Task[], concurrency=2, defaultTimeoutMs=600000, defaultTurnLimit=25})
  -> {results: TaskResult[], totalDurationMs}
```

Each `Task` has `name`, `prompt`, optional `context` blob, `returns:{example}`, and optional per-task `writable` / `effort` overrides. Key design rules baked into the tickets:

- **Fresh-spawn children only** — no session reuse; the whole point is keeping child token usage out of the parent's context.
- **Caller-assembled context** — children don't read files autonomously by default; the parent passes the context blob.
- **Example-based shape validation** — parse the child's last fenced JSON block, shape-match against `returns.example` (top-level key presence + JS-typeof + first-element type for arrays). Mismatch → one retry citing the specific failure → `validation_failed` with `rawOutput`.
- **Read-only children by default** — `writable:true` escalates per task. Whether this is process-enforced or prompt-enforced is the open question in `pt-42nx`.
- **Results returned in input order**, regardless of completion order.
- **Artifact transcripts always** — write child message stream to `$TMPDIR/pi-parallel-subagent/<runId>/<taskName>.jsonl` for every task, even on timeout/failure.

## Configuration shape

Extension config lives under a `pi-parallel-subagent` block in `~/.pi/agent/settings.json` (same pattern the existing `pi-fork` extension uses, per `pt-pisr`). It maps `effort: 'fast' | 'balanced' | 'deep'` to `{provider, model, thinking}`, which are passed through as flags to child `pi` processes. Default effort: `balanced`. Missing/invalid profile → child uses Pi default and a warning is recorded in `result.error`.

## Building & running the extension

Pi extensions are loaded either persistently via `pi install <path>` (registers in `~/.pi/agent/settings.json`) or per-invocation via `pi -e <path>`. Once code exists, the dev loop is:

- `pi -e ./<entrypoint>.ts` — load this extension into an interactive pi session for testing
- `pi list` — confirm registration after `pi install`
- `pi --version` — currently expected to be on the 0.74.x line

There is no build/lint/test tooling yet — when adding it, prefer matching the conventions of existing extensions at `~/.pi/agent/extensions/` (`ollama.ts`, `think-toggle.ts`, `auto-plan.ts`) rather than introducing a new toolchain.
