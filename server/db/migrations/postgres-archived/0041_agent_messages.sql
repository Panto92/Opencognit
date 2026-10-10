-- Migration 0041: Agent-to-Agent Message Bus (A2A)
-- Persistent inbox for direct messages, broadcasts, and threaded replies between agents.

CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  recipient_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  channel TEXT,
  thread_id TEXT,
  type TEXT NOT NULL DEFAULT 'direct' CHECK(type IN ('direct', 'broadcast', 'channel', 'request', 'response')),
  payload TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS agent_msg_company_idx ON agent_messages(company_id);
CREATE INDEX IF NOT EXISTS agent_msg_sender_idx ON agent_messages(sender_id);
CREATE INDEX IF NOT EXISTS agent_msg_recipient_idx ON agent_messages(recipient_id);
CREATE INDEX IF NOT EXISTS agent_msg_thread_idx ON agent_messages(thread_id);
CREATE INDEX IF NOT EXISTS agent_msg_channel_idx ON agent_messages(channel);
CREATE INDEX IF NOT EXISTS agent_msg_recipient_read_idx ON agent_messages(recipient_id, read_at);
