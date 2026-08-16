---
id: ps-nhog
status: closed
deps: [ps-w8kd]
links: []
created: 2026-05-14T21:06:54Z
type: task
priority: 2
assignee: Mark Hougaard
parent: ps-r0ek
---
# drive: register '/drive' command in src/index.ts

User-facing slash command. The user types '/drive <goal>' and the harness drives the small model to completion.

Handler steps:
1. const goal = args.trim(); if empty → ctx.ui.notify('Usage: /drive <goal>', 'error') and return
2. const context = await ctx.ui.editor(`Context for: "${goal}"`, 'Paste relevant file contents...')
   - if undefined → user cancelled, return silently
3. discoverAgents(ctx.cwd) → find 'architect'; notify error if missing
4. readSettings()
5. ctx.ui.setWorkingMessage(`Drive: ${goal.slice(0, 50)}`)
6. new DriveEngine().run({...}, partial => { extract text from partial.content; ctx.ui.notify(text, 'info') })
7. ctx.ui.notify(`Drive complete: ${steps.length} steps, ${stalledCount} stalls`, 'info')
8. const assembled = result.steps.map(s => `## Step ${s.step.index}: ${s.step.text}\n${s.finalOutput}`).join('\n\n')
9. ctx.ui.pasteToEditor(assembled) — drops the work into the input editor for review

The pasteToEditor at the end is the critical UX choice: assembled output goes into the editor (not auto-sent), so the user reviews before submitting to the parent model.

## Acceptance Criteria

- '/drive' appears in pi command list
- Empty goal shows usage hint, doesn't error
- Cancelling the editor cleanly returns without side effects
- After completion, assembled step outputs are visible in the editor


## Notes

**2026-05-14T21:17:53Z**

Registered '/drive' command in src/index.ts. Flow: parse goal, error if empty -> editor() for context, return silently on cancel -> discover architect, error if missing -> setWorkingMessage -> engine.run with onUpdate that notifies on each progress message -> clear setWorkingMessage -> notify completion stats -> pasteToEditor(assembled). Test added asserting handler + description exist.
