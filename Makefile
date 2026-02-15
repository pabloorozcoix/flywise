# AeroAgent AI — Makefile
# Convenience targets for Docker Compose operations

COMPOSE_DEV := docker compose -f docker-compose.yml -f docker-compose.dev.yml

.PHONY: up down logs build pull-model status clean \
        dev dev-down dev-build dev-logs dev-status \
        dev-frontend dev-browser-use dev-install-frontend dev-install-python \
        shell-frontend shell-browser-use shell-db

# ─── Production (full build) ────────────────────────────────────

# Start all services in detached mode
up:
	docker compose up -d

# Stop all services (preserves volumes)
down:
	docker compose down

# View logs for all services (follow mode)
logs:
	docker compose logs -f

# Rebuild and restart all services
build:
	docker compose up -d --build

# Pull the Ollama qwen3:8b model (run after first `make up`)
pull-model:
	docker compose exec ollama ollama pull qwen3:8b

# Show container status and health
status:
	docker compose ps

# Remove all containers, volumes, and networks (WARNING: deletes data)
clean:
	docker compose down -v --remove-orphans

# ─── Development (volume-mounted, hot reload) ───────────────────

# Start all services in dev mode (live code reloading)
dev:
	$(COMPOSE_DEV) up -d

# Stop dev services
dev-down:
	$(COMPOSE_DEV) down

# Rebuild dev containers (e.g. after adding npm/pip dependencies)
dev-build:
	$(COMPOSE_DEV) up -d --build

# View dev logs
dev-logs:
	$(COMPOSE_DEV) logs -f

# Dev status
dev-status:
	$(COMPOSE_DEV) ps

# Follow logs for a single dev service
dev-frontend:
	$(COMPOSE_DEV) logs -f nextjs

dev-browser-use:
	$(COMPOSE_DEV) logs -f browser-use

# ─── Dependency management (run inside dev containers) ──────────

# Install a new npm package: make dev-install-frontend PKG="lodash @types/lodash"
dev-install-frontend:
	$(COMPOSE_DEV) exec nextjs npm install $(PKG)

# Install a new pip package: make dev-install-python PKG="requests"
dev-install-python:
	$(COMPOSE_DEV) exec browser-use uv pip install --system $(PKG)

# ─── Interactive shells ─────────────────────────────────────────

shell-frontend:
	$(COMPOSE_DEV) exec nextjs sh

shell-browser-use:
	$(COMPOSE_DEV) exec browser-use bash

shell-db:
	docker compose exec supabase-db psql -U postgres
