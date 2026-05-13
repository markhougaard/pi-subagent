---
id: pt-upc6
status: closed
deps: [pt-gvr7, pt-jaof, pt-xsn9, pt-pisr, pt-0zrg]
links: []
created: 2026-05-13T22:47:56Z
type: task
priority: 2
assignee: Mark Hougaard
parent: pt-ph8w
---
# E2E test with Qwen3.6-27b at work

Run a real parallel review task at work: two children reviewing different files concurrently with Qwen3.6-27b, structured findings returned to parent. Measure: parent context delta, child token usage, validation retry rate, wall-clock time, RAM/thermal behavior with 2 concurrent Qwen processes.

## Acceptance Criteria

Documented in ticket notes: actual numbers for parent context delta, child token usage, retry rate, wall-clock time, and whether 2 concurrent Qwen-27b processes are sustainable on work hardware. Pass/fail call on whether v0 is usable as-is or needs adjustments before daily use.

