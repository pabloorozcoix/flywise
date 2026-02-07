---
name: review-specs
description: Review current progress across all tasks in SPECS.md. Shows completed, in-progress, blocked, and next eligible tasks. Use when checking project status or planning what to work on next.
context: fork
agent: Explore
---

Analyze the current state of SPECS.md and report project progress.

## Steps

1. Read `SPECS.md` fully
2. Count tasks by status: `COMPLETED`, `IN PROGRESS`, `TODO`, `BLOCKED`
3. Identify the **next eligible tasks** — tasks whose prerequisites are all `COMPLETED`
4. Check the dependency graph: Epic 1 → Epic 2 + Epic 5 → Epic 3 → Epic 4 → Epic 6

## Report Format

### Progress Summary
- Total tasks: X/81
- Completed: X
- In Progress: X
- TODO: X
- Blocked: X

### By Epic
For each Epic, show: story name, completed/total ratio

### Next Eligible Tasks
List all tasks that can be started now (prerequisites met), grouped by Epic.

### Blockers
List any tasks marked BLOCKED and what they're waiting on.
