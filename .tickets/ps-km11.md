---
id: ps-km11
status: closed
deps: [ps-bq6o]
links: []
created: 2026-05-14T21:06:18Z
type: task
priority: 2
assignee: Mark Hougaard
parent: ps-r0ek
---
# drive: implement extractPlan() with tests

Pure function: parse a numbered plan out of gemma4-think output.

Algorithm:
1. Try matching a fenced code block first; if found, parse its contents
2. Fall back to parsing the raw text
3. Regex per line: /^(\d+)[.)]\s*(.+)$/gm
4. Require ≥ 2 steps to accept (rejects single-line noise)
5. Reject if indices are non-contiguous by more than steps.length + 1 (corrupted)
6. Cap result at 10 steps

Tests should cover:
- Bare numbered list
- List inside fenced code block
- List with header/prose before it
- Single-step output (rejected → empty array)
- Mixed numbering like '1.' and '1)'
- Truly empty / non-list input → empty array

## Acceptance Criteria

- extractPlan(text: string): PlanStep[] exported from src/drive.ts
- Test file (src/drive.test.js or similar) passes all cases above
- Returns [] for unparseable input rather than throwing


## Notes

**2026-05-14T21:11:38Z**

extractPlan + parseNumberedList in src/drive.ts. Tests in src/drive.test.js cover: bare list, fenced-block, prose-prefix, single-step rejection, mixed 1./1) numbering, empty input, non-contiguous indices, 10-step cap, fenced-block fallback to raw text. All 51 tests pass.
