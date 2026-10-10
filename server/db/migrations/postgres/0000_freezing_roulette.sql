CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" integer,
	"refresh_token_expires_at" integer,
	"scope" text,
	"password" text,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activityLog" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"akteur_typ" text NOT NULL,
	"akteur_id" text NOT NULL,
	"akteur_name" text,
	"aktion" text NOT NULL,
	"entitaet_typ" text NOT NULL,
	"entitaet_id" text NOT NULL,
	"details" text,
	"erstellt_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_capabilities" (
	"id" text PRIMARY KEY NOT NULL,
	"expert_id" text NOT NULL,
	"unternehmen_id" text NOT NULL,
	"capabilities_json" text NOT NULL,
	"quelle" text DEFAULT 'manual' NOT NULL,
	"konfidenz" integer DEFAULT 50 NOT NULL,
	"letzte_aktualisierung" text,
	"erstellt_am" text NOT NULL,
	"aktualisiert_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expert_config_history" (
	"id" text PRIMARY KEY NOT NULL,
	"expert_id" text NOT NULL,
	"changed_at" text NOT NULL,
	"changed_by" text,
	"config_json" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "agenten_meetings" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"titel" text NOT NULL,
	"veranstalter_expert_id" text NOT NULL,
	"teilnehmer_ids" text NOT NULL,
	"antworten" text DEFAULT '{}',
	"status" text DEFAULT 'running' NOT NULL,
	"ergebnis" text,
	"erstellt_am" text NOT NULL,
	"abgeschlossen_am" text
);
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"recipient_id" text,
	"channel" text,
	"thread_id" text,
	"type" text DEFAULT 'direct' NOT NULL,
	"payload" text NOT NULL,
	"read_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"expert_id" text NOT NULL,
	"darf_aufgaben_erstellen" boolean DEFAULT true NOT NULL,
	"darf_aufgaben_zuweisen" boolean DEFAULT false NOT NULL,
	"darf_genehmigungen_anfordern" boolean DEFAULT true NOT NULL,
	"darf_genehmigungen_entscheiden" boolean DEFAULT false NOT NULL,
	"darf_experten_anwerben" boolean DEFAULT false NOT NULL,
	"budget_limit_cent" integer,
	"erlaubte_pfade" text,
	"erlaubte_domains" text,
	"erstellt_am" text NOT NULL,
	"aktualisiert_am" text NOT NULL,
	CONSTRAINT "agent_permissions_expert_id_unique" UNIQUE("expert_id")
);
--> statement-breakpoint
CREATE TABLE "experten_skills" (
	"id" text PRIMARY KEY NOT NULL,
	"expert_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"erstellt_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_trust_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_expert_id" text NOT NULL,
	"unternehmen_id" text NOT NULL,
	"evaluator_expert_id" text NOT NULL,
	"score" integer DEFAULT 50 NOT NULL,
	"zuverlaessigkeit" integer DEFAULT 50 NOT NULL,
	"qualitaet" integer DEFAULT 50 NOT NULL,
	"kommunikation" integer DEFAULT 50 NOT NULL,
	"zusammenarbeit" integer DEFAULT 50 NOT NULL,
	"bewertungs_count" integer DEFAULT 0 NOT NULL,
	"trend" text DEFAULT 'stable' NOT NULL,
	"verlauf_json" text,
	"letzte_aktualisierung" text NOT NULL,
	"erstellt_am" text NOT NULL,
	"aktualisiert_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_votes" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"context_id" text NOT NULL,
	"context_typ" text NOT NULL,
	"expert_id" text NOT NULL,
	"vote" integer NOT NULL,
	"gewichteter_vote" integer,
	"begruendung" text,
	"proposal_text" text,
	"erstellt_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_wakeup_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"expert_id" text NOT NULL,
	"source" text NOT NULL,
	"trigger_detail" text,
	"reason" text NOT NULL,
	"payload" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"coalesced_count" integer DEFAULT 0 NOT NULL,
	"run_id" text,
	"context_snapshot" text,
	"requested_at" text NOT NULL,
	"claimed_at" text,
	"finished_at" text
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"name" text NOT NULL,
	"rolle" text NOT NULL,
	"titel" text,
	"status" text DEFAULT 'idle' NOT NULL,
	"reports_to" text,
	"faehigkeiten" text,
	"verbindungs_typ" text DEFAULT 'claude' NOT NULL,
	"verbindungs_config" text,
	"avatar" text,
	"avatar_farbe" text DEFAULT '#23CDCA' NOT NULL,
	"budget_monat_cent" integer DEFAULT 0 NOT NULL,
	"verbraucht_monat_cent" integer DEFAULT 0 NOT NULL,
	"letzter_zyklus" text,
	"zyklus_intervall_sek" integer DEFAULT 300,
	"zyklus_aktiv" boolean DEFAULT false,
	"system_prompt" text,
	"is_orchestrator" boolean DEFAULT false,
	"advisor_id" text,
	"advisor_strategy" text DEFAULT 'none' NOT NULL,
	"advisor_config" text,
	"soul_path" text,
	"soul_version" text,
	"nachrichten_count" integer DEFAULT 0 NOT NULL,
	"erstellt_am" text NOT NULL,
	"aktualisiert_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"typ" text NOT NULL,
	"titel" text NOT NULL,
	"beschreibung" text,
	"angefordert_von" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" text,
	"entscheidungsnotiz" text,
	"entschieden_am" text,
	"erstellt_am" text NOT NULL,
	"aktualisiert_am" text NOT NULL,
	"telegram_chat_id" text,
	"telegram_message_id" integer,
	"notified_at" text
);
--> statement-breakpoint
CREATE TABLE "budget_incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"policy_id" text NOT NULL,
	"unternehmen_id" text NOT NULL,
	"typ" text NOT NULL,
	"beobachteter_betrag" integer NOT NULL,
	"limit_betrag" integer NOT NULL,
	"status" text DEFAULT 'offen' NOT NULL,
	"behoben_am" text,
	"erstellt_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"scope" text NOT NULL,
	"scope_id" text NOT NULL,
	"limit_cent" integer NOT NULL,
	"fenster" text DEFAULT 'monatlich' NOT NULL,
	"warn_prozent" integer DEFAULT 80 NOT NULL,
	"hard_stop" boolean DEFAULT true NOT NULL,
	"aktiv" boolean DEFAULT true NOT NULL,
	"erstellt_am" text NOT NULL,
	"aktualisiert_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ceo_decision_log" (
	"id" text PRIMARY KEY NOT NULL,
	"expert_id" text NOT NULL,
	"unternehmen_id" text NOT NULL,
	"run_id" text NOT NULL,
	"erstellt_am" text NOT NULL,
	"focus_summary" text NOT NULL,
	"actions_json" text NOT NULL,
	"goals_snapshot" text,
	"pending_task_count" integer DEFAULT 0 NOT NULL,
	"team_summary" text
);
--> statement-breakpoint
CREATE TABLE "chat_nachrichten" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"expert_id" text NOT NULL,
	"absender_typ" text NOT NULL,
	"nachricht" text NOT NULL,
	"gelesen" boolean DEFAULT false NOT NULL,
	"von_expert_id" text,
	"thread_id" text,
	"erstellt_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"aufgabe_id" text NOT NULL,
	"autor_expert_id" text,
	"autor_typ" text DEFAULT 'board' NOT NULL,
	"inhalt" text NOT NULL,
	"erstellt_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"beschreibung" text,
	"ziel" text,
	"status" text DEFAULT 'active' NOT NULL,
	"work_dir" text,
	"erstellt_am" text NOT NULL,
	"aktualisiert_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"invited_at" text,
	"joined_at" text DEFAULT now(),
	"invite_token" text,
	CONSTRAINT "company_memberships_invite_token_unique" UNIQUE("invite_token")
);
--> statement-breakpoint
CREATE TABLE "contract_net_bids" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"aufgabe_id" text NOT NULL,
	"bidder_expert_id" text NOT NULL,
	"bid_score" integer DEFAULT 0 NOT NULL,
	"begruendung" text,
	"estimated_minutes" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"announcer_expert_id" text,
	"erstellt_am" text NOT NULL,
	"abgeschlossen_am" text
);
--> statement-breakpoint
CREATE TABLE "costEntries" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"expert_id" text NOT NULL,
	"aufgabe_id" text,
	"anbieter" text NOT NULL,
	"modell" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"kosten_cent" integer NOT NULL,
	"zeitpunkt" text NOT NULL,
	"erstellt_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"aufgabe_id" text,
	"expert_id" text,
	"pfad" text NOT NULL,
	"branch_name" text,
	"base_pfad" text,
	"abgeleitet_von" text,
	"status" text DEFAULT 'offen' NOT NULL,
	"metadaten" text,
	"geoeffnet_am" text NOT NULL,
	"geschlossen_am" text,
	"aufgeraeumt_am" text,
	"erstellt_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"titel" text NOT NULL,
	"beschreibung" text,
	"ebene" text DEFAULT 'company' NOT NULL,
	"parent_id" text,
	"eigentuemer_expert_id" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"fortschritt" integer DEFAULT 0 NOT NULL,
	"erstellt_am" text NOT NULL,
	"aktualisiert_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"quell_id" text NOT NULL,
	"ziel_id" text NOT NULL,
	"typ" text DEFAULT 'blocks' NOT NULL,
	"erstellt_von" text,
	"erstellt_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learned_skills" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"source_agent_id" text,
	"source_task_id" text,
	"source_run_id" text,
	"title" text NOT NULL,
	"pattern" text NOT NULL,
	"recipe" text NOT NULL,
	"keywords" text,
	"confidence" integer DEFAULT 50 NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" text,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_disabled" boolean DEFAULT false NOT NULL,
	"extracted_by" text DEFAULT 'heuristic' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_conflicts" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"conflicting_triples_json" text NOT NULL,
	"conflict_typ" text NOT NULL,
	"beschreibung" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by_expert_id" text,
	"erstellt_am" text NOT NULL,
	"aktualisiert_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_embeddings" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"expert_id" text,
	"quelle" text DEFAULT 'manual' NOT NULL,
	"quelle_id" text,
	"chunk_text" text NOT NULL,
	"embedding_json" text NOT NULL,
	"model" text DEFAULT 'openai/text-embedding-3-small' NOT NULL,
	"token_count" integer DEFAULT 0,
	"char_count" integer DEFAULT 0 NOT NULL,
	"tags" text,
	"erstellt_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "openclaw_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"token" text NOT NULL,
	"beschreibung" text,
	"erstellt_am" text NOT NULL,
	"letzter_join" text,
	CONSTRAINT "openclaw_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "palace_diary" (
	"id" text PRIMARY KEY NOT NULL,
	"wing_id" text NOT NULL,
	"datum" text NOT NULL,
	"thought" text,
	"action" text,
	"knowledge" text,
	"erstellt_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "palace_drawers" (
	"id" text PRIMARY KEY NOT NULL,
	"wing_id" text NOT NULL,
	"room" text NOT NULL,
	"inhalt" text NOT NULL,
	"erstellt_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "palace_kg" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"subject" text NOT NULL,
	"predicate" text NOT NULL,
	"object" text NOT NULL,
	"valid_from" text,
	"valid_until" text,
	"erstellt_von" text,
	"erstellt_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "palace_summaries" (
	"id" text PRIMARY KEY NOT NULL,
	"expert_id" text NOT NULL,
	"unternehmen_id" text NOT NULL,
	"inhalt" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"komprimierte_turns" integer DEFAULT 0 NOT NULL,
	"erstellt_am" text NOT NULL,
	"aktualisiert_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "palace_wings" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"expert_id" text NOT NULL,
	"name" text NOT NULL,
	"erstellt_am" text NOT NULL,
	"aktualisiert_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"name" text NOT NULL,
	"beschreibung" text,
	"status" text DEFAULT 'aktiv' NOT NULL,
	"prioritaet" text DEFAULT 'medium' NOT NULL,
	"ziel_id" text,
	"eigentuemer_id" text,
	"farbe" text DEFAULT '#23CDCB' NOT NULL,
	"deadline" text,
	"fortschritt" integer DEFAULT 0 NOT NULL,
	"whiteboard_state" text,
	"work_dir" text,
	"erstellt_am" text NOT NULL,
	"aktualisiert_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routine_ausfuehrung" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"routine_id" text NOT NULL,
	"trigger_id" text,
	"quelle" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"payload" text,
	"aufgabe_id" text,
	"erstellt_am" text NOT NULL,
	"abgeschlossen_am" text
);
--> statement-breakpoint
CREATE TABLE "routine_trigger" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"routine_id" text NOT NULL,
	"kind" text NOT NULL,
	"aktiv" boolean DEFAULT true NOT NULL,
	"cron_expression" text,
	"timezone" text DEFAULT 'UTC',
	"naechster_ausfuehrung_am" text,
	"zuletzt_gefeuert_am" text,
	"public_id" text,
	"secret_id" text,
	"erstellt_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"titel" text NOT NULL,
	"beschreibung" text,
	"zugewiesen_an" text,
	"prioritaet" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"concurrency_policy" text DEFAULT 'coalesce_if_active' NOT NULL,
	"catch_up_policy" text DEFAULT 'skip_missed' NOT NULL,
	"variablen" text,
	"zuletzt_ausgefuehrt_am" text,
	"zuletzt_enqueued_am" text,
	"erstellt_am" text NOT NULL,
	"aktualisiert_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" integer NOT NULL,
	"token" text NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"schluessel" text NOT NULL,
	"unternehmen_id" text DEFAULT '' NOT NULL,
	"wert" text NOT NULL,
	"aktualisiert_am" text NOT NULL,
	CONSTRAINT "settings_schluessel_unternehmen_id_pk" PRIMARY KEY("schluessel","unternehmen_id")
);
--> statement-breakpoint
CREATE TABLE "skills_library" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"name" text NOT NULL,
	"beschreibung" text,
	"inhalt" text NOT NULL,
	"tags" text,
	"erstellt_von" text,
	"konfidenz" integer DEFAULT 50 NOT NULL,
	"nutzungen" integer DEFAULT 0 NOT NULL,
	"erfolge" integer DEFAULT 0 NOT NULL,
	"quelle" text DEFAULT 'manuell' NOT NULL,
	"remote_ref" text,
	"erstellt_am" text NOT NULL,
	"aktualisiert_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_checkpoints" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"run_id" text,
	"agent_id" text NOT NULL,
	"company_id" text NOT NULL,
	"state_label" text NOT NULL,
	"files_changed" text,
	"commands_run" text,
	"result" text,
	"blocker" text,
	"next_action" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"titel" text NOT NULL,
	"beschreibung" text,
	"status" text DEFAULT 'backlog' NOT NULL,
	"prioritaet" text DEFAULT 'medium' NOT NULL,
	"zugewiesen_an" text,
	"erstellt_von" text,
	"parent_id" text,
	"projekt_id" text,
	"ziel_id" text,
	"execution_run_id" text,
	"execution_agent_name_key" text,
	"execution_locked_at" text,
	"is_maximizer_mode" boolean DEFAULT false,
	"blocked_by" text,
	"workspace_path" text,
	"gestartet_am" text,
	"abgeschlossen_am" text,
	"abgebrochen_am" text,
	"erstellt_am" text NOT NULL,
	"aktualisiert_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trace_ereignisse" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"expert_id" text NOT NULL,
	"run_id" text,
	"typ" text NOT NULL,
	"titel" text NOT NULL,
	"details" text,
	"erstellt_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" integer,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"passwort_hash" text NOT NULL,
	"rolle" text DEFAULT 'mitglied' NOT NULL,
	"oauth_provider" text,
	"oauth_id" text,
	"erstellt_am" text NOT NULL,
	"aktualisiert_am" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" integer NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workCycles" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"expert_id" text NOT NULL,
	"quelle" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"befehl" text,
	"ausgabe" text,
	"fehler" text,
	"gestartet_am" text,
	"beendet_am" text,
	"erstellt_am" text NOT NULL,
	"invocation_source" text,
	"trigger_detail" text,
	"exit_code" integer,
	"usage_json" text,
	"result_json" text,
	"session_id_before" text,
	"session_id_after" text,
	"context_snapshot" text,
	"retry_of_run_id" text
);
--> statement-breakpoint
CREATE TABLE "arbeitszyklen_archiv" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"expert_id" text NOT NULL,
	"archiv_datum" text NOT NULL,
	"zyklus_anzahl" integer DEFAULT 0 NOT NULL,
	"erfolgreich_anzahl" integer DEFAULT 0 NOT NULL,
	"fehlgeschlagen_anzahl" integer DEFAULT 0 NOT NULL,
	"abgebrochen_anzahl" integer DEFAULT 0 NOT NULL,
	"durchschnitt_dauer_ms" integer DEFAULT 0 NOT NULL,
	"gesamt_input_tokens" integer DEFAULT 0 NOT NULL,
	"gesamt_output_tokens" integer DEFAULT 0 NOT NULL,
	"gesamt_kosten_cent" integer DEFAULT 0 NOT NULL,
	"modelle_json" text,
	"erstellt_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_products" (
	"id" text PRIMARY KEY NOT NULL,
	"unternehmen_id" text NOT NULL,
	"aufgabe_id" text NOT NULL,
	"expert_id" text NOT NULL,
	"run_id" text,
	"typ" text DEFAULT 'file' NOT NULL,
	"name" text NOT NULL,
	"pfad" text,
	"inhalt" text,
	"groesse_bytes" integer,
	"mime_typ" text,
	"erstellt_am" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hostname" text,
	"capabilities" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'online' NOT NULL,
	"max_concurrency" integer DEFAULT 1 NOT NULL,
	"active_runs" integer DEFAULT 0 NOT NULL,
	"total_runs" integer DEFAULT 0 NOT NULL,
	"last_heartbeat_at" text,
	"registriert_am" text NOT NULL,
	"aktualisiert_am" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activityLog" ADD CONSTRAINT "activityLog_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_capabilities" ADD CONSTRAINT "agent_capabilities_expert_id_agents_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_capabilities" ADD CONSTRAINT "agent_capabilities_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_config_history" ADD CONSTRAINT "expert_config_history_expert_id_agents_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenten_meetings" ADD CONSTRAINT "agenten_meetings_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agenten_meetings" ADD CONSTRAINT "agenten_meetings_veranstalter_expert_id_agents_id_fk" FOREIGN KEY ("veranstalter_expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_sender_id_agents_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_recipient_id_agents_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_permissions" ADD CONSTRAINT "agent_permissions_expert_id_agents_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experten_skills" ADD CONSTRAINT "experten_skills_expert_id_agents_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experten_skills" ADD CONSTRAINT "experten_skills_skill_id_skills_library_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills_library"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_trust_scores" ADD CONSTRAINT "agent_trust_scores_subject_expert_id_agents_id_fk" FOREIGN KEY ("subject_expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_trust_scores" ADD CONSTRAINT "agent_trust_scores_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_votes" ADD CONSTRAINT "agent_votes_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_votes" ADD CONSTRAINT "agent_votes_expert_id_agents_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_wakeup_requests" ADD CONSTRAINT "agent_wakeup_requests_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_wakeup_requests" ADD CONSTRAINT "agent_wakeup_requests_expert_id_agents_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_wakeup_requests" ADD CONSTRAINT "agent_wakeup_requests_run_id_workCycles_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workCycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_reports_to_agents_id_fk" FOREIGN KEY ("reports_to") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_advisor_id_agents_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_incidents" ADD CONSTRAINT "budget_incidents_policy_id_budget_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."budget_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_incidents" ADD CONSTRAINT "budget_incidents_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_policies" ADD CONSTRAINT "budget_policies_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ceo_decision_log" ADD CONSTRAINT "ceo_decision_log_expert_id_agents_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ceo_decision_log" ADD CONSTRAINT "ceo_decision_log_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_nachrichten" ADD CONSTRAINT "chat_nachrichten_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_nachrichten" ADD CONSTRAINT "chat_nachrichten_expert_id_agents_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_aufgabe_id_tasks_id_fk" FOREIGN KEY ("aufgabe_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_autor_expert_id_agents_id_fk" FOREIGN KEY ("autor_expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_net_bids" ADD CONSTRAINT "contract_net_bids_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_net_bids" ADD CONSTRAINT "contract_net_bids_aufgabe_id_tasks_id_fk" FOREIGN KEY ("aufgabe_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_net_bids" ADD CONSTRAINT "contract_net_bids_bidder_expert_id_agents_id_fk" FOREIGN KEY ("bidder_expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_net_bids" ADD CONSTRAINT "contract_net_bids_announcer_expert_id_agents_id_fk" FOREIGN KEY ("announcer_expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costEntries" ADD CONSTRAINT "costEntries_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costEntries" ADD CONSTRAINT "costEntries_expert_id_agents_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "costEntries" ADD CONSTRAINT "costEntries_aufgabe_id_tasks_id_fk" FOREIGN KEY ("aufgabe_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_workspaces" ADD CONSTRAINT "execution_workspaces_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_workspaces" ADD CONSTRAINT "execution_workspaces_aufgabe_id_tasks_id_fk" FOREIGN KEY ("aufgabe_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_workspaces" ADD CONSTRAINT "execution_workspaces_expert_id_agents_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_workspaces" ADD CONSTRAINT "execution_workspaces_abgeleitet_von_execution_workspaces_id_fk" FOREIGN KEY ("abgeleitet_von") REFERENCES "public"."execution_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_id_goals_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_eigentuemer_expert_id_agents_id_fk" FOREIGN KEY ("eigentuemer_expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_relations" ADD CONSTRAINT "issue_relations_quell_id_tasks_id_fk" FOREIGN KEY ("quell_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_relations" ADD CONSTRAINT "issue_relations_ziel_id_tasks_id_fk" FOREIGN KEY ("ziel_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learned_skills" ADD CONSTRAINT "learned_skills_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learned_skills" ADD CONSTRAINT "learned_skills_source_agent_id_agents_id_fk" FOREIGN KEY ("source_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learned_skills" ADD CONSTRAINT "learned_skills_source_task_id_tasks_id_fk" FOREIGN KEY ("source_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learned_skills" ADD CONSTRAINT "learned_skills_source_run_id_workCycles_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."workCycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_conflicts" ADD CONSTRAINT "memory_conflicts_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_conflicts" ADD CONSTRAINT "memory_conflicts_resolved_by_expert_id_agents_id_fk" FOREIGN KEY ("resolved_by_expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "openclaw_tokens" ADD CONSTRAINT "openclaw_tokens_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "palace_diary" ADD CONSTRAINT "palace_diary_wing_id_palace_wings_id_fk" FOREIGN KEY ("wing_id") REFERENCES "public"."palace_wings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "palace_drawers" ADD CONSTRAINT "palace_drawers_wing_id_palace_wings_id_fk" FOREIGN KEY ("wing_id") REFERENCES "public"."palace_wings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "palace_kg" ADD CONSTRAINT "palace_kg_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "palace_summaries" ADD CONSTRAINT "palace_summaries_expert_id_agents_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "palace_summaries" ADD CONSTRAINT "palace_summaries_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "palace_wings" ADD CONSTRAINT "palace_wings_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "palace_wings" ADD CONSTRAINT "palace_wings_expert_id_agents_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_ziel_id_goals_id_fk" FOREIGN KEY ("ziel_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_eigentuemer_id_agents_id_fk" FOREIGN KEY ("eigentuemer_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_ausfuehrung" ADD CONSTRAINT "routine_ausfuehrung_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_ausfuehrung" ADD CONSTRAINT "routine_ausfuehrung_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_ausfuehrung" ADD CONSTRAINT "routine_ausfuehrung_trigger_id_routine_trigger_id_fk" FOREIGN KEY ("trigger_id") REFERENCES "public"."routine_trigger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_ausfuehrung" ADD CONSTRAINT "routine_ausfuehrung_aufgabe_id_tasks_id_fk" FOREIGN KEY ("aufgabe_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_trigger" ADD CONSTRAINT "routine_trigger_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routine_trigger" ADD CONSTRAINT "routine_trigger_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_zugewiesen_an_agents_id_fk" FOREIGN KEY ("zugewiesen_an") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills_library" ADD CONSTRAINT "skills_library_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checkpoints" ADD CONSTRAINT "task_checkpoints_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checkpoints" ADD CONSTRAINT "task_checkpoints_run_id_workCycles_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workCycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checkpoints" ADD CONSTRAINT "task_checkpoints_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_checkpoints" ADD CONSTRAINT "task_checkpoints_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_zugewiesen_an_agents_id_fk" FOREIGN KEY ("zugewiesen_an") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_id_tasks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trace_ereignisse" ADD CONSTRAINT "trace_ereignisse_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trace_ereignisse" ADD CONSTRAINT "trace_ereignisse_expert_id_agents_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workCycles" ADD CONSTRAINT "workCycles_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workCycles" ADD CONSTRAINT "workCycles_expert_id_agents_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workCycles" ADD CONSTRAINT "workCycles_retry_of_run_id_workCycles_id_fk" FOREIGN KEY ("retry_of_run_id") REFERENCES "public"."workCycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arbeitszyklen_archiv" ADD CONSTRAINT "arbeitszyklen_archiv_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arbeitszyklen_archiv" ADD CONSTRAINT "arbeitszyklen_archiv_expert_id_agents_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_products" ADD CONSTRAINT "work_products_unternehmen_id_companies_id_fk" FOREIGN KEY ("unternehmen_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_products" ADD CONSTRAINT "work_products_aufgabe_id_tasks_id_fk" FOREIGN KEY ("aufgabe_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_products" ADD CONSTRAINT "work_products_expert_id_agents_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_products" ADD CONSTRAINT "work_products_run_id_workCycles_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."workCycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "expert_config_history_expert_idx" ON "expert_config_history" USING btree ("expert_id","changed_at");--> statement-breakpoint
CREATE INDEX "agent_msg_company_idx" ON "agent_messages" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "agent_msg_sender_idx" ON "agent_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "agent_msg_recipient_idx" ON "agent_messages" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "agent_msg_thread_idx" ON "agent_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "agent_msg_channel_idx" ON "agent_messages" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "agent_msg_recipient_read_idx" ON "agent_messages" USING btree ("recipient_id","read_at");--> statement-breakpoint
CREATE INDEX "wakeup_expert_status_idx" ON "agent_wakeup_requests" USING btree ("expert_id","status");--> statement-breakpoint
CREATE INDEX "wakeup_unternehmen_status_idx" ON "agent_wakeup_requests" USING btree ("unternehmen_id","status");--> statement-breakpoint
CREATE INDEX "ceo_decision_log_expert_idx" ON "ceo_decision_log" USING btree ("expert_id","erstellt_am");--> statement-breakpoint
CREATE INDEX "chat_nachrichten_expert_gelesen_idx" ON "chat_nachrichten" USING btree ("expert_id","gelesen");--> statement-breakpoint
CREATE INDEX "chat_nachrichten_expert_am_idx" ON "chat_nachrichten" USING btree ("expert_id","erstellt_am");--> statement-breakpoint
CREATE INDEX "membership_user_idx" ON "company_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "membership_company_idx" ON "company_memberships" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "membership_token_idx" ON "company_memberships" USING btree ("invite_token");--> statement-breakpoint
CREATE INDEX "learned_skills_company_idx" ON "learned_skills" USING btree ("unternehmen_id");--> statement-breakpoint
CREATE INDEX "learned_skills_keywords_idx" ON "learned_skills" USING btree ("unternehmen_id","is_disabled");--> statement-breakpoint
CREATE INDEX "mem_conflict_unternehmen_status_idx" ON "memory_conflicts" USING btree ("unternehmen_id","status");--> statement-breakpoint
CREATE INDEX "mem_emb_unternehmen_idx" ON "memory_embeddings" USING btree ("unternehmen_id");--> statement-breakpoint
CREATE INDEX "mem_emb_expert_idx" ON "memory_embeddings" USING btree ("expert_id");--> statement-breakpoint
CREATE INDEX "mem_emb_quelle_idx" ON "memory_embeddings" USING btree ("quelle");--> statement-breakpoint
CREATE INDEX "kg_subject_valid_idx" ON "palace_kg" USING btree ("subject","valid_until");--> statement-breakpoint
CREATE INDEX "kg_unternehmen_subject_idx" ON "palace_kg" USING btree ("unternehmen_id","subject");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "checkpoint_task_idx" ON "task_checkpoints" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "checkpoint_run_idx" ON "task_checkpoints" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "checkpoint_agent_idx" ON "task_checkpoints" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "checkpoint_company_idx" ON "task_checkpoints" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "aufgaben_zugewiesen_an_idx" ON "tasks" USING btree ("zugewiesen_an");--> statement-breakpoint
CREATE INDEX "aufgaben_unternehmen_status_idx" ON "tasks" USING btree ("unternehmen_id","status");--> statement-breakpoint
CREATE INDEX "aufgaben_execution_locked_idx" ON "tasks" USING btree ("execution_locked_at");--> statement-breakpoint
CREATE INDEX "trace_expert_am_idx" ON "trace_ereignisse" USING btree ("expert_id","erstellt_am");--> statement-breakpoint
CREATE INDEX "trace_unternehmen_am_idx" ON "trace_ereignisse" USING btree ("unternehmen_id","erstellt_am");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "archiv_unternehmen_datum_idx" ON "arbeitszyklen_archiv" USING btree ("unternehmen_id","archiv_datum");--> statement-breakpoint
CREATE INDEX "archiv_expert_idx" ON "arbeitszyklen_archiv" USING btree ("expert_id","archiv_datum");--> statement-breakpoint
CREATE INDEX "worker_nodes_status_idx" ON "worker_nodes" USING btree ("status","last_heartbeat_at");