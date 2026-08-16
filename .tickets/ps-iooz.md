---
id: ps-iooz
status: closed
deps: [ps-bq6o]
links: []
created: 2026-05-14T21:06:27Z
type: task
priority: 2
assignee: Mark Hougaard
parent: ps-r0ek
---
# drive: implement detectStall() with tests

Pure function: heuristic detection of the small-model stall pattern.

Signature: detectStall(text: string, stepText: string): boolean

Returns true if ANY of:
1. Text contains deferral phrase (case-insensitive): 'would you like', 'shall i', 'should i', 'let me know', 'do you want me to', 'if you'd like', 'if you want', 'please let me know'
2. Text ends with '?' AND no code block present
3. Step implies output (write|add|create|implement|edit|modify|update|fix) AND text length < 60 chars
4. Reflection-only opener (/^(i see|looking at|the file|this file|examining|i found|i notice|i can see)/i) AND no code block AND text length < 400 chars

Tests must cover all four signals as positives AND realistic non-stalled responses as negatives. Bias toward false negatives — re-prompting a valid response wastes tokens and confuses the model.

## Acceptance Criteria

- detectStall exported from src/drive.ts
- Tests cover each signal in isolation and combination
- Healthy responses (code blocks, structured analysis, decisive answers) all return false
- The specific gemma4-think failure pattern from the original transcript (read file, reflect, stop) returns true


## Notes

**2026-05-14T21:11:38Z**

detectStall in src/drive.ts. Four signals: deferral phrases, trailing '?' without code block, OUTPUT_VERBS step + <60 chars + no code block, reflection-only opener + no code block + <400 chars. Tuning note: length-based stall is suppressed when a code block is present (a short response with code is actionable). Tests cover all four signals + the gemma4-think reflection-only failure mode + healthy negatives.
