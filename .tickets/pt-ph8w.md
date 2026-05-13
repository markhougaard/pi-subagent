---
id: pt-ph8w
status: closed
deps: []
links: []
created: 2026-05-13T22:46:54Z
type: epic
priority: 1
assignee: Mark Hougaard
---
# Pi parallel subagent extension v0

Build a Pi extension exposing a single sync `fork` tool that delegates tasks to parallel child Pi sessions and returns structured results. Solves Qwen3.6-27b 100k context overflow by offloading work to fresh-spawn children whose token usage stays out of the parent context.

## Design

Contract sketched in conversation 2026-05-14. Key shape: fork({tasks: Task[], concurrency, defaultTimeoutMs, defaultTurnLimit}) -> {results: TaskResult[], totalDurationMs}. Task has name, prompt, optional context blob, returns:{example}, optional writable/effort overrides. Fresh-spawn children only. Example-based shape-match validation with retry-once. Read-only tool access by default. Caller-assembled context strings (no file-reading magic).

## Acceptance Criteria

User can call fork() from a Pi conversation with 2+ tasks, see them run in parallel (concurrency=2), and receive validated structured payloads back. Two parallel children each burn their own ~10-50k context; parent sees only the validated payload (~1k). End-to-end test passes with Qwen3.6-27b at work.


## Notes

**2026-05-13T23:05:55Z**

Superseded 2026-05-14 by minimal pi-subagent design (markdown roles + one-subagent-per-call, host-driven parallelism). See plan i-really-like-the-sleepy-liskov.
