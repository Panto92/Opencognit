-- Migration 0038: Semantic Memory Embeddings (PostgreSQL)
-- Base table for memory embeddings. FTS extensions are added in 0031.

CREATE TABLE IF NOT EXISTS memory_embeddings (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES unternehmen(id),
  expert_id TEXT REFERENCES experten(id),
  quelle TEXT NOT NULL DEFAULT 'manual',
  quelle_id TEXT,
  chunk_text TEXT NOT NULL,
  embedding_json TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'openai/text-embedding-3-small',
  token_count INTEGER DEFAULT 0,
  char_count INTEGER NOT NULL DEFAULT 0,
  tags TEXT,
  erstellt_am TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS memory_embeddings_unternehmen_idx ON memory_embeddings(unternehmen_id);
CREATE INDEX IF NOT EXISTS memory_embeddings_expert_idx ON memory_embeddings(expert_id);
CREATE INDEX IF NOT EXISTS memory_embeddings_quelle_idx ON memory_embeddings(quelle, quelle_id);
