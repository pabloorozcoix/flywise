---
name: debug-container
description: Debug Docker container issues, inspect logs, check health, and troubleshoot connectivity between services. Use when a container is unhealthy, a service is unreachable, or you need to inspect runtime behavior.
disable-model-invocation: true
argument-hint: "[service-name e.g. nextjs, browser-use, ollama, supabase-db]"
---

Debug and troubleshoot Docker container issues for `$ARGUMENTS`.

## Diagnostic Steps

### 1. Check Container Status
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps
```

### 2. Inspect Container Logs
```bash
# Recent logs (last 100 lines)
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs --tail=100 $ARGUMENTS

# Follow logs in real-time
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f $ARGUMENTS
```

### 3. Health Check Status
```bash
docker inspect --format='{{.State.Health.Status}}' browser-use-$ARGUMENTS-1
docker inspect --format='{{json .State.Health}}' browser-use-$ARGUMENTS-1 | python3 -m json.tool
```

### 4. Service-Specific Health Endpoints

| Service | Health Command |
|---------|---------------|
| **nextjs** | `curl -s http://localhost:3000/api/health` |
| **browser-use** | `curl -s http://localhost:8000/health` |
| **ollama** | `curl -s http://localhost:11434/api/tags` |
| **supabase-db** | `docker compose exec supabase-db pg_isready -U postgres` |

### 5. Inter-Service Connectivity
```bash
# Test from inside a container
docker compose exec nextjs sh -c "curl -s http://ollama:11434/api/tags"
docker compose exec nextjs sh -c "curl -s http://browser-use:8000/health"
docker compose exec browser-use curl -s http://ollama:11434/api/tags
```

### 6. Interactive Shell
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec $ARGUMENTS sh
# For browser-use (has bash):
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec browser-use bash
```

### 7. Resource Usage
```bash
docker stats --no-stream
```

## Common Issues

### browser-use fails to start
- Check `shm_size: '2gb'` is set in docker-compose.yml
- Check Chromium deps: `chromium`, `libnss3`, `libxss1`, `libasound2`, `libatk-bridge2.0-0`, `libgtk-3-0`
- Check logs for Python import errors or missing dependencies

### ollama model not available
- List models: `docker compose exec ollama ollama list`
- Pull model: `docker compose exec ollama ollama pull qwen3:8b`
- Check available disk space: `docker system df`

### supabase-db permission errors
- Tables created by `supabase_admin`, app connects as `postgres`
- Fix grants: `docker exec browser-use-supabase-db-1 psql -U supabase_admin -d postgres -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;"`

### nextjs build errors
- Check TypeScript compilation: `docker compose exec nextjs npm run build`
- Check for missing environment variables in docker-compose.yml

### Network connectivity
- All services must be on the `aeroagent` network
- Use Docker service names (not localhost) for inter-service communication
- Verify network: `docker network inspect browser-use_aeroagent`

## Report Format

After diagnosis, report:
1. Container status (running/exited/unhealthy)
2. Key error messages from logs
3. Health check results
4. Root cause assessment
5. Recommended fix
