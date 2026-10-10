-- Migration 0014: Agent Coordination — P2P Messaging & Multi-Agent Meetings

ALTER TABLE chatMessages ADD COLUMN IF NOT EXISTS von_expert_id TEXT;
ALTER TABLE chatMessages ADD COLUMN IF NOT EXISTS thread_id TEXT;

CREATE TABLE IF NOT EXISTS agentMeetings (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  titel TEXT NOT NULL,
  veranstalter_expert_id TEXT NOT NULL REFERENCES agents(id),
  teilnehmer_ids TEXT NOT NULL,
  antworten TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'running',
  ergebnis TEXT,
  erstellt_am TEXT NOT NULL,
  abgeschlossen_am TEXT
);

CREATE INDEX IF NOT EXISTS idx_meetings_company ON agentMeetings(unternehmen_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON agentMeetings(status);
CREATE INDEX IF NOT EXISTS idx_chat_thread ON chatMessages(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chat_von_expert ON chatMessages(von_expert_id) WHERE von_expert_id IS NOT NULL;
