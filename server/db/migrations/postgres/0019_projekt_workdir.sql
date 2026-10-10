-- 0019: Per-project workDir
-- Each project can now have its own workspace folder.
-- Agents inherit: task.workspacePath → projekt.workDir → companies.workDir → isolated fallback

ALTER TABLE projects ADD COLUMN IF NOT EXISTS work_dir TEXT;
