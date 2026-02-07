# AeroAgent AI — Makefile
# Convenience targets for Docker Compose operations

.PHONY: up down logs build pull-model status clean

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

# Pull the Ollama gpt-oss:20b model (run after first `make up`)
pull-model:
	docker compose exec ollama ollama pull gpt-oss:20b

# Show container status and health
status:
	docker compose ps

# Remove all containers, volumes, and networks (WARNING: deletes data)
clean:
	docker compose down -v --remove-orphans
