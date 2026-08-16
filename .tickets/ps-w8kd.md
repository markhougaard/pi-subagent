---
id: ps-w8kd
status: closed
deps: [ps-km11, ps-iooz]
links: []
created: 2026-05-14T21:06:37Z
type: task
priority: 2
assignee: Mark Hougaard
parent: ps-r0ek
tags: [drive, core]
---
# drive: implement DriveEngine.run() loop + prompt templates

The orchestration core. Implements the three-phase loop using runSubagent (from spawn.ts) as the only execution primitive.

Embedded prompt templates (see plan file for exact wording):
- buildPlanPrompt(goal, context)
- buildExecutePrompt(goal, plan, completedSteps, step)
- buildRecoveryPrompt(goal, step, stalledOutput, outputHint)
- outputHintFor(stepText): 'Write the code...' | 'Give the finding as a bullet list...' | etc.

Loop:
1. runSubagent with plan prompt → extractPlan
2. If empty plan → one recovery call → if still empty return DriveResult with error in rawPlanOutput
3. For each PlanStep:
   a. runSubagent with execute prompt
   b. detectStall(text, step.text)
   c. If stalled: one runSubagent recovery call; mark wasStalled=true; recoveryOutput=text; finalOutput=recoveryOutput
   d. Else: wasStalled=false; recoveryOutput=null; finalOutput=rawOutput
   e. Accumulate finalOutput into completedSteps block for next iteration
   f. Check signal?.aborted between steps; break with partial result if aborted
4. Sum usage across plan + all step + all recovery calls into totalUsage

onUpdate (if provided) should fire after plan extraction and after each step with progress text.

## Acceptance Criteria

- DriveEngine.run() returns a DriveResult with plan, steps[], stalledCount, totalUsage
- Stall recovery does exactly one extra call per step (never two)
- Aborted signal yields a partial DriveResult, not a thrown exception
- Integration test using a mocked runSubagent confirms the loop sequence


## Notes

**2026-05-14T21:14:16Z**

DriveEngine.run + prompt builders + outputHintFor in src/drive.ts. Runner injected via constructor for testability (defaults to runSubagent). 14 new tests cover: happy path, plan-phase recovery success, plan-phase recovery failure (returns empty plan, no step calls), step stall + one recovery, recovery-also-stalls (no third attempt), abort mid-loop yields partial result, usage accumulation across plan+steps+recoveries, and the three prompt builders. 65/65 tests pass, typecheck clean.
