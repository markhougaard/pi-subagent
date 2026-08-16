---
id: ps-mh4j
status: in_progress
deps: [ps-oyqy, ps-nhog]
links: []
created: 2026-05-14T21:07:05Z
type: task
priority: 2
assignee: Mark Hougaard
parent: ps-r0ek
---
# drive: E2E verification with gemma4-think

Confirm the harness solves the original problem: gemma4-think driven to completion on a real task without manual intervention.

Test scenario (the same one that produced the stall in the original transcript):
- Goal: 'add a per-task timeout parameter to runSubagent'
- Context: full contents of src/spawn.ts
- Agent: architect (default)

Two invocation paths to verify:
1. pi -e ./src/index.ts; then ask the parent model: 'Use drive to <goal>' with the context blob in the prompt
2. pi -e ./src/index.ts; then /drive 'add per-task timeout to runSubagent' → paste spawn.ts into the editor prompt

Capture and inspect:
- DriveResult.plan (printed via notify)
- stalledCount: should be > 0 in at least one run if gemma4-think reverts to its reflection pattern on any step
- finalOutput per step: should contain actual code/edits, not just reflection
- The assembled output in the editor at the end

Record findings via 'tk add-note ps-r0ek' on the epic — note token usage, stall rate, qualitative output quality. If stall heuristics are too eager or too loose, file follow-up tickets to tune detectStall.

## Acceptance Criteria

- Both invocation paths complete end-to-end without manual re-prompting
- At least one step shows actionable code output (not just analysis)
- Stall recovery is observed at least once across test runs (or noted as not triggered, with rationale)
- Findings written back to the epic via tk add-note

