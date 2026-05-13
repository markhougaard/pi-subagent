---
id: pt-gvr7
status: closed
deps: [pt-42nx, pt-tn1u]
links: []
created: 2026-05-13T22:47:45Z
type: task
priority: 2
assignee: Mark Hougaard
parent: pt-ph8w
---
# Read-only tool access default for children

Children default to read-only tools (Read/Grep/find/ripgrep + Bash allowlist: ls, cat, head, tail, grep, rg, find, git log, git diff, git show). Caller sets writable:true per task to escalate. Enforcement mechanism depends on research outcome.

## Acceptance Criteria

A task without writable:true cannot edit files. A task with writable:true can. Default behavior verified via test child that tries to write a file.

