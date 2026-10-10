-- Migration 0040: Learned Skills (auto-extracted recipes from successful work cycles)

CREATE TABLE IF NOT EXISTS learned_skills (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES unternehmen(id) ON DELETE CASCADE,
  source_agent_id TEXT REFERENCES experten(id) ON DELETE SET NULL,
  source_task_id TEXT REFERENCES aufgaben(id) ON DELETE SET NULL,
  source_run_id TEXT REFERENCES arbeitszyklen(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  pattern TEXT NOT NULL,
  recipe TEXT NOT NULL,
  keywords TEXT,
  confidence INTEGER NOT NULL DEFAULT 50,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
  extracted_by TEXT NOT NULL DEFAULT 'heuristic' CHECK(extracted_by IN ('heuristic', 'llm')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS learned_skills_company_idx ON learned_skills(unternehmen_id);
CREATE INDEX IF NOT EXISTS learned_skills_keywords_idx ON learned_skills(unternehmen_id, is_disabled);
