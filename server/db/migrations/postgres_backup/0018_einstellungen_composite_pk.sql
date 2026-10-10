-- Migration 0018: Fix settings table to use composite PRIMARY KEY (schluessel, unternehmen_id)
-- PostgreSQL requires dropping and recreating the primary key constraint.

-- Step 1: Drop old PK constraint (name may vary; use DO block for safety)
DO $$
BEGIN
  -- Drop PK if it only covers schluessel (single-column PK)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'settings'
      AND constraint_type = 'PRIMARY KEY'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE settings DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'settings' AND constraint_type = 'PRIMARY KEY'
      LIMIT 1
    );
  END IF;
END $$;

-- Step 2: Add composite PK
ALTER TABLE settings ADD PRIMARY KEY (schluessel, unternehmen_id);
