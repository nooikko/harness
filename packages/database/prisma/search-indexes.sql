-- Search indexes for full-text search (FTS)
-- Run after db:push to add GIN indexes for tsvector queries.
-- Idempotent: safe to re-run.
--
-- Usage: psql $DATABASE_URL -f packages/database/prisma/search-indexes.sql
-- Or:    pnpm --filter database db:search-indexes

-- Message content FTS (largest table, biggest perf impact)
CREATE INDEX IF NOT EXISTS idx_message_search
  ON "Message" USING GIN (to_tsvector('english', "content"));

-- Thread name FTS
CREATE INDEX IF NOT EXISTS idx_thread_search
  ON "Thread" USING GIN (to_tsvector('english', coalesce("name", '')));

-- File name + extracted text FTS
CREATE INDEX IF NOT EXISTS idx_file_search
  ON "File" USING GIN (to_tsvector('english', coalesce("name", '') || ' ' || coalesce("extractedText", '')));

-- Agent name + role FTS (small table, but included for consistency)
CREATE INDEX IF NOT EXISTS idx_agent_search
  ON "Agent" USING GIN (to_tsvector('english', coalesce("name", '') || ' ' || coalesce("slug", '') || ' ' || coalesce("role", '')));

-- Project name + description FTS
CREATE INDEX IF NOT EXISTS idx_project_search
  ON "Project" USING GIN (to_tsvector('english', coalesce("name", '') || ' ' || coalesce("description", '')));
