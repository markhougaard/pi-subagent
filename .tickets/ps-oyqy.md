---
id: ps-oyqy
status: closed
deps: [ps-w8kd]
links: []
created: 2026-05-14T21:06:44Z
type: task
priority: 2
assignee: Mark Hougaard
parent: ps-r0ek
---
# drive: register 'drive' tool in src/index.ts

Wire DriveEngine into the extension as a tool the parent pi model can call.

TypeBox params:
- goal: Type.String (required)
- context: Type.String (required — caller-assembled; engine does not read files)
- agent: Type.Optional(Type.String) — defaults to 'architect'

execute() handler:
1. discoverAgents(ctx.cwd) → find agent by name (default 'architect')
2. Return same error shape as subagent tool if not found (isError: true)
3. readSettings()
4. new DriveEngine().run({...}, onUpdate)
5. Format final assembled output: '## Step N: <text>\n<finalOutput>' per step
6. Return { content: [{type: 'text', text: assembled}], details: driveResult }

Use the same imports already present in index.ts (discoverAgents, readSettings, Type from typebox).

## Acceptance Criteria

- Tool 'drive' appears in pi tool listing after loading extension
- Calling with unknown agent returns isError: true with friendly message
- details payload contains the full DriveResult for inspection


## Notes

**2026-05-14T21:17:53Z**

Registered 'drive' tool in src/index.ts. Params: goal (req), context (req), agent (optional, default 'architect'). Threads onUpdate from Pi through to DriveEngine via partial DriveResult shape. Returns isError:true when plan extraction fails. Otherwise returns assembled '## Step N: <text>\n<finalOutput>' output with a header summarizing step count + stall count. Test added asserting schema shape and required fields.
