---
id: pt-pisr
status: closed
deps: [pt-tn1u]
links: []
created: 2026-05-13T22:47:52Z
type: task
priority: 2
assignee: Mark Hougaard
parent: pt-ph8w
---
# Effort profile mapping (Fast/Plan/Code)

Read effortProfiles from ~/.pi/agent/settings.json under a 'pi-parallel-subagent' block, same pattern as pi-fork. Map effort: 'fast'|'balanced'|'deep' to {provider, model, thinking}. Pass through as Pi child flags. Default effort when omitted: 'balanced'. Invalid/missing profile -> child uses Pi default (with warning in result.error).

## Acceptance Criteria

Task with effort:'deep' spawns child with the configured deep model. Task without effort spawns child with the balanced model. Missing config -> default Pi model, warning recorded.

