---
id: pt-xsn9
status: closed
deps: [pt-tn1u]
links: []
created: 2026-05-13T22:47:49Z
type: task
priority: 2
assignee: Mark Hougaard
parent: pt-ph8w
---
# Example-based return validation + retry-once

Parse the child's last fenced json block. Shape-match against returns.example: top-level key presence + JS-typeof match per key + first-element type match for arrays. On parse failure or shape mismatch: send one follow-up turn to the child citing the specific failure, parse again. Second failure -> status='validation_failed', rawOutput populated. Inject the rendered example + 'end with single json block' instruction into the child system prompt.

## Acceptance Criteria

Child returning correct shape -> status='ok', data populated. Child returning prose around JSON -> retry, then ok. Child returning wrong shape twice -> validation_failed with rawOutput.

