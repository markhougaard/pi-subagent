---
id: ps-r0ek
status: open
deps: []
links: []
created: 2026-05-14T21:06:04Z
type: epic
priority: 2
assignee: Mark Hougaard
---
# drive: agentic workflow driver for small local models

Hold the agentic control flow in TypeScript so small local models (gemma4-think on Ollama) can be driven through plan→execute→verify without stalling. The harness owns the loop; the model is a focused step oracle.

See plan: /Users/markhougaard/.claude/plans/i-ll-paste-the-back-toasty-simon.md

Adds a 'drive' tool and '/drive' command to the pi-subagent extension. Reuses runSubagent (one-shot subprocess) as the execution primitive — each phase is a fresh, stateless call.

## Acceptance Criteria

- 'drive' tool registered and callable from parent pi sessions
- '/drive <goal>' command works interactively (editor prompt for context, assembled output pasted back)
- Stall detection catches the gemma4-think reflection-only failure mode
- Recovery prompt re-prompts once on stall; final output recorded
- E2E run with gemma4-think on a real task (e.g. 'add timeout to runSubagent') completes without manual re-prompting

