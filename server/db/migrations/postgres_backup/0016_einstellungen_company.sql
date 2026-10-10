-- Migration 0016: Add unternehmen_id to settings for per-company settings
ALTER TABLE settings ADD COLUMN IF NOT EXISTS unternehmen_id TEXT NOT NULL DEFAULT '';
