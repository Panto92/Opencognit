import { pgTable, text, integer, boolean, primaryKey, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ===== Benutzer =====
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('passwort_hash').notNull(),
  role: text('rolle').notNull().default('mitglied'),
  oauthProvider: text('oauth_provider'),
  oauthId: text('oauth_id'),
  createdAt: text('erstellt_am').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
});

// ===== Unternehmen =====
export const companies = pgTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('beschreibung'),
  goal: text('ziel'),
  status: text('status').notNull().default('active'),
  workDir: text('work_dir'),
  createdAt: text('erstellt_am').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
});

// ===== Experten =====
export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  name: text('name').notNull(),
  role: text('rolle').notNull(),
  title: text('titel'),
  status: text('status').notNull().default('idle'),
  reportsTo: text('reports_to').references((): any => agents.id),
  skills: text('faehigkeiten'),
  connectionType: text('verbindungs_typ').notNull().default('claude'),
  connectionConfig: text('verbindungs_config'),
  avatar: text('avatar'),
  avatarColor: text('avatar_farbe').notNull().default('#23CDCA'),
  monthlyBudgetCent: integer('budget_monat_cent').notNull().default(0),
  monthlySpendCent: integer('verbraucht_monat_cent').notNull().default(0),
  lastCycle: text('letzter_zyklus'),
  autoCycleIntervalSec: integer('zyklus_intervall_sek').default(300),
  autoCycleActive: boolean('zyklus_aktiv').default(false),
  systemPrompt: text('system_prompt'),
  isOrchestrator: boolean('is_orchestrator').default(false),
  advisorId: text('advisor_id').references((): any => agents.id),
  advisorStrategy: text('advisor_strategy').notNull().default('none'),
  advisorConfig: text('advisor_config'),
  soulPath: text('soul_path'),
  soulVersion: text('soul_version'),
  messageCount: integer('nachrichten_count').notNull().default(0),
  createdAt: text('erstellt_am').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
});

// ===== Aufgaben =====
export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  title: text('titel').notNull(),
  description: text('beschreibung'),
  status: text('status').notNull().default('backlog'),
  priority: text('prioritaet').notNull().default('medium'),
  assignedTo: text('zugewiesen_an').references(() => agents.id),
  createdBy: text('erstellt_von'),
  parentId: text('parent_id').references((): any => tasks.id),
  projectId: text('projekt_id'),
  goalId: text('ziel_id'),
  executionRunId: text('execution_run_id'),
  executionAgentNameKey: text('execution_agent_name_key'),
  executionLockedAt: text('execution_locked_at'),
  isMaximizerMode: boolean('is_maximizer_mode').default(false),
  blockedBy: text('blocked_by'),
  workspacePath: text('workspace_path'),
  startedAt: text('gestartet_am'),
  completedAt: text('abgeschlossen_am'),
  cancelledAt: text('abgebrochen_am'),
  createdAt: text('erstellt_am').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
}, (t) => ({
  idxZugewiesenAn:      index('aufgaben_zugewiesen_an_idx').on(t.assignedTo),
  idxUnternehmenStatus: index('aufgaben_unternehmen_status_idx').on(t.companyId, t.status),
  idxExecutionLocked:   index('aufgaben_execution_locked_idx').on(t.executionLockedAt),
}));

// ===== Kommentare =====
export const comments = pgTable('comments', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  taskId: text('aufgabe_id').notNull().references(() => tasks.id),
  authorAgentId: text('autor_expert_id').references(() => agents.id),
  authorType: text('autor_typ').notNull().default('board'),
  content: text('inhalt').notNull(),
  createdAt: text('erstellt_am').notNull(),
});

// ===== Chat-Nachrichten =====
export const chatMessages = pgTable('chat_nachrichten', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  agentId: text('expert_id').notNull().references(() => agents.id),
  senderType: text('absender_typ').notNull(),
  message: text('nachricht').notNull(),
  read: boolean('gelesen').notNull().default(false),
  vonExpertId: text('von_expert_id'),
  threadId: text('thread_id'),
  createdAt: text('erstellt_am').notNull(),
}, (t) => ({
  idxExpertGelesen: index('chat_nachrichten_expert_gelesen_idx').on(t.agentId, t.read),
  idxExpertAm:      index('chat_nachrichten_expert_am_idx').on(t.agentId, t.createdAt),
}));

// ===== Genehmigungen =====
export const approvals = pgTable('approvals', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  type: text('typ').notNull(),
  title: text('titel').notNull(),
  description: text('beschreibung'),
  requestedBy: text('angefordert_von'),
  status: text('status').notNull().default('pending'),
  payload: text('payload'),
  decisionNote: text('entscheidungsnotiz'),
  decidedAt: text('entschieden_am'),
  createdAt: text('erstellt_am').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
  telegramChatId: text('telegram_chat_id'),
  telegramMessageId: integer('telegram_message_id'),
  notifiedAt: text('notified_at'),
});

// ===== Kostenbuchungen =====
export const costEntries = pgTable('costEntries', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  agentId: text('expert_id').notNull().references(() => agents.id),
  taskId: text('aufgabe_id').references(() => tasks.id),
  provider: text('anbieter').notNull(),
  model: text('modell').notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  costCent: integer('kosten_cent').notNull(),
  timestamp: text('zeitpunkt').notNull(),
  createdAt: text('erstellt_am').notNull(),
});

// ===== Aktivitätsprotokoll =====
export const activityLog = pgTable('activityLog', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  actorType: text('akteur_typ').notNull(),
  actorId: text('akteur_id').notNull(),
  actorName: text('akteur_name'),
  action: text('aktion').notNull(),
  entityType: text('entitaet_typ').notNull(),
  entityId: text('entitaet_id').notNull(),
  details: text('details'),
  createdAt: text('erstellt_am').notNull(),
});

// ===== Arbeitszyklen =====
export const workCycles = pgTable('workCycles', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  agentId: text('expert_id').notNull().references(() => agents.id),
  source: text('quelle').notNull().default('manual'),
  status: text('status').notNull().default('queued'),
  command: text('befehl'),
  output: text('ausgabe'),
  error: text('fehler'),
  startedAt: text('gestartet_am'),
  endedAt: text('beendet_am'),
  createdAt: text('erstellt_am').notNull(),
  invocationSource: text('invocation_source'),
  triggerDetail: text('trigger_detail'),
  exitCode: integer('exit_code'),
  usageJson: text('usage_json'),
  resultJson: text('result_json'),
  sessionIdBefore: text('session_id_before'),
  sessionIdAfter: text('session_id_after'),
  contextSnapshot: text('context_snapshot'),
  retryOfRunId: text('retry_of_run_id').references((): any => workCycles.id),
});

// ===== Ziele =====
export const goals = pgTable('goals', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  title: text('titel').notNull(),
  description: text('beschreibung'),
  level: text('ebene').notNull().default('company'),
  parentId: text('parent_id').references((): any => goals.id),
  ownerAgentId: text('eigentuemer_expert_id').references(() => agents.id),
  status: text('status').notNull().default('planned'),
  progress: integer('fortschritt').notNull().default(0),
  createdAt: text('erstellt_am').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
});

// ===== Einstellungen =====
export const settings = pgTable('settings', {
  key: text('schluessel').notNull(),
  companyId: text('unternehmen_id').notNull().default(''),
  value: text('wert').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.key, t.companyId] }),
}));

// ===== Agent Wakeup Requests =====
export const agentWakeupRequests = pgTable('agent_wakeup_requests', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  agentId: text('expert_id').notNull().references(() => agents.id),
  source: text('source').notNull(),
  triggerDetail: text('trigger_detail'),
  reason: text('reason').notNull(),
  payload: text('payload'),
  status: text('status').notNull().default('queued'),
  coalescedCount: integer('coalesced_count').notNull().default(0),
  runId: text('run_id').references((): any => workCycles.id),
  contextSnapshot: text('context_snapshot'),
  requestedAt: text('requested_at').notNull(),
  claimedAt: text('claimed_at'),
  finishedAt: text('finished_at'),
}, (t) => ({
  idxExpertStatus:      index('wakeup_expert_status_idx').on(t.agentId, t.status),
  idxUnternehmenStatus: index('wakeup_unternehmen_status_idx').on(t.companyId, t.status),
}));

// ===== Routinen =====
export const routines = pgTable('routines', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  title: text('titel').notNull(),
  description: text('beschreibung'),
  assignedTo: text('zugewiesen_an').references(() => agents.id),
  priority: text('prioritaet').notNull().default('medium'),
  status: text('status').notNull().default('active'),
  concurrencyPolicy: text('concurrency_policy').notNull().default('coalesce_if_active'),
  catchUpPolicy: text('catch_up_policy').notNull().default('skip_missed'),
  variables: text('variablen'),
  lastExecutedAt: text('zuletzt_ausgefuehrt_am'),
  lastEnqueuedAt: text('zuletzt_enqueued_am'),
  createdAt: text('erstellt_am').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
});

// ===== Routine Trigger =====
export const routineTrigger = pgTable('routine_trigger', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  routineId: text('routine_id').notNull().references(() => routines.id),
  kind: text('kind').notNull(),
  active: boolean('aktiv').notNull().default(true),
  cronExpression: text('cron_expression'),
  timezone: text('timezone').default('UTC'),
  nextExecutionAt: text('naechster_ausfuehrung_am'),
  lastFiredAt: text('zuletzt_gefeuert_am'),
  publicId: text('public_id'),
  secretId: text('secret_id'),
  createdAt: text('erstellt_am').notNull(),
});

// ===== Work Products =====
export const workProducts = pgTable('work_products', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  taskId: text('aufgabe_id').notNull().references(() => tasks.id),
  agentId: text('expert_id').notNull().references(() => agents.id),
  runId: text('run_id').references(() => workCycles.id),
  type: text('typ').notNull().default('file'),
  name: text('name').notNull(),
  pfad: text('pfad'),
  content: text('inhalt'),
  sizeBytes: integer('groesse_bytes'),
  mimeTyp: text('mime_typ'),
  createdAt: text('erstellt_am').notNull(),
});

// ===== Projekte =====
export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  name: text('name').notNull(),
  description: text('beschreibung'),
  status: text('status').notNull().default('aktiv'),
  priority: text('prioritaet').notNull().default('medium'),
  goalId: text('ziel_id').references(() => goals.id),
  eigentuemerId: text('eigentuemer_id').references(() => agents.id),
  farbe: text('farbe').notNull().default('#23CDCB'),
  deadline: text('deadline'),
  progress: integer('fortschritt').notNull().default(0),
  whiteboardState: text('whiteboard_state'),
  workDir: text('work_dir'),
  createdAt: text('erstellt_am').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
});

// ===== Agent Permissions =====
export const agentPermissions = pgTable('agent_permissions', {
  id: text('id').primaryKey(),
  agentId: text('expert_id').notNull().references(() => agents.id).unique(),
  darfAufgabenErstellen: boolean('darf_aufgaben_erstellen').notNull().default(true),
  darfAufgabenZuweisen: boolean('darf_aufgaben_zuweisen').notNull().default(false),
  darfGenehmigungAnfordern: boolean('darf_genehmigungen_anfordern').notNull().default(true),
  darfGenehmigungEntscheiden: boolean('darf_genehmigungen_entscheiden').notNull().default(false),
  darfExpertenAnwerben: boolean('darf_experten_anwerben').notNull().default(false),
  budgetLimitCent: integer('budget_limit_cent'),
  erlaubtePfade: text('erlaubte_pfade'),
  erlaubteDomains: text('erlaubte_domains'),
  createdAt: text('erstellt_am').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
});

// ===== Routine Ausführungen =====
export const routineRuns = pgTable('routine_ausfuehrung', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  routineId: text('routine_id').notNull().references(() => routines.id),
  triggerId: text('trigger_id').references(() => routineTrigger.id),
  source: text('quelle').notNull(),
  status: text('status').notNull().default('received'),
  payload: text('payload'),
  taskId: text('aufgabe_id').references(() => tasks.id),
  createdAt: text('erstellt_am').notNull(),
  completedAt: text('abgeschlossen_am'),
});

// ===== Agent Meetings =====
export const agentMeetings = pgTable('agenten_meetings', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  title: text('titel').notNull(),
  organizerAgentId: text('veranstalter_expert_id').notNull().references(() => agents.id),
  participantIds: text('teilnehmer_ids').notNull(),
  responses: text('antworten').default('{}'),
  status: text('status').notNull().default('running'),
  result: text('ergebnis'),
  createdAt: text('erstellt_am').notNull(),
  completedAt: text('abgeschlossen_am'),
});

// ===== Trace Ereignisse =====
export const traceEvents = pgTable('trace_ereignisse', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  agentId: text('expert_id').notNull().references(() => agents.id),
  runId: text('run_id'),
  type: text('typ').notNull(),
  title: text('titel').notNull(),
  details: text('details'),
  createdAt: text('erstellt_am').notNull(),
}, (t) => ({
  idxExpertAm:      index('trace_expert_am_idx').on(t.agentId, t.createdAt),
  idxUnternehmenAm: index('trace_unternehmen_am_idx').on(t.companyId, t.createdAt),
}));

// ===== Skill Library =====
export const skillsLibrary = pgTable('skills_library', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  name: text('name').notNull(),
  description: text('beschreibung'),
  content: text('inhalt').notNull(),
  tags: text('tags'),
  createdBy: text('erstellt_von'),
   confidence: integer('konfidenz').notNull().default(50),
  uses: integer('nutzungen').notNull().default(0),
  successes: integer('erfolge').notNull().default(0),
  source: text('quelle').notNull().default('manuell'),
  remoteRef: text('remote_ref'),
  createdAt: text('erstellt_am').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
});

// ===== Expert <-> Skill Library =====
export const agentSkills = pgTable('experten_skills', {
  id: text('id').primaryKey(),
  agentId: text('expert_id').notNull().references(() => agents.id),
  skillId: text('skill_id').notNull().references(() => skillsLibrary.id),
  createdAt: text('erstellt_am').notNull(),
});

// ===== Palace: Wings =====
export const palaceWings = pgTable('palace_wings', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  agentId: text('expert_id').notNull().references(() => agents.id),
  name: text('name').notNull(),
  createdAt: text('erstellt_am').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
});

// ===== Palace: Drawers =====
export const palaceDrawers = pgTable('palace_drawers', {
  id: text('id').primaryKey(),
  wingId: text('wing_id').notNull().references(() => palaceWings.id),
  room: text('room').notNull(),
  content: text('inhalt').notNull(),
  createdAt: text('erstellt_am').notNull(),
});

// ===== Palace: Diary =====
export const palaceDiary = pgTable('palace_diary', {
  id: text('id').primaryKey(),
  wingId: text('wing_id').notNull().references(() => palaceWings.id),
  datum: text('datum').notNull(),
  thought: text('thought'),
  action: text('action'),
  knowledge: text('knowledge'),
  createdAt: text('erstellt_am').notNull(),
});

// ===== Palace: Knowledge Graph =====
export const palaceKg = pgTable('palace_kg', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  subject: text('subject').notNull(),
  predicate: text('predicate').notNull(),
  object: text('object').notNull(),
  validFrom: text('valid_from'),
  validUntil: text('valid_until'),
  createdBy: text('erstellt_von'),
  createdAt: text('erstellt_am').notNull(),
}, (t) => ({
  idxSubjectValid:       index('kg_subject_valid_idx').on(t.subject, t.validUntil),
  idxUnternehmenSubject: index('kg_unternehmen_subject_idx').on(t.companyId, t.subject),
}));

// ===== Palace: Summaries =====
export const palaceSummaries = pgTable('palace_summaries', {
  id: text('id').primaryKey(),
  agentId: text('expert_id').notNull().references(() => agents.id),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  content: text('inhalt').notNull(),
  version: integer('version').notNull().default(1),
  komprimierteTurns: integer('komprimierte_turns').notNull().default(0),
  createdAt: text('erstellt_am').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
});

// ===== Budget Policies =====
export const budgetPolicies = pgTable('budget_policies', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  scope: text('scope').notNull(),
  scopeId: text('scope_id').notNull(),
  limitCent: integer('limit_cent').notNull(),
  fenster: text('fenster').notNull().default('monatlich'),
  warnProzent: integer('warn_prozent').notNull().default(80),
  hardStop: boolean('hard_stop').notNull().default(true),
  active: boolean('aktiv').notNull().default(true),
  createdAt: text('erstellt_am').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
});

// ===== Budget Incidents =====
export const budgetIncidents = pgTable('budget_incidents', {
  id: text('id').primaryKey(),
  policyId: text('policy_id').notNull().references(() => budgetPolicies.id),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  type: text('typ').notNull(),
  beobachteterBetrag: integer('beobachteter_betrag').notNull(),
  limitBetrag: integer('limit_betrag').notNull(),
  status: text('status').notNull().default('offen'),
  behobeneAm: text('behoben_am'),
  createdAt: text('erstellt_am').notNull(),
});

// ===== Execution Workspaces =====
export const executionWorkspaces = pgTable('execution_workspaces', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  taskId: text('aufgabe_id').references(() => tasks.id),
  agentId: text('expert_id').references(() => agents.id),
  pfad: text('pfad').notNull(),
  branchName: text('branch_name'),
  basePfad: text('base_pfad'),
  abgeleitetVon: text('abgeleitet_von').references((): any => executionWorkspaces.id),
  status: text('status').notNull().default('offen'),
  metadaten: text('metadaten'),
  geoeffnetAm: text('geoeffnet_am').notNull(),
  geschlossenAm: text('geschlossen_am'),
  aufgeraeumtAm: text('aufgeraeumt_am'),
  createdAt: text('erstellt_am').notNull(),
});

// ===== Issue Relations =====
export const issueRelations = pgTable('issue_relations', {
  id: text('id').primaryKey(),
  quellId: text('quell_id').notNull().references(() => tasks.id),
  goalId: text('ziel_id').notNull().references(() => tasks.id),
  type: text('typ').notNull().default('blocks'),
  createdBy: text('erstellt_von'),
  createdAt: text('erstellt_am').notNull(),
});

// ===== OpenClaw Gateway Tokens =====
export const openclawTokens = pgTable('openclaw_tokens', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  token: text('token').notNull().unique(),
  description: text('beschreibung'),
  createdAt: text('erstellt_am').notNull(),
  letzterJoin: text('letzter_join'),
});

// ===== CEO Decision Log =====
export const ceoDecisionLog = pgTable('ceo_decision_log', {
  id: text('id').primaryKey(),
  agentId: text('expert_id').notNull().references(() => agents.id),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  runId: text('run_id').notNull(),
  createdAt: text('erstellt_am').notNull(),
  focusSummary: text('focus_summary').notNull(),
  actionsJson: text('actions_json').notNull(),
  goalsSnapshot: text('goals_snapshot'),
  pendingTaskCount: integer('pending_task_count').notNull().default(0),
  teamSummary: text('team_summary'),
}, (t) => ({
  idxCeoLog: index('ceo_decision_log_expert_idx').on(t.agentId, t.createdAt),
}));

// ===== Expert Config History =====
export const agentConfigHistory = pgTable('expert_config_history', {
  id: text('id').primaryKey(),
  agentId: text('expert_id').notNull().references(() => agents.id),
  changedAt: text('changed_at').notNull(),
  changedBy: text('changed_by'),
  configJson: text('config_json').notNull(),
  note: text('note'),
}, (t) => ({
  idxExpertHistory: index('expert_config_history_expert_idx').on(t.agentId, t.changedAt),
}));

// ===== Worker Nodes (Multi-Node Worker Pool) =====
export const workerNodes = pgTable('worker_nodes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  hostname: text('hostname'),
  capabilities: text('capabilities').notNull(),
  tokenHash: text('token_hash').notNull(),
  status: text('status').notNull().default('online'),
  maxConcurrency: integer('max_concurrency').notNull().default(1),
  activeRuns: integer('active_runs').notNull().default(0),
  totalRuns: integer('total_runs').notNull().default(0),
  lastHeartbeatAt: text('last_heartbeat_at'),
  registriertAm: text('registriert_am').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
}, (t) => ({
  idxStatus: index('worker_nodes_status_idx').on(t.status, t.lastHeartbeatAt),
}));

// ===== BetterAuth Tables =====
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  role: text('role').notNull().default('user'),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: integer('ban_expires'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [index('session_userId_idx').on(table.userId)]);

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at'),
  refreshTokenExpiresAt: integer('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [index('account_userId_idx').on(table.userId)]);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [index('verification_identifier_idx').on(table.identifier)]);

// ===== Company Memberships =====
export const companyMemberships = pgTable('company_memberships', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  invitedAt: text('invited_at'),
  joinedAt: text('joined_at').default(sql`now()`),
  inviteToken: text('invite_token').unique(),
}, (t) => [
  index('membership_user_idx').on(t.userId),
  index('membership_company_idx').on(t.companyId),
  index('membership_token_idx').on(t.inviteToken),
]);

// ===== Work Cycles Archive =====
export const workCyclesArchive = pgTable('arbeitszyklen_archiv', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  agentId: text('expert_id').notNull().references(() => agents.id),
  archiveDate: text('archiv_datum').notNull(),
  cycleCount: integer('zyklus_anzahl').notNull().default(0),
  successCount: integer('erfolgreich_anzahl').notNull().default(0),
  failedCount: integer('fehlgeschlagen_anzahl').notNull().default(0),
  cancelledCount: integer('abgebrochen_anzahl').notNull().default(0),
  avgDurationMs: integer('durchschnitt_dauer_ms').notNull().default(0),
  totalInputTokens: integer('gesamt_input_tokens').notNull().default(0),
  totalOutputTokens: integer('gesamt_output_tokens').notNull().default(0),
  totalCostCent: integer('gesamt_kosten_cent').notNull().default(0),
  modelsJson: text('modelle_json'),
  createdAt: text('erstellt_am').notNull(),
}, (t) => ({
  idxUnternehmenDatum: index('archiv_unternehmen_datum_idx').on(t.companyId, t.archiveDate),
  idxExpert: index('archiv_expert_idx').on(t.agentId, t.archiveDate),
}));

// ===== Task Checkpoints =====
export const taskCheckpoints = pgTable('task_checkpoints', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  runId: text('run_id').references(() => workCycles.id, { onDelete: 'set null' }),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  stateLabel: text('state_label').notNull(),
  filesChanged: text('files_changed'),
  commandsRun: text('commands_run'),
  result: text('result'),
  blocker: text('blocker'),
  nextAction: text('next_action'),
  createdAt: text('created_at').notNull(),
}, (t) => ({
  idxTask: index('checkpoint_task_idx').on(t.taskId),
  idxRun: index('checkpoint_run_idx').on(t.runId),
  idxAgent: index('checkpoint_agent_idx').on(t.agentId),
  idxCompany: index('checkpoint_company_idx').on(t.companyId),
}));

// ===== Learned Skills =====
export const learnedSkills = pgTable('learned_skills', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  sourceAgentId: text('source_agent_id').references(() => agents.id, { onDelete: 'set null' }),
  sourceTaskId: text('source_task_id').references(() => tasks.id, { onDelete: 'set null' }),
  sourceRunId: text('source_run_id').references(() => workCycles.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  pattern: text('pattern').notNull(),
  recipe: text('recipe').notNull(),
  keywords: text('keywords'),
  confidence: integer('confidence').notNull().default(50),
  useCount: integer('use_count').notNull().default(0),
  lastUsedAt: text('last_used_at'),
  isPinned: boolean('is_pinned').notNull().default(false),
  isDisabled: boolean('is_disabled').notNull().default(false),
  extractedBy: text('extracted_by').notNull().default('heuristic'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (t) => ({
  idxCompany: index('learned_skills_company_idx').on(t.companyId),
  idxKeywordSearch: index('learned_skills_keywords_idx').on(t.companyId, t.isDisabled),
}));

// ===== Agent Trust Scores =====
export const agentTrustScores = pgTable('agent_trust_scores', {
  id: text('id').primaryKey(),
  subjectAgentId: text('subject_expert_id').notNull().references(() => agents.id),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  evaluatorAgentId: text('evaluator_expert_id').notNull(),
  score: integer('score').notNull().default(50),
  reliability: integer('zuverlaessigkeit').notNull().default(50),
  quality: integer('qualitaet').notNull().default(50),
  communication: integer('kommunikation').notNull().default(50),
  collaboration: integer('zusammenarbeit').notNull().default(50),
  ratingCount: integer('bewertungs_count').notNull().default(0),
  trend: text('trend').notNull().default('stable'),
  historyJson: text('verlauf_json'),
  lastUpdated: text('letzte_aktualisierung').notNull(),
  createdAt: text('erstellt_am').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
});

// ===== Agent Votes =====
export const agentVotes = pgTable('agent_votes', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  contextId: text('context_id').notNull(),
  contextType: text('context_typ').notNull(),
  agentId: text('expert_id').notNull().references(() => agents.id),
  vote: integer('vote').notNull(),
  weightedVote: integer('gewichteter_vote'),
  reason: text('begruendung'),
  proposalText: text('proposal_text'),
  createdAt: text('erstellt_am').notNull(),
});

// ===== Agent Capabilities =====
export const agentCapabilities = pgTable('agent_capabilities', {
  id: text('id').primaryKey(),
  agentId: text('expert_id').notNull().references(() => agents.id),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  capabilitiesJson: text('capabilities_json').notNull(),
  quelle: text('quelle').notNull().default('manual'),
  konfidenz: integer('konfidenz').notNull().default(50),
  letzteAktualisierung: text('letzte_aktualisierung'),
  createdAt: text('erstellt_am').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
});

// ===== Contract Net Bids =====
export const contractNetBids = pgTable('contract_net_bids', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  taskId: text('aufgabe_id').notNull().references(() => tasks.id),
  bidderAgentId: text('bidder_expert_id').notNull().references(() => agents.id),
  bidScore: integer('bid_score').notNull().default(0),
  reason: text('begruendung'),
  estimatedMinutes: integer('estimated_minutes'),
  status: text('status').notNull().default('pending'),
  announcerAgentId: text('announcer_expert_id').references(() => agents.id),
  createdAt: text('erstellt_am').notNull(),
  completedAt: text('abgeschlossen_am'),
});

// ===== Memory Embeddings =====
export const memoryEmbeddings = pgTable('memory_embeddings', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull(),
  agentId: text('expert_id'),
  source: text('quelle').notNull().default('manual'),
  quelleId: text('quelle_id'),
  chunkText: text('chunk_text').notNull(),
  embeddingJson: text('embedding_json').notNull(),
  model: text('model').notNull().default('openai/text-embedding-3-small'),
  tokenCount: integer('token_count').default(0),
  charCount: integer('char_count').notNull().default(0),
  tags: text('tags'),
  createdAt: text('erstellt_am').notNull(),
}, (t) => ({
  idxUnternehmen: index('mem_emb_unternehmen_idx').on(t.companyId),
  idxExpert: index('mem_emb_expert_idx').on(t.agentId),
  idxQuelle: index('mem_emb_quelle_idx').on(t.source),
}));

// ===== Memory Conflicts =====
export const memoryConflicts = pgTable('memory_conflicts', {
  id: text('id').primaryKey(),
  companyId: text('unternehmen_id').notNull().references(() => companies.id),
  conflictingTriplesJson: text('conflicting_triples_json').notNull(),
  conflictTyp: text('conflict_typ').notNull(),
  beschreibung: text('beschreibung').notNull(),
  status: text('status').notNull().default('open'),
  resolution: text('resolution'),
  resolvedByAgentId: text('resolved_by_expert_id').references(() => agents.id),
  createdAt: text('erstellt_am').notNull(),
  updatedAt: text('aktualisiert_am').notNull(),
}, (t) => ({
  idxUnternehmenStatus: index('mem_conflict_unternehmen_status_idx').on(t.companyId, t.status),
}));

// ===== Agent Messages (A2A Message Bus) =====
export const agentMessages = pgTable('agent_messages', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  recipientId: text('recipient_id').references(() => agents.id, { onDelete: 'cascade' }),
  channel: text('channel'),
  threadId: text('thread_id'),
  type: text('type').notNull().default('direct'),
  payload: text('payload').notNull(),
  readAt: text('read_at'),
  createdAt: text('created_at').notNull(),
}, (t) => ({
  idxCompany: index('agent_msg_company_idx').on(t.companyId),
  idxSender: index('agent_msg_sender_idx').on(t.senderId),
  idxRecipient: index('agent_msg_recipient_idx').on(t.recipientId),
  idxThread: index('agent_msg_thread_idx').on(t.threadId),
  idxChannel: index('agent_msg_channel_idx').on(t.channel),
  idxRecipientRead: index('agent_msg_recipient_read_idx').on(t.recipientId, t.readAt),
}));
