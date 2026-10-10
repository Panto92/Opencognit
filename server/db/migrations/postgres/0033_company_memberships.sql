-- Company memberships for multi-user authorization
CREATE TABLE IF NOT EXISTS companyMemberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('owner', 'admin', 'member')),
  invited_at TIMESTAMP,
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, company_id)
);

CREATE INDEX IF NOT EXISTS membership_user_idx ON companyMemberships(user_id);
CREATE INDEX IF NOT EXISTS membership_company_idx ON companyMemberships(company_id);
