-- Migration 0021: Expert config history for rollback

CREATE TABLE IF NOT EXISTS agentConfigHistory (
  id TEXT PRIMARY KEY,
  expert_id TEXT NOT NULL REFERENCES agents(id),
  changed_at TEXT NOT NULL,
  changed_by TEXT,
  config_json TEXT NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS expert_config_history_expert_idx ON agentConfigHistory(expert_id, changed_at);
