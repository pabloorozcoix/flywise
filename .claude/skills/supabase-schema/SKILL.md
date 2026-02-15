---
name: supabase-schema
description: Database schema, pgvector patterns, and SQL conventions for the Supabase PostgreSQL service. Use when working with database tables, migrations, vector embeddings, or supabase/ files.
user-invocable: false
---

# Supabase Database — Schema & Conventions

## Overview

PostgreSQL 17 with pgvector extension, running via `supabase/postgres:17.6.1.081` Docker image. Database-only — no Auth/Storage/Realtime/Studio services.

## Schema (supabase/init.sql)

### Extensions
```sql
CREATE EXTENSION IF NOT EXISTS vector;  -- pgvector for embeddings
```

### Tables

#### agent_ctx — Search parameters
```sql
CREATE TABLE agent_ctx (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin VARCHAR(10) NOT NULL,
    destination VARCHAR(10) NOT NULL,
    departure_date DATE NOT NULL,
    return_date DATE,
    cabin_class VARCHAR(20) DEFAULT 'economy',
    direct_only BOOLEAN DEFAULT FALSE,
    llm_provider VARCHAR(20) DEFAULT 'ollama',
    llm_model VARCHAR(50) DEFAULT 'qwen3:8b',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### agent_state — Execution status tracking
```sql
CREATE TABLE agent_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_ctx_id UUID NOT NULL REFERENCES agent_ctx(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | running | completed | failed
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);
```

#### memory — Agent reasoning with vector embeddings
```sql
CREATE TABLE memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_ctx_id UUID REFERENCES agent_ctx(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536),  -- pgvector 1536-dimension
    step_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### flight_results — Extracted flight data
```sql
CREATE TABLE flight_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_ctx_id UUID NOT NULL REFERENCES agent_ctx(id) ON DELETE CASCADE,
    airline VARCHAR(100),
    departure_time TIMESTAMPTZ,
    arrival_time TIMESTAMPTZ,
    duration VARCHAR(20),
    stops INTEGER DEFAULT 0,
    price DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'USD',
    flight_url TEXT,
    raw_data JSONB,
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes
```sql
-- Foreign key lookups
CREATE INDEX idx_agent_state_ctx_id ON agent_state(agent_ctx_id);
CREATE INDEX idx_agent_state_status ON agent_state(status);
CREATE INDEX idx_memory_ctx_id ON memory(agent_ctx_id);
CREATE INDEX idx_flight_results_ctx_id ON flight_results(agent_ctx_id);

-- Vector similarity search (IVFFlat with cosine distance)
CREATE INDEX idx_memory_embedding ON memory
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### Permissions
```sql
-- Supabase image creates tables as supabase_admin; app connects as postgres
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres;
```

## Drizzle ORM Schema (frontend/src/db/schema.ts)

The Next.js frontend uses Drizzle ORM (`drizzle-orm/pg-core`) to mirror the SQL schema:

- Custom `vector` column type for pgvector compatibility
- Tables: `agentCtx`, `agentState`, `memory`, `flightResults`
- Relations defined via foreign keys to `agentCtx.id`

## Connection

| Context | Connection String |
|---------|------------------|
| Inside Docker | `postgresql://postgres:postgres@supabase-db:5432/postgres` |
| From host | `postgresql://postgres:postgres@127.0.0.1:5432/postgres` |
| Admin user | `supabase_admin` (for ALTER TABLE, grants) |
| App user | `postgres` (for queries) |

## pgvector Patterns

### Insert with embedding
```sql
INSERT INTO memory (agent_ctx_id, content, embedding, step_number)
VALUES ($1, $2, $3::vector, $4);
```

### Cosine similarity search
```sql
SELECT id, content, 1 - (embedding <=> $1::vector) AS similarity
FROM memory
WHERE agent_ctx_id = $2
ORDER BY embedding <=> $1::vector
LIMIT 5;
```

## Conventions

- All IDs are UUIDs (`gen_random_uuid()`)
- Timestamps use `TIMESTAMPTZ` with `DEFAULT NOW()`
- Foreign keys use `ON DELETE CASCADE` for cleanup
- Status fields use `CHECK` constraints for valid values
- JSONB columns (`raw_data`) for lossless flexible storage
- Vector dimension is 1536 (Ollama embedding model output size)
- Init script runs once on first container start (mounted to `/docker-entrypoint-initdb.d/`)

## Gotchas

- The Supabase Postgres image is **database-only** — no Supabase services
- Tables created by `supabase_admin` need explicit GRANT to `postgres` role
- To modify schema on running containers, use `psql -U supabase_admin`
- The `supabase_data` volume persists data across restarts
- `make clean` destroys the volume — all data is lost
- Vector index (IVFFlat) needs `lists=100` for small datasets
