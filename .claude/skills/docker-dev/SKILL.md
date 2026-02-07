---
name: docker-dev
description: Start, stop, rebuild, or troubleshoot the Docker Compose development environment. Use when working with containers, checking service health, or debugging connectivity issues.
disable-model-invocation: true
argument-hint: "[up|down|rebuild|status|logs|pull-model]"
---

Manage the AeroAgent AI Docker development environment.

## Commands

Based on `$ARGUMENTS`:

- **up** — Run `docker compose up -d` and wait for all health checks to pass
- **down** — Run `docker compose down` (preserves volumes)
- **rebuild** — Run `docker compose up -d --build` to rebuild after code changes
- **status** — Check container status and health for all four services
- **logs** — Show recent logs from all services (or specify a service name as second arg)
- **pull-model** — Run `docker compose exec ollama ollama pull gpt-oss:20b`
- (no argument) — Show current container status and health

## Health Check Verification

After `up` or `rebuild`, verify each service:
1. **ollama** — `curl http://localhost:11434/api/tags` returns 200
2. **browser-use** — `curl http://localhost:8000/health` returns `{"status": "ok"}`
3. **supabase-db** — `docker compose exec supabase-db pg_isready -U postgres` returns ready
4. **nextjs** — `curl http://localhost:3000/api/health` returns 200

Report which services are healthy and which need attention.

## Troubleshooting

If a service fails to start:
- Check `docker compose logs <service>` for error output
- For browser-use: verify shm_size is set and Chromium deps are installed
- For ollama: verify the model is pulled (run pull-model if needed)
- For supabase-db: verify init.sql syntax and volume permissions
- For nextjs: verify build succeeds and environment variables are set
