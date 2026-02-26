---
name: review-specs
description: Review SPECS.md for accuracy against the actual codebase. Verifies that documented epics, user stories, API routes, components, and file inventories match real implementation. Use when checking if SPECS.md is in sync with the code.
context: fork
agent: Explore
---

Audit SPECS.md against the actual codebase and report any discrepancies.

## Steps

1. Read `SPECS.md` fully — it documents 11 epics, all `COMPLETED`
2. Spot-check key facts against the actual code:
   - **Epic 1**: Docker files exist and match described services (docker-compose.yml, docker-compose.dev.yml, Dockerfiles, Makefile)
   - **Epic 2**: `supabase/init.sql` tables/columns match SPECS, `frontend/src/db/schema.ts` Drizzle schema matches
   - **Epic 3**: `browser-service/app/` layered architecture matches (routes, services, parsers, models, constants, prompts)
   - **Epic 4**: Pages at correct routes (`/`, `/credits`, `/history`, `/history/[id]`, `/results`, `/results/[id]`, `/settings`)
   - **Epic 5**: All 16 API routes exist and match documented endpoints
   - **Epic 6**: All components exist (SearchForm, FlightCard, ExecutionTimeline, ExecutionsTable, AgentStatus, Navbar, Footer, settings, 12 shadcn/ui)
   - **Epic 7**: Library files exist (localOllama, supabase, embeddings, utils, schemas, types — including execution.ts)
   - **Epic 8**: package.json dependencies match, build configs present
   - **Epic 9**: Browser-service tests (17 files, 100% coverage target)
   - **Epic 10**: Terminate search (cancel endpoint, cancelled status)
   - **Epic 11**: Frontend tests (62 test files, Vitest + Testing Library + MSW)
3. Verify the "Dead Code" section is still accurate
4. Verify the "Data Flow" diagram matches actual code paths

## Report Format

### Sync Status
State whether SPECS.md is **in sync** or **out of sync** with the codebase.

### By Epic (1–8)
For each Epic, confirm: all user stories documented, file paths valid, behavior descriptions accurate.

### Discrepancies
List any differences found between SPECS.md and the actual code:
- Missing files or routes
- Changed behavior not reflected in SPECS
- New code not documented in SPECS
- Dead code status changes

### Architecture Notes
Highlight any new patterns, refactoring opportunities, or technical debt discovered during the audit.
