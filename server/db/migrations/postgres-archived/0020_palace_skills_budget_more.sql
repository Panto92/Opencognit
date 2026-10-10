-- Migration 0020: Palace memory, skills, budget, workspaces, issue relations, tokens, meetings, trace

-- ===== Agent Meetings =====
CREATE TABLE IF NOT EXISTS agentMeetings (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  titel TEXT NOT NULL,
  veranstalter_expert_id TEXT NOT NULL REFERENCES agents(id),
  teilnehmer_ids TEXT NOT NULL,
  antworten TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'running',
  ergebnis TEXT,
  erstellt_am TEXT NOT NULL,
  abgeschlossen_am TEXT
);

-- ===== Trace Ereignisse =====
CREATE TABLE IF NOT EXISTS traceEvents (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  expert_id TEXT NOT NULL REFERENCES agents(id),
  run_id TEXT,
  typ TEXT NOT NULL,
  titel TEXT NOT NULL,
  details TEXT,
  erstellt_am TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS trace_expert_am_idx ON traceEvents(expert_id, erstellt_am);
CREATE INDEX IF NOT EXISTS trace_unternehmen_am_idx ON traceEvents(unternehmen_id, erstellt_am);

-- ===== Skills Library =====
CREATE TABLE IF NOT EXISTS skillsLibrary (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  beschreibung TEXT,
  inhalt TEXT NOT NULL,
  tags TEXT,
  erstellt_von TEXT,
  konfidenz INTEGER NOT NULL DEFAULT 50,
  nutzungen INTEGER NOT NULL DEFAULT 0,
  erfolge INTEGER NOT NULL DEFAULT 0,
  quelle TEXT NOT NULL DEFAULT 'manuell',
  remote_ref TEXT,
  erstellt_am TEXT NOT NULL,
  aktualisiert_am TEXT NOT NULL
);

-- ===== Expert <-> Skills =====
CREATE TABLE IF NOT EXISTS agentSkills (
  id TEXT PRIMARY KEY,
  expert_id TEXT NOT NULL REFERENCES agents(id),
  skill_id TEXT NOT NULL REFERENCES skillsLibrary(id),
  erstellt_am TEXT NOT NULL
);

-- ===== Palace: Wings =====
CREATE TABLE IF NOT EXISTS palaceWings (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  expert_id TEXT NOT NULL REFERENCES agents(id),
  name TEXT NOT NULL,
  erstellt_am TEXT NOT NULL,
  aktualisiert_am TEXT NOT NULL
);

-- ===== Palace: Drawers =====
CREATE TABLE IF NOT EXISTS palaceDrawers (
  id TEXT PRIMARY KEY,
  wing_id TEXT NOT NULL REFERENCES palaceWings(id),
  room TEXT NOT NULL,
  inhalt TEXT NOT NULL,
  erstellt_am TEXT NOT NULL
);

-- ===== Palace: Diary =====
CREATE TABLE IF NOT EXISTS palaceDiary (
  id TEXT PRIMARY KEY,
  wing_id TEXT NOT NULL REFERENCES palaceWings(id),
  datum TEXT NOT NULL,
  thought TEXT,
  action TEXT,
  knowledge TEXT,
  erstellt_am TEXT NOT NULL
);

-- ===== Palace: Knowledge Graph =====
CREATE TABLE IF NOT EXISTS palaceKg (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object TEXT NOT NULL,
  valid_from TEXT,
  valid_until TEXT,
  erstellt_von TEXT,
  erstellt_am TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS kg_subject_valid_idx ON palaceKg(subject, valid_until);
CREATE INDEX IF NOT EXISTS kg_unternehmen_subject_idx ON palaceKg(unternehmen_id, subject);

-- ===== Palace: Summaries =====
CREATE TABLE IF NOT EXISTS palaceSummaries (
  id TEXT PRIMARY KEY,
  expert_id TEXT NOT NULL REFERENCES agents(id),
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  inhalt TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  komprimierte_turns INTEGER NOT NULL DEFAULT 0,
  erstellt_am TEXT NOT NULL,
  aktualisiert_am TEXT NOT NULL
);

-- ===== Budget Policies =====
CREATE TABLE IF NOT EXISTS budgetPolicies (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  limit_cent INTEGER NOT NULL,
  fenster TEXT NOT NULL DEFAULT 'monatlich',
  warn_prozent INTEGER NOT NULL DEFAULT 80,
  hard_stop BOOLEAN NOT NULL DEFAULT TRUE,
  aktiv BOOLEAN NOT NULL DEFAULT TRUE,
  erstellt_am TEXT NOT NULL,
  aktualisiert_am TEXT NOT NULL
);

-- ===== Budget Incidents =====
CREATE TABLE IF NOT EXISTS budgetIncidents (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES budgetPolicies(id),
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  typ TEXT NOT NULL,
  beobachteter_betrag INTEGER NOT NULL,
  limit_betrag INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'offen',
  behoben_am TEXT,
  erstellt_am TEXT NOT NULL
);

-- ===== Execution Workspaces =====
CREATE TABLE IF NOT EXISTS executionWorkspaces (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  aufgabe_id TEXT REFERENCES tasks(id),
  expert_id TEXT REFERENCES agents(id),
  pfad TEXT NOT NULL,
  branch_name TEXT,
  base_pfad TEXT,
  abgeleitet_von TEXT REFERENCES executionWorkspaces(id),
  status TEXT NOT NULL DEFAULT 'offen',
  metadaten TEXT,
  geoeffnet_am TEXT NOT NULL,
  geschlossen_am TEXT,
  aufgeraeumt_am TEXT,
  erstellt_am TEXT NOT NULL
);

-- ===== Issue Relations =====
CREATE TABLE IF NOT EXISTS issueRelations (
  id TEXT PRIMARY KEY,
  quell_id TEXT NOT NULL REFERENCES tasks(id),
  ziel_id TEXT NOT NULL REFERENCES tasks(id),
  typ TEXT NOT NULL DEFAULT 'blocks',
  erstellt_von TEXT,
  erstellt_am TEXT NOT NULL
);

-- ===== OpenClaw Gateway Tokens =====
CREATE TABLE IF NOT EXISTS openclawTokens (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  token TEXT NOT NULL UNIQUE,
  beschreibung TEXT,
  erstellt_am TEXT NOT NULL,
  letzter_join TEXT
);
