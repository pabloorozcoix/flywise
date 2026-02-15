---
name: env-config
description: Environment variable configuration, Docker networking, and service connection strings for AeroAgent AI. Use when configuring environment variables, debugging connection strings, or setting up the project.
user-invocable: false
---

# Environment Configuration

## Environment Files

| File | Purpose | Committed |
|------|---------|-----------|
| `.env.example` | Template with defaults | Yes |
| `.env` | Active config (copy from .env.example) | No (.gitignore) |

## Variables

### Ollama
```bash
OLLAMA_HOST=http://ollama:11434     # Inside Docker (required)
OLLAMA_MODEL=qwen3:8b               # Model for browser-use agent
```

### Browser-Use
```bash
BROWSER_USE_API_URL=http://browser-use:8000  # Next.js → browser-use
NEXTJS_CALLBACK_URL=http://nextjs:3000/api/callback/search-complete  # browser-use → Next.js
MAX_CONCURRENT_SEARCHES=3           # Semaphore limit for parallel searches
```

### Database
```bash
DATABASE_URL=postgresql://postgres:postgres@supabase-db:5432/postgres  # Inside Docker
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
```

### OpenAI (Optional)
```bash
OPENAI_API_KEY=                     # Optional — enables gpt-4.1-mini in browser-use
```

### Application
```bash
CACHE_TTL_MINUTES=60                # Flight result cache TTL
```

## Docker Networking Rules

All inter-service communication uses Docker service names on the `aeroagent` bridge network:

| From | To | URL |
|------|----|-----|
| Next.js | Ollama | `http://ollama:11434` |
| Next.js | browser-use | `http://browser-use:8000` |
| Next.js | PostgreSQL | `postgresql://postgres:postgres@supabase-db:5432/postgres` |
| browser-use | Ollama | `http://ollama:11434` |
| browser-use | Next.js | `http://nextjs:3000/api/callback/search-complete` |
| Host browser | Next.js | `http://localhost:3000` |
| Host browser | Ollama | `http://localhost:11434` |
| Host browser | browser-use | `http://localhost:8000` |
| Host tool | PostgreSQL | `postgresql://postgres:postgres@127.0.0.1:5432/postgres` |

**CRITICAL**: Never use `localhost` for service-to-service communication inside Docker. Always use Docker service names.

## Port Mapping

| Service | Container Port | Host Port |
|---------|---------------|-----------|
| Next.js | 3000 | 3000 |
| Ollama | 11434 | 11434 |
| browser-use | 8000 | 8000 |
| PostgreSQL | 5432 | 5432 |

## Setup

```bash
cp .env.example .env    # Copy template
# Edit .env if needed (defaults work out of the box)
make dev                # Start all services
make pull-model         # Pull LLM model (first time only)
```
