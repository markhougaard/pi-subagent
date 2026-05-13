---
id: pt-42nx
status: closed
deps: []
links: []
created: 2026-05-13T22:47:38Z
type: chore
priority: 1
assignee: Mark Hougaard
parent: pt-ph8w
---
# Research: Pi extension API for constraining child tool access

Investigate how Pi extensions can constrain the toolset of a spawned child pi process. Options to check: (a) CLI flags for limiting tools, (b) per-session config, (c) only-via-system-prompt enforcement. Outcome determines whether 'writable: false' is enforceable or advisory in our contract.

## Acceptance Criteria

Document concrete mechanism (or absence) in ticket notes. Pin a decision: enforce at process level, enforce by prompt, or punt to v1.

