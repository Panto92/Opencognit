-- Schema alignment: bring PG schema into parity with SQLite schema.
-- Adds missing columns + indexes that existed in SQLite but were never ported to PG.
-- Safe to run on any existing PG install — all statements use IF NOT EXISTS guards.

-- users: oauth columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_id TEXT;

-- companies: workspace directory
ALTER TABLE companies ADD COLUMN IF NOT EXISTS work_dir TEXT;

-- agents: orchestrator, advisor, soul, messaging
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_orchestrator BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS advisor_id TEXT REFERENCES agents(id);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS advisor_strategy TEXT NOT NULL DEFAULT 'none';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS advisor_config TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS soul_path TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS soul_version TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS nachrichten_count INTEGER NOT NULL DEFAULT 0;

-- tasks: maximizer mode flag
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_maximizer_mode BOOLEAN DEFAULT false;

-- chatMessages: agent-to-agent routing
ALTER TABLE chatMessages ADD COLUMN IF NOT EXISTS von_expert_id TEXT;
ALTER TABLE chatMessages ADD COLUMN IF NOT EXISTS thread_id TEXT;

-- projects: whiteboard + workdir
ALTER TABLE projects ADD COLUMN IF NOT EXISTS whiteboard_state TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS work_dir TEXT;

-- settings: move to composite PK (schluessel + unternehmenId)
-- NOTE: Postgres doesn't allow dropping a PK + creating a composite one with IF NOT EXISTS.
-- We only add the column here; the PK migration (if needed) must be handled manually
-- on existing installs as it may conflict with existing single-PK data.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS unternehmen_id TEXT NOT NULL DEFAULT '';

-- Indexes
CREATE INDEX IF NOT EXISTS aufgaben_zugewiesen_an_idx       ON tasks(zugewiesen_an);
CREATE INDEX IF NOT EXISTS aufgaben_unternehmen_status_idx  ON tasks(unternehmen_id, status);
CREATE INDEX IF NOT EXISTS aufgaben_execution_locked_idx    ON tasks(execution_locked_at);
CREATE INDEX IF NOT EXISTS chat_nachrichten_expert_gelesen_idx ON chatMessages(expert_id, gelesen);
CREATE INDEX IF NOT EXISTS chat_nachrichten_expert_am_idx      ON chatMessages(expert_id, erstellt_am);
CREATE INDEX IF NOT EXISTS wakeup_expert_status_idx        ON agentWakeupRequests(expert_id, status);
CREATE INDEX IF NOT EXISTS wakeup_unternehmen_status_idx   ON agentWakeupRequests(unternehmen_id, status);
CREATE INDEX IF NOT EXISTS trace_expert_am_idx             ON traceEvents(expert_id, erstellt_am);
CREATE INDEX IF NOT EXISTS trace_unternehmen_am_idx        ON traceEvents(unternehmen_id, erstellt_am);
CREATE INDEX IF NOT EXISTS kg_subject_valid_idx            ON palaceKg(subject, valid_until);
CREATE INDEX IF NOT EXISTS kg_unternehmen_subject_idx      ON palaceKg(unternehmen_id, subject);
CREATE INDEX IF NOT EXISTS ceo_decision_log_expert_idx     ON ceoDecisionLog(expert_id, erstellt_am);
CREATE INDEX IF NOT EXISTS expert_config_history_expert_idx ON agentConfigHistory(expert_id, changed_at);
CREATE INDEX IF NOT EXISTS worker_nodes_status_idx         ON workerNodes(status, last_heartbeat_at);
