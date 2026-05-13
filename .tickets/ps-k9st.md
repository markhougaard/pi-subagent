---
id: ps-k9st
status: open
deps: []
links: []
created: 2026-05-13T23:05:55Z
type: epic
priority: 1
assignee: Mark Hougaard
---
# Build minimal pi-subagent v0

Minimal pi extension: one 'subagent' tool, markdown roles in ~/.pi/agent/agents/, fresh-spawn child pi processes, no build step (Pi runs TS natively). Target ~300 LOC. Roles ship: scout/architect/researcher/code-reviewer/sme with Qwen-3.6-27b vs Gemma4 per role.

## Acceptance Criteria

Extension installs via 'pi install $(pwd)'. 'subagent' tool surfaces in pi session. Each bundled role spawns a child pi with the correct model (verified via ps). Parent context delta after a subagent call is only the returned text. Plan ref: ~/.claude/plans/i-really-like-the-sleepy-liskov.md

