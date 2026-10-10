-- Goals: Add progress tracking (0-100 integer)
ALTER TABLE goals ADD COLUMN IF NOT EXISTS fortschritt INTEGER NOT NULL DEFAULT 0;
