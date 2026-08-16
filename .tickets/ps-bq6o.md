---
id: ps-bq6o
status: closed
deps: []
links: []
created: 2026-05-14T21:06:11Z
type: task
priority: 2
assignee: Mark Hougaard
parent: ps-r0ek
---
# drive: scaffold src/drive.ts with shared types

Create src/drive.ts and define the type surface used by every later ticket. No logic yet — just the interfaces and a placeholder DriveEngine class.

Exports:
- interface DriveContext { goal, context, agent: AgentConfig, settings, cwd, signal? }
- interface PlanStep { index: number, text: string }
- interface StepResult { step, rawOutput, wasStalled, recoveryOutput, finalOutput, usage }
- interface DriveResult { goal, plan, steps, stalledCount, totalUsage, rawPlanOutput }
- class DriveEngine (run() throws 'not implemented' for now)

## Acceptance Criteria

- src/drive.ts compiles with no errors
- All four interfaces exported with the fields above
- DriveEngine class exported with run() signature matching (ctx, onUpdate?) => Promise<DriveResult>


## Notes

**2026-05-14T21:09:48Z**

Scaffold landed in worktree-drive-scaffold branch. src/drive.ts exports DriveContext, PlanStep, StepResult, DriveResult, DriveProgressUpdate, DriveOnUpdate, and DriveEngine (run() throws 'not implemented'). npm run typecheck passes.
