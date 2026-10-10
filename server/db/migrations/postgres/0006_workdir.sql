-- Migration 0006: Add workDir to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS work_dir TEXT;
