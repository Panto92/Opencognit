-- Migration 0012: Task Deep Integration — Budget Policies, Execution Workspaces, Issue Dependencies

CREATE TABLE IF NOT EXISTS budgetPolicies (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  scope TEXT NOT NULL CHECK(scope IN ('company', 'project', 'agent')),
  scope_id TEXT NOT NULL,
  limit_cent INTEGER NOT NULL,
  fenster TEXT NOT NULL DEFAULT 'monatlich' CHECK(fenster IN ('monatlich', 'lifetime')),
  warn_prozent INTEGER NOT NULL DEFAULT 80,
  hard_stop BOOLEAN NOT NULL DEFAULT TRUE,
  aktiv BOOLEAN NOT NULL DEFAULT TRUE,
  erstellt_am TEXT NOT NULL,
  aktualisiert_am TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_budget_policies_scope ON budgetPolicies(unternehmen_id, scope, scope_id);

CREATE TABLE IF NOT EXISTS budgetIncidents (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES budgetPolicies(id),
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  typ TEXT NOT NULL CHECK(typ IN ('warnung', 'hard_stop')),
  beobachteter_betrag INTEGER NOT NULL,
  limit_betrag INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'offen' CHECK(status IN ('offen', 'behoben', 'ignoriert')),
  behoben_am TEXT,
  erstellt_am TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_budget_incidents_policy ON budgetIncidents(policy_id);

CREATE TABLE IF NOT EXISTS executionWorkspaces (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  aufgabe_id TEXT REFERENCES tasks(id),
  expert_id TEXT REFERENCES agents(id),
  pfad TEXT NOT NULL,
  branch_name TEXT,
  base_pfad TEXT,
  abgeleitet_von TEXT REFERENCES executionWorkspaces(id),
  status TEXT NOT NULL DEFAULT 'offen' CHECK(status IN ('offen', 'aktiv', 'geschlossen', 'aufgeraeumt')),
  metadaten TEXT,
  geoeffnet_am TEXT NOT NULL,
  geschlossen_am TEXT,
  aufgeraeumt_am TEXT,
  erstellt_am TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exec_ws_aufgabe ON executionWorkspaces(aufgabe_id);
CREATE INDEX IF NOT EXISTS idx_exec_ws_expert ON executionWorkspaces(expert_id);

CREATE TABLE IF NOT EXISTS issueRelations (
  id TEXT PRIMARY KEY,
  quell_id TEXT NOT NULL REFERENCES tasks(id),
  ziel_id TEXT NOT NULL REFERENCES tasks(id),
  typ TEXT NOT NULL DEFAULT 'blocks' CHECK(typ IN ('blocks')),
  erstellt_von TEXT,
  erstellt_am TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_issue_rel_quell ON issueRelations(quell_id);
CREATE INDEX IF NOT EXISTS idx_issue_rel_ziel ON issueRelations(ziel_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_issue_rel_unique ON issueRelations(quell_id, ziel_id, typ);
