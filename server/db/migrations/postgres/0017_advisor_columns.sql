-- Migration 0017: Advisor/Supervisor columns on agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS advisor_id TEXT REFERENCES agents(id);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS advisor_strategy TEXT NOT NULL DEFAULT 'none';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS advisor_config TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS nachrichten_count INTEGER NOT NULL DEFAULT 0;
