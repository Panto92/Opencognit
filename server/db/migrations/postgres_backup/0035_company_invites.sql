-- Add invite token support to companyMemberships
ALTER TABLE companyMemberships ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS membership_token_idx ON companyMemberships(invite_token);
