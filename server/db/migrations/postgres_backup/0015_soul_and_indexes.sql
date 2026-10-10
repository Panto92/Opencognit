-- Migration 0015: SOUL Document fields + Performance Indexes
ALTER TABLE agents ADD COLUMN IF NOT EXISTS soul_path TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS soul_version TEXT;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_trace_expert_id ON traceEvents(expert_id);
CREATE INDEX IF NOT EXISTS idx_trace_erstellt_am ON traceEvents(erstellt_am);
CREATE INDEX IF NOT EXISTS idx_wakeup_expert_status ON agentWakeupRequests(expert_id, status);
CREATE INDEX IF NOT EXISTS idx_aufgaben_company_status ON tasks(unternehmen_id, status);
CREATE INDEX IF NOT EXISTS idx_kosten_expert_erstellt ON costEntries(expert_id, erstellt_am);
CREATE INDEX IF NOT EXISTS idx_zyklen_expert_erstellt ON workCycles(expert_id, erstellt_am);
