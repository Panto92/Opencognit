-- Human-in-the-Loop: track Telegram message ID for pending approvals
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS notified_at TEXT;
CREATE INDEX IF NOT EXISTS idx_genehmigungen_notified ON approvals(status, notified_at);
