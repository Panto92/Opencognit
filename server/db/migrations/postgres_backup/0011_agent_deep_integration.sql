-- Migration 0011: Agent Deep Integration — iterative summaries + full-text search
-- Note: SQLite FTS5 virtual tables are not available in PostgreSQL.
-- Full-text search on chatMessages and palaceDrawers uses tsvector + GIN indexes.

CREATE TABLE IF NOT EXISTS palaceSummaries (
  id TEXT PRIMARY KEY,
  expert_id TEXT NOT NULL REFERENCES agents(id),
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  inhalt TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  komprimierte_turns INTEGER NOT NULL DEFAULT 0,
  erstellt_am TEXT NOT NULL,
  aktualisiert_am TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_palace_summaries_expert ON palaceSummaries(expert_id);

-- Full-text search via tsvector (PostgreSQL-native, replaces FTS5)
ALTER TABLE chatMessages ADD COLUMN IF NOT EXISTS nachricht_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(nachricht, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_chat_nachrichten_fts ON chatMessages USING GIN(nachricht_tsv);

ALTER TABLE palaceDrawers ADD COLUMN IF NOT EXISTS inhalt_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(inhalt, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_palace_drawers_fts ON palaceDrawers USING GIN(inhalt_tsv);
