-- Migration 0010: Native Memory — Palace system tables
-- Note: PostgreSQL does not support SQLite FTS5 virtual tables.
-- Full-text search is handled via tsvector columns and GIN indexes where needed.

CREATE TABLE IF NOT EXISTS palaceWings (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  expert_id TEXT NOT NULL REFERENCES agents(id),
  name TEXT NOT NULL,
  erstellt_am TEXT NOT NULL,
  aktualisiert_am TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_palace_wings_expert ON palaceWings(expert_id);

CREATE TABLE IF NOT EXISTS palaceDrawers (
  id TEXT PRIMARY KEY,
  wing_id TEXT NOT NULL REFERENCES palaceWings(id),
  room TEXT NOT NULL,
  inhalt TEXT NOT NULL,
  erstellt_am TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_palace_drawers_wing ON palaceDrawers(wing_id);
CREATE INDEX IF NOT EXISTS idx_palace_drawers_room ON palaceDrawers(wing_id, room);

CREATE TABLE IF NOT EXISTS palaceDiary (
  id TEXT PRIMARY KEY,
  wing_id TEXT NOT NULL REFERENCES palaceWings(id),
  datum TEXT NOT NULL,
  thought TEXT,
  action TEXT,
  knowledge TEXT,
  erstellt_am TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_palace_diary_wing ON palaceDiary(wing_id);

CREATE TABLE IF NOT EXISTS palaceKg (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object TEXT NOT NULL,
  valid_from TEXT,
  valid_until TEXT,
  erstellt_von TEXT,
  erstellt_am TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_palace_kg_subject ON palaceKg(subject);
CREATE INDEX IF NOT EXISTS idx_palace_kg_company ON palaceKg(unternehmen_id);
