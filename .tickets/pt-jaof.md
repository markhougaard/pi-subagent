---
id: pt-jaof
status: closed
deps: [pt-tn1u]
links: []
created: 2026-05-13T22:47:47Z
type: task
priority: 2
assignee: Mark Hougaard
parent: pt-ph8w
---
# Parallel runner with concurrency cap

Run tasks in parallel up to ForkInput.concurrency (default 2). Use a simple worker-queue pattern. Aggregate results in input order regardless of completion order.

## Acceptance Criteria

fork() with 4 tasks and concurrency=2 runs 2 at a time, completes all 4, returns results in the same order as the input array.

