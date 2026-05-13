---
id: pt-tn1u
status: closed
deps: [pt-urgs]
links: []
created: 2026-05-13T22:47:43Z
type: task
priority: 1
assignee: Mark Hougaard
parent: pt-ph8w
---
# Implement child pi spawn (single task, sync)

Replace the stub handler with a real child pi process spawn for a single task. Pass the task prompt + caller context blob as the child's user message. Capture child stdout, parse final fenced JSON block, return a TaskResult with status/data/tokensUsed/turnsUsed/durationMs/artifactPath.

## Acceptance Criteria

Calling fork() with one task triggers a real child pi process, returns when child finishes, and yields a TaskResult with status='ok' and parsed data.

