---
name: docker-dev
description: Start, stop, rebuild, or troubleshoot the Docker Compose development environment. Use when working with containers, checking service health, or debugging connectivity issues.
disable-model-invocation: true
argument-hint: "[up|down|rebuild|status|logs|pull-model|clean]"
---

Manage the AeroAgent AI Docker development environment.

## Commands

Based on `$ARGUMENTS`:

| Argument | Makefile Target | Docker Command |
|----------|----------------|----------------|
| **up** | `make dev` | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d` |
| **down** | `make dev-down` | Same with `down` (preserves volumes) |
| **rebuild** | `make dev-build` | Same with `up -d --build` |
| **status** | `make dev-status` | Same with `ps` |
| **logs** | `make dev-logs` | Same with `logs -f` |
| **pull-model** | `make pull-model` | `docker compose exec ollama ollama pull qwen3:8b` |
| **clean** | `make clean` | `docker compose down -v --remove-orphans` (WARNING: destroys data) |
| (none) | — | Show container status and health |

## Dev vs Production

| Aspect | Dev (`make dev`) | Production (`make up`) |
|--------|-----------------|----------------------|
| Config | `docker-compose.yml` + `docker-compose.dev.yml` | `docker-compose.yml` only |
| Frontend | `next dev` (HMR) + volume mounts | `node server.js` (static build) |
| Browser-Use | `uvicorn --reload` + volume mount | `uvicorn` (no reload) |
| Dockerfile | `Dockerfile.dev` (single-stage) | `Dockerfile` (multi-stage) |
| Rebuild needed | Only for new dependencies | For all code changes |

## Health Check Verification

After `up` or `rebuild`, verify each service:
1. **ollama** — `curl -s http://localhost:11434/api/tags` → 200
2. **browser-use** — `curl -s http://localhost:8000/health` → `{"status": "ok"}`
3. **supabase-db** — `docker compose exec supabase-db pg_isready -U postgres` → ready
4. **nextjs** — `curl -s http://localhost:3000/api/health` → 200

Report which services are healthy and which need attention.

## Dependency Management

```bash
# Add npm package (inside running dev container)
make dev-install-frontend PKG="lodash @types/lodash"

# Add pip package (inside running dev container)
make dev-install-python PKG="requests"

# After adding dependencies, rebuild to persist in lockfile
make dev-build
```

## Interactive Shells

```bash
make shell-frontend     # sh into Next.js container
make shell-browser-use  # bash into browser-use container
make shell-db           # psql into PostgreSQL
```

## Troubleshooting

If a service fails to start:
- Check `docker compose -f docker-compose.yml -f docker-compose.dev.yml logs <service>` for errors
- For **browser-use**: verify `shm_size: '2gb'` is set; check Chromium deps
- For **ollama**: verify model is pulled (`make pull-model`); check disk space
- For **supabase-db**: verify init.sql syntax; check grants to postgres role
- For **nextjs**: verify TypeScript build; check env vars in docker-compose.yml
