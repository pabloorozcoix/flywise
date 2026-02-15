-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create postgres role if it doesn't exist (Supabase image may not create it until after init scripts)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres WITH LOGIN PASSWORD 'postgres' SUPERUSER;
  END IF;
END
$$;

-- Grant schema usage to postgres role
GRANT USAGE ON SCHEMA public TO postgres;
GRANT CREATE ON SCHEMA public TO postgres;

-- Agent context: stores search parameters for each search request
CREATE TABLE IF NOT EXISTS agent_ctx (
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

-- Agent state: tracks execution status of each search
CREATE TABLE IF NOT EXISTS agent_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_ctx_id UUID NOT NULL REFERENCES agent_ctx(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

-- Memory: stores agent reasoning steps with vector embeddings
CREATE TABLE IF NOT EXISTS memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_ctx_id UUID REFERENCES agent_ctx(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(1536),
    step_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flight results: stores extracted flight data
CREATE TABLE IF NOT EXISTS flight_results (
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

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_agent_state_ctx_id ON agent_state(agent_ctx_id);
CREATE INDEX IF NOT EXISTS idx_agent_state_status ON agent_state(status);
CREATE INDEX IF NOT EXISTS idx_memory_ctx_id ON memory(agent_ctx_id);
CREATE INDEX IF NOT EXISTS idx_flight_results_ctx_id ON flight_results(agent_ctx_id);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_memory_embedding ON memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Grant all table and sequence privileges to postgres role
-- (Supabase Postgres image creates tables as supabase_admin, but the app connects as postgres)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
