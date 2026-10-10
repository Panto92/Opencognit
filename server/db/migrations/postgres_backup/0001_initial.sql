-- OpenCognit PostgreSQL Initial Schema
-- Migration 0001 — Initial tables

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  passwort_hash TEXT NOT NULL,
  rolle TEXT NOT NULL DEFAULT 'mitglied',
  erstellt_am TEXT NOT NULL,
  aktualisiert_am TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  beschreibung TEXT,
  ziel TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  erstellt_am TEXT NOT NULL,
  aktualisiert_am TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  rolle TEXT NOT NULL,
  titel TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  reports_to TEXT REFERENCES agents(id),
  faehigkeiten TEXT,
  verbindungs_typ TEXT NOT NULL DEFAULT 'claude',
  verbindungs_config TEXT,
  avatar TEXT,
  avatar_farbe TEXT NOT NULL DEFAULT '#23CDCA',
  budget_monat_cent INTEGER NOT NULL DEFAULT 0,
  verbraucht_monat_cent INTEGER NOT NULL DEFAULT 0,
  letzter_zyklus TEXT,
  zyklus_intervall_sek INTEGER DEFAULT 300,
  zyklus_aktiv BOOLEAN DEFAULT FALSE,
  erstellt_am TEXT NOT NULL,
  aktualisiert_am TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workCycles (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  expert_id TEXT NOT NULL REFERENCES agents(id),
  quelle TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'queued',
  befehl TEXT,
  ausgabe TEXT,
  fehler TEXT,
  gestartet_am TEXT,
  beendet_am TEXT,
  erstellt_am TEXT NOT NULL,
  invocation_source TEXT,
  trigger_detail TEXT,
  exit_code INTEGER,
  usage_json TEXT,
  result_json TEXT,
  session_id_before TEXT,
  session_id_after TEXT,
  context_snapshot TEXT,
  retry_of_run_id TEXT REFERENCES workCycles(id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  titel TEXT NOT NULL,
  beschreibung TEXT,
  status TEXT NOT NULL DEFAULT 'backlog',
  prioritaet TEXT NOT NULL DEFAULT 'medium',
  zugewiesen_an TEXT REFERENCES agents(id),
  erstellt_von TEXT,
  parent_id TEXT REFERENCES tasks(id),
  projekt_id TEXT,
  ziel_id TEXT,
  execution_run_id TEXT REFERENCES workCycles(id),
  execution_agent_name_key TEXT,
  execution_locked_at TEXT,
  blocked_by TEXT,
  gestartet_am TEXT,
  abgeschlossen_am TEXT,
  abgebrochen_am TEXT,
  erstellt_am TEXT NOT NULL,
  aktualisiert_am TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  aufgabe_id TEXT NOT NULL REFERENCES tasks(id),
  autor_expert_id TEXT REFERENCES agents(id),
  autor_typ TEXT NOT NULL DEFAULT 'board',
  inhalt TEXT NOT NULL,
  erstellt_am TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chatMessages (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  expert_id TEXT NOT NULL REFERENCES agents(id),
  absender_typ TEXT NOT NULL,
  nachricht TEXT NOT NULL,
  gelesen BOOLEAN NOT NULL DEFAULT FALSE,
  erstellt_am TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  typ TEXT NOT NULL,
  titel TEXT NOT NULL,
  beschreibung TEXT,
  angefordert_von TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  payload TEXT,
  entscheidungsnotiz TEXT,
  entschieden_am TEXT,
  erstellt_am TEXT NOT NULL,
  aktualisiert_am TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS costEntries (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  expert_id TEXT NOT NULL REFERENCES agents(id),
  aufgabe_id TEXT REFERENCES tasks(id),
  anbieter TEXT NOT NULL,
  modell TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  kosten_cent INTEGER NOT NULL,
  zeitpunkt TEXT NOT NULL,
  erstellt_am TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activityLog (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  akteur_typ TEXT NOT NULL,
  akteur_id TEXT NOT NULL,
  akteur_name TEXT,
  aktion TEXT NOT NULL,
  entitaet_typ TEXT NOT NULL,
  entitaet_id TEXT NOT NULL,
  details TEXT,
  erstellt_am TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  titel TEXT NOT NULL,
  beschreibung TEXT,
  ebene TEXT NOT NULL DEFAULT 'company',
  parent_id TEXT REFERENCES goals(id),
  eigentuemer_expert_id TEXT REFERENCES agents(id),
  status TEXT NOT NULL DEFAULT 'planned',
  erstellt_am TEXT NOT NULL,
  aktualisiert_am TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  schluessel TEXT PRIMARY KEY,
  wert TEXT NOT NULL,
  aktualisiert_am TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agentWakeupRequests (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  expert_id TEXT NOT NULL REFERENCES agents(id),
  source TEXT NOT NULL,
  trigger_detail TEXT,
  reason TEXT NOT NULL,
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  coalesced_count INTEGER NOT NULL DEFAULT 0,
  run_id TEXT REFERENCES workCycles(id),
  context_snapshot TEXT,
  requested_at TEXT NOT NULL,
  claimed_at TEXT,
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS routines (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  titel TEXT NOT NULL,
  beschreibung TEXT,
  zugewiesen_an TEXT REFERENCES agents(id),
  prioritaet TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'active',
  concurrency_policy TEXT NOT NULL DEFAULT 'coalesce_if_active',
  catch_up_policy TEXT NOT NULL DEFAULT 'skip_missed',
  variablen TEXT,
  zuletzt_ausgefuehrt_am TEXT,
  zuletzt_enqueued_am TEXT,
  erstellt_am TEXT NOT NULL,
  aktualisiert_am TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS routineTrigger (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  routine_id TEXT NOT NULL REFERENCES routines(id),
  kind TEXT NOT NULL,
  aktiv BOOLEAN NOT NULL DEFAULT TRUE,
  cron_expression TEXT,
  timezone TEXT DEFAULT 'UTC',
  naechster_ausfuehrung_am TEXT,
  zuletzt_gefeuert_am TEXT,
  public_id TEXT,
  secret_id TEXT,
  erstellt_am TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS routineRuns (
  id TEXT PRIMARY KEY,
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  routine_id TEXT NOT NULL REFERENCES routines(id),
  trigger_id TEXT REFERENCES routineTrigger(id),
  quelle TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  payload TEXT,
  aufgabe_id TEXT REFERENCES tasks(id),
  erstellt_am TEXT NOT NULL,
  abgeschlossen_am TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_experten_unternehmen ON agents(unternehmen_id, status);
CREATE INDEX IF NOT EXISTS idx_aufgaben_unternehmen ON tasks(unternehmen_id, status);
CREATE INDEX IF NOT EXISTS idx_aufgaben_zugewiesen ON tasks(unternehmen_id, zugewiesen_an, status);
CREATE INDEX IF NOT EXISTS idx_kostenbuchungen_unternehmen ON costEntries(unternehmen_id, zeitpunkt);
CREATE INDEX IF NOT EXISTS idx_aktivitaetslog_unternehmen ON activityLog(unternehmen_id, erstellt_am);
CREATE INDEX IF NOT EXISTS idx_genehmigungen_unternehmen ON approvals(unternehmen_id, status);
CREATE INDEX IF NOT EXISTS idx_arbeitszyklen_unternehmen ON workCycles(unternehmen_id, expert_id);
CREATE INDEX IF NOT EXISTS idx_chat_nachrichten_ma ON chatMessages(expert_id, erstellt_am);
CREATE INDEX IF NOT EXISTS idx_wakeup_requests_expert ON agentWakeupRequests(expert_id, status);
CREATE INDEX IF NOT EXISTS idx_wakeup_requests_unternehmen ON agentWakeupRequests(unternehmen_id, status);
CREATE INDEX IF NOT EXISTS idx_routinen_unternehmen ON routines(unternehmen_id, status);
CREATE INDEX IF NOT EXISTS idx_routine_trigger_routine ON routineTrigger(routine_id, aktiv);
CREATE INDEX IF NOT EXISTS idx_routine_ausfuehrung_routine ON routineRuns(routine_id, status);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS _migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);
