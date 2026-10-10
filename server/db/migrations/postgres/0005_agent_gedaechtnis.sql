-- Migration 0005: Agent-Gedächtnis (PARA-Methode) + Verbindungstyp-Erweiterung

CREATE TABLE IF NOT EXISTS agentGedaechtnis (
  id TEXT PRIMARY KEY,
  expert_id TEXT NOT NULL REFERENCES agents(id),
  unternehmen_id TEXT NOT NULL REFERENCES companies(id),
  projects TEXT,
  bereiche TEXT,
  ressourcen TEXT,
  archiv TEXT,
  letzte_aktualisierung TEXT NOT NULL,
  erstellt_am TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_gedaechtnis_expert
  ON agentGedaechtnis(expert_id);
