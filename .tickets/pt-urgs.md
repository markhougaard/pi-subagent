---
id: pt-urgs
status: closed
deps: []
links: []
created: 2026-05-13T22:47:40Z
type: task
priority: 1
assignee: Mark Hougaard
parent: pt-ph8w
---
# Scaffold extension: manifest + fork tool registration

Create the Pi extension skeleton: package.json/manifest, register the fork tool with its input schema, stub handler that returns a fake result. Verify Pi loads the extension and surfaces the tool.

## Acceptance Criteria

pi install succeeds locally, fork appears in tool list, calling it returns a stubbed payload that matches the ForkResult shape.

