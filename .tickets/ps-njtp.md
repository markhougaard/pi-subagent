---
id: ps-njtp
status: open
deps: []
links: []
created: 2026-05-14T09:09:38Z
type: chore
priority: 3
assignee: Mark Hougaard
---
# Bump GitHub Actions to v5 (Node 24 ready)

actions/checkout@v4 and actions/setup-node@v4 use Node 20 internally. GitHub will force Node 24 on June 2, 2026 and remove Node 20 on Sept 16, 2026. Bump both to @v5 in .github/workflows/ci.yml and publish.yml when next touching the workflows (e.g. during the trusted-publisher workflow cleanup).

## Acceptance Criteria

Both workflow files use actions/checkout@v5 and actions/setup-node@v5. CI green on a no-op commit.

