---
name: implement-task
description: Pick the next TODO task from SPECS.md, implement it, and track progress. Use when implementing features, fixing infrastructure, or progressing through the task backlog.
disable-model-invocation: true
argument-hint: "[task-number e.g. 1.3.1]"
---

Implement a task from the engineering specification.

If `$ARGUMENTS` is provided, implement that specific task (e.g., `1.3.1`).
If no argument is provided, find the next `TODO` task in SPECS.md that has all prerequisites marked `COMPLETED`.

## Workflow

1. **Read SPECS.md** to find the target task and its prerequisites
2. **Verify prerequisites** — all prerequisite tasks must be `COMPLETED`. If not, report which are blocking and suggest the next eligible task instead.
3. **Update SPECS.md** — change the task status from `TODO` to `IN PROGRESS`
4. **Read CLAUDE.md** for project conventions and gotchas
5. **Implement the task** following the acceptance criteria in the Gherkin scenarios for that user story
6. **Verify** — run any relevant build, lint, or test commands to confirm correctness
7. **Update SPECS.md** — change the task status from `IN PROGRESS` to `COMPLETED`
8. **Update the Task Summary table** at the bottom of SPECS.md (increment the Completed count)
9. **Report** what was implemented and what the next eligible task is

## Rules

- Respect the dependency graph: Epic 1 → Epic 2 + Epic 5 → Epic 3 → Epic 4 → Epic 6 → Epic 7
- Only ONE task should be `IN PROGRESS` at a time
- Follow the conventions in CLAUDE.md strictly (Docker service names, native imports, etc.)
- If a task requires creating files, use the directory structure from CLAUDE.md
- Commit after each completed task with message format: `feat(US-X.Y): task description [Z.Z.Z]`

## Project Conventions Quick Reference

### Frontend (TypeScript)
- Next.js 16 App Router, TypeScript strict, Tailwind CSS v4, shadcn/ui
- AI SDK 6 with `createOpenAICompatible` for Ollama
- Drizzle ORM for database, Zod for validation, Jotai for state
- Directory-per-component: `ComponentName/{index.ts, ComponentName.tsx, types.ts, hooks/}`

### Browser-Use (Python)
- Python 3.12, FastAPI, layered architecture: `routes/ → services/ → models/parsers/prompts/`
- browser-use native imports (NOT langchain)
- `ChatOllama(host="http://ollama:11434")` — `host` parameter, NOT `base_url`

### Database
- PostgreSQL 17 + pgvector, Supabase Postgres image
- Tables: agent_ctx, agent_state, memory, flight_results
- Init script: `supabase/init.sql`
