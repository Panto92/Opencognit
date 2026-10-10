// ===== Auth Types =====
export interface Benutzer {
  id: string;
  name: string;
  email: string;
  rolle: string;
}

export interface AuthAntwort {
  token: string;
  benutzer: Benutzer;
}

// ===== Core Types =====
export interface Unternehmen {
  id: string;
  name: string;
  beschreibung: string | null;
  ziel: string | null;
  status: 'active' | 'paused' | 'archived';
  workDir?: string | null;
  erstelltAm: string;
  aktualisiertAm: string;
}

export interface Experte {
  id: string;
  unternehmenId: string;
  name: string;
  rolle: string;
  titel: string | null;
  status: 'active' | 'paused' | 'idle' | 'running' | 'error' | 'terminated';
  reportsTo: string | null;
  faehigkeiten: string | null;
  verbindungsTyp: 'claude' | 'anthropic' | 'openai' | 'openrouter' | 'google' | 'moonshot' | 'poe' | 'ollama' | 'ollama_cloud' | 'codex' | 'codex-cli' | 'gemini-cli' | 'kimi-cli' | 'cursor' | 'http' | 'bash' | 'ceo' | 'custom' | 'claude-code' | 'openclaw';
  verbindungsConfig: string | null;
  avatar: string | null;
  avatarFarbe: string;
  budgetMonatCent: number;
  verbrauchtMonatCent: number;
  letzterZyklus: string | null;
  zyklusIntervallSek: number | null;
  zyklusAktiv: boolean | null;
  systemPrompt?: string | null;
  advisorId?: string | null;
  advisorStrategy?: 'none' | 'planning' | 'native' | null;
  advisorConfig?: string | null;
  isOrchestrator?: boolean;
  nachrichtenCount?: number;
  erstelltAm: string;
  aktualisiertAm: string;
}

export interface Aufgabe {
  id: string;
  unternehmenId: string;
  titel: string;
  beschreibung: string | null;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked' | 'cancelled';
  prioritaet: 'critical' | 'high' | 'medium' | 'low';
  zugewiesenAn: string | null;
  erstelltVon: string | null;
  parentId: string | null;
  projektId: string | null;
  zielId: string | null;
  executionRunId: string | null;
  executionAgentNameKey: string | null;
  executionLockedAt: string | null;
  isMaximizerMode: boolean;
  blockedBy: string | null;
  dueDate: string | null;
  gestartetAm: string | null;
  abgeschlossenAm: string | null;
  erstelltAm: string;
  aktualisiertAm: string;
}

export interface Kommentar {
  id: string;
  unternehmenId: string;
  aufgabeId: string;
  autorExpertId: string | null;
  autorTyp: 'agent' | 'board';
  inhalt: string;
  erstelltAm: string;
}

export interface Genehmigung {
  id: string;
  type?: 'hire_expert' | 'approve_strategy' | 'budget_change' | 'agent_action';
  title?: string;
  description?: string | null;
  requestedBy?: string | null;
  decisionNote?: string | null;
  decidedAt?: string | null;
  createdAt?: string;
  companyId?: string;
  unternehmenId?: string;
  typ?: 'hire_expert' | 'approve_strategy' | 'budget_change' | 'agent_action';
  titel?: string;
  beschreibung?: string | null;
  angefordertVon?: string | null;
  entscheidungsnotiz?: string | null;
  entschiedenAm?: string | null;
  erstelltAm?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  payload: Record<string, any> | null;
}

export interface Aktivitaet {
  id: string;
  unternehmenId: string;
  akteurTyp: 'agent' | 'board' | 'system';
  akteurId: string;
  akteurName: string | null;
  aktion: string;
  entitaetTyp: string;
  entitaetId: string;
  details: string | null;
  erstelltAm: string;
}

export interface Projekt {
  id: string;
  unternehmenId: string;
  name: string;
  beschreibung: string | null;
  status: 'aktiv' | 'pausiert' | 'abgeschlossen' | 'archiviert';
  prioritaet: 'critical' | 'high' | 'medium' | 'low';
  zielId: string | null;
  eigentuemerId: string | null;
  farbe: string;
  deadline: string | null;
  fortschritt: number;
  workDir: string | null;
  erstelltAm: string;
  aktualisiertAm: string;
}

export interface AgentPermissions {
  id: string;
  expertId: string;
  darfAufgabenErstellen: boolean;
  darfAufgabenZuweisen: boolean;
  darfGenehmigungAnfordern: boolean;
  darfGenehmigungEntscheiden: boolean;
  darfExpertenAnwerben: boolean;
  budgetLimitCent: number | null;
  erlaubtePfade: string | null;
  erlaubteDomains: string | null;
}

export interface DashboardData {
  unternehmen: Unternehmen;
  experten: { gesamt: number; aktiv: number; running: number; paused: number; error: number };
  aufgaben: { gesamt: number; offen: number; inBearbeitung: number; erledigt: number; blockiert: number; completedPerDay: number[] };
  kosten: { gesamtVerbraucht: number; gesamtBudget: number; prozent: number };
  pendingApprovals: number;
  topExperten: Experte[];
  letzteAktivitaet: Aktivitaet[];
  alleExperten?: Experte[];
  zyklen?: { total: number; succeeded: number; failed: number };
  topProjekte?: Array<{ id: string; titel: string; status: string;fortschritt: number }>;
  aktiveZiele?: Array<{ id: string; titel: string; status: string;fortschritt: number }>;
  letzteTrace?: Array<{ id: string; expertId: string; expertName?: string; aktion: string; details?: string; erstelltAm: string }>;
}

export interface KostenZusammenfassung {
  gesamtVerbraucht: number;
  gesamtBudget: number;
  gesamtProzent: number;
  proExperte: Array<{
    id: string; name: string; titel: string | null; avatar: string | null;
    avatarFarbe: string; verbindungsTyp: string;
    verbrauchtMonatCent: number; budgetMonatCent: number; prozent: number;
  }>;
}

export interface ProviderKosten {
  anbieter: string;
  kosten: number;
  tokens: number;
  buchungen: number;
}

export interface TimelineTag {
  datum: string;
  kostenCent: number;
}

export interface BudgetPolicy {
  id: string;
  unternehmenId: string;
  scope: 'company' | 'project' | 'agent';
  scopeId: string;
  limitCent: number;
  fenster: 'monatlich' | 'lifetime';
  warnProzent: number;
  hardStop: boolean;
  aktiv: boolean;
  erstelltAm: string;
  aktualisiertAm: string;
  status?: { prozent: number; verbrauchtCent: number; status: 'ok' | 'warnung' | 'hard_stop' } | null;
}

export interface BudgetIncident {
  id: string;
  policyId: string;
  typ: 'warnung' | 'hard_stop';
  beobachteterBetrag: number;
  limitBetrag: number;
  status: 'offen' | 'behoben' | 'ignoriert';
  erstelltAm: string;
}

export interface BudgetForecast {
  policyId: string;
  scope: 'company' | 'project' | 'agent';
  scopeId: string;
  scopeLabel: string;
  limitCent: number;
  spentCent: number;
  percentUsed: number;
  fenster: 'monatlich' | 'lifetime';
  burnRateCentPerDay: number;
  daysObserved: number;
  projectedHitAt: string | null;
  daysToHit: number | null;
  willExceedThisWindow: boolean;
  warnProzent: number;
  triggered: 'none' | 'warn' | 'hard';
}

export interface Mitgliedschaft {
  companyId: string;
  role: string;
  joinedAt: string | null;
  companyName: string | null;
  companyStatus: string | null;
}

export interface Mitglied {
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  joinedAt: string | null;
}
