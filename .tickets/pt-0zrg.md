---
id: pt-0zrg
status: closed
deps: [pt-tn1u]
links: []
created: 2026-05-13T22:47:54Z
type: task
priority: 2
assignee: Mark Hougaard
parent: pt-ph8w
---
# Hard kill on turn/timeout + artifact transcripts

Enforce timeoutMs (default 600000) via wall-clock timer that SIGKILLs the child. Enforce turnLimit (default 25) via pi flag if available, else by post-hoc check. On either: TaskResult.status='timeout' or 'turn_limit', rawOutput populated from whatever partial output we captured. Write full transcript to artifactPath under $TMPDIR/pi-parallel-subagent/<runId>/<taskName>.jsonl for every task regardless of outcome.

## Acceptance Criteria

A task that exceeds timeoutMs is killed within ~1s of the deadline and returns status='timeout'. Artifact file exists for every task and contains the child's full message stream.

