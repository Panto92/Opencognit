import { useState, useEffect } from 'react';
import {
  Users, Plus, MonitorPlay, Sparkles, Loader2, AlertCircle, Radio, ArrowRight, Activity, ListTodo,
  ShieldCheck, Zap, FolderOpen, Brain, MessageSquare, Clock,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useBreadcrumbs } from '../hooks/useBreadcrumbs';
import { useI18n } from '../i18n';
import { useCompany } from '../hooks/useCompany';
import { useApi } from '../hooks/useApi';
import { apiDashboard } from '@/api/dashboard';
import { apiChannels } from '@/api/channels';
import type { DashboardData, Experte as ExperteType } from '@/api/types';
import { ExpertChatDrawer } from '../components/ExpertChatDrawer';
import { StandupPanel } from '../components/StandupPanel';
import { SetupWizard } from '../components/SetupWizard';
import { BentoGrid, type BentoItem } from '../components/BentoGrid';

import { DailyBriefingWidget } from '../components/dashboard-widgets/DailyBriefingWidget';
import { VelocityChart } from '../components/dashboard-widgets/VelocityChart';
import { Card, HeroKpiStrip } from '../components/dashboard-widgets/KpiSection';
import { MissionControl } from '../components/dashboard-widgets/MissionControl';
import { SystemPulse } from '../components/dashboard-widgets/SystemPulse';
import { computeHealthScore } from '../components/dashboard-widgets/HealthScore';
import { ProjectsWidget } from '../components/dashboard-widgets/ProjectsWidget';
import { GoalsWidget } from '../components/dashboard-widgets/GoalsWidget';
import { GettingStartedCard } from '../components/dashboard-widgets/GettingStartedCard';
import { CommandBar } from '../components/dashboard-widgets/CommandBar';
import { QuickActionsGrid } from '../components/dashboard-widgets/QuickActions';
import { ActivityList } from '../components/dashboard-widgets/ActivitySection';

import type { DashboardKPI, DashboardAlert, TraceEvent, LiveAgent } from '../components/dashboard-widgets/shared';

function SectionHeader({ title, to, linkLabel }: { title: string; to: string; linkLabel: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{title}</h2>
      <Link to={to} style={{
        display: 'flex', alignItems: 'center', gap: '0.375rem',
        fontSize: '0.8125rem', color: '#64748b', textDecoration: 'none',
        padding: '0.375rem 0.75rem', borderRadius: 0,
        border: '1px solid rgba(255,255,255,0.07)',
        transition: 'color 0.15s, border-color 0.15s',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c5a059'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(197,160,89,0.3)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#64748b'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
      >
        {linkLabel} <ArrowRight size={12} />
      </Link>
    </div>
  );
}

export function Dashboard() {
  const { t, language: lang } = useI18n();
  const { aktivesUnternehmen } = useCompany();
  const navigate = useNavigate();
  useBreadcrumbs([aktivesUnternehmen?.name ?? '', t.nav.dashboard]);

  const { data, loading, error, reload } = useApi<DashboardData>(
    () => apiDashboard.laden(aktivesUnternehmen!.id),
    [aktivesUnternehmen?.id],
    { showToast: false },
  );

  // Auto-refresh every 30s
  useEffect(() => {
    if (!aktivesUnternehmen) return;
    const id = setInterval(reload, 30000);
    return () => clearInterval(id);
  }, [aktivesUnternehmen, reload]);

  // Refresh when user returns to tab
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && aktivesUnternehmen) {
        reload();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [aktivesUnternehmen, reload]);

  // Refresh when approval status changes (e.g. via Telegram)
  useEffect(() => {
    const handler = () => reload();
    window.addEventListener('opencognit:approval-changed', handler);
    return () => window.removeEventListener('opencognit:approval-changed', handler);
  }, [reload]);

  useEffect(() => { if (error) console.error('Dashboard:', error); }, [error]);

  const { data: channels } = useApi<Array<{
    id: string; name: string; icon: string;
    status: { connected: boolean };
  }>>(
    () => apiChannels.status(), [], { showToast: false },
  );

  const [chatExpert, setChatExpert] = useState<ExperteType | null>(null);
  const [editExpert, setEditExpert] = useState<ExperteType | null>(null);
  const [standupOpen, setStandupOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardDismissed, setWizardDismissed] = useState(() => !!localStorage.getItem('oc_wizard_dismissed'));

  // Show wizard banner when no agents exist
  const isFirstRun = !loading && data && (data.experten?.gesamt === 0);

  // Chat-First Onboarding: redirect to chat when company exists but no agents yet
  useEffect(() => {
    if (isFirstRun) {
      navigate('/chat?onboard=1');
    }
  }, [isFirstRun, navigate]);

  // Setup status: detect missing API provider
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [setupBannerDismissed, setSetupBannerDismissed] = useState(
    () => !!localStorage.getItem('oc_setup_banner_dismissed')
  );
  useEffect(() => {
    if (!aktivesUnternehmen) return;
    const token = localStorage.getItem('opencognit_token');
    fetch(`/api/einstellungen?unternehmenId=${aktivesUnternehmen.id}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then((cfg: Record<string, string>) => {
        const hasKey = [
          cfg.anthropic_api_key, cfg.openai_api_key, cfg.openrouter_api_key,
          cfg.google_api_key, cfg.ollama_base_url,
        ].some(v => v && v.trim().length > 0);
        setHasApiKey(hasKey);
      })
      .catch(() => setHasApiKey(null));
  }, [aktivesUnternehmen?.id]);

  // Sync agent state to localStorage so Sidebar can highlight Setup section for new users
  useEffect(() => {
    if (data) {
      localStorage.setItem('oc_has_agents', data.experten.gesamt > 0 ? '1' : '0');
    }
  }, [data]);

  if (!aktivesUnternehmen) return null;

  // Wizard must stay mounted across loading/refresh cycles, otherwise its
  // internal state (step, description, workDir, plan) resets every 30s.
  const wizardOverlay = showWizard && (
    <SetupWizard
      onClose={() => setShowWizard(false)}
      onDone={() => { setShowWizard(false); setWizardDismissed(true); localStorage.setItem('oc_wizard_dismissed', '1'); reload(); }}
    />
  );

  if (loading && !data) return (
    <>
      {wizardOverlay}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Loader2 size={28} style={{ color: '#c5a059', animation: 'spin 1s linear infinite' }} />
      </div>
    </>
  );

  if (!data) return (
    <>
      {wizardOverlay}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '0.75rem' }}>
        <AlertCircle size={32} style={{ color: '#ef4444' }} />
        <p style={{ color: '#94a3b8', fontSize: '0.9375rem', margin: 0 }}>
          {error ? (lang === 'de' ? `Fehler: ${error}` : `Error: ${error}`) : (lang === 'de' ? 'Keine Daten verfügbar' : 'No data available')}
        </p>
      </div>
    </>
  );

  const { experten, aufgaben, kosten, pendingApprovals, topExperten, letzteAktivitaet } = data;
  const zyklen: { total: number; succeeded: number; failed: number } = (data as any).zyklen || { total: 0, succeeded: 0, failed: 0 };
  const recentActivityCount: number = (data as any).recentActivityCount || 0;
  const topProjekte: any[] = (data as any).topProjekte || [];
  const aktiveZiele: any[] = (data as any).aktiveZiele || [];
  const letzteTrace: TraceEvent[] = (data as any).letzteTrace || [];
  const alleExperten: LiveAgent[] = (data as any).alleExperten || [];

  const budgetColor = kosten.prozent > 95 ? '#ef4444' : kosten.prozent > 80 ? '#f59e0b' : '#22c55e';
  const hasRunningAgents = experten.running > 0;
  const { score: healthScore, grade: healthGrade, gradeColor: healthColor, factors: healthFactors } = computeHealthScore(experten, aufgaben, kosten, pendingApprovals, zyklen, recentActivityCount, lang);

  // Derive simple trends from current values
  const taskTrend: 'up' | 'down' | 'neutral' = aufgaben.inBearbeitung > 0 ? 'up' : 'neutral';
  const budgetTrend: 'up' | 'down' | 'neutral' = kosten.prozent > 80 ? 'up' : kosten.prozent < 20 ? 'neutral' : 'neutral';

  const de = lang === 'de';

  // ── Hero KPI data ──
  const heroKpis: DashboardKPI[] = [
    {
      value: experten.running > 0 ? experten.running : experten.aktiv,
      label: experten.running > 0 ? (t('autoGenerated.agentsLive')) : (t('autoGenerated.agentsReady')),
      color: experten.running > 0 ? '#c5a059' : '#5c554d',
      pulse: experten.running > 0,
      link: '/experts',
    },
    {
      value: aufgaben.inBearbeitung,
      label: t('autoGenerated.inProgress'),
      color: aufgaben.inBearbeitung > 0 ? '#9b87c8' : '#5c554d',
      pulse: false,
      link: '/tasks',
    },
    {
      value: aufgaben.offen,
      label: t('autoGenerated.tasksOpen'),
      color: aufgaben.offen > 0 ? '#ede5d8' : '#5c554d',
      pulse: false,
      link: '/tasks',
    },
    {
      value: aufgaben.blockiert > 0 ? aufgaben.blockiert : (pendingApprovals > 0 ? pendingApprovals : '✓'),
      label: aufgaben.blockiert > 0 ? (t('autoGenerated.blocked')) : (t('autoGenerated.approvals')),
      color: aufgaben.blockiert > 0 ? '#c97b7b' : pendingApprovals > 0 ? '#d4a373' : '#5c554d',
      pulse: aufgaben.blockiert > 0 || pendingApprovals > 0,
      link: aufgaben.blockiert > 0 ? '/tasks' : '/approvals',
    },
    {
      value: `${kosten.prozent}%`,
      label: t('autoGenerated.budgetUsed'),
      color: budgetColor,
      pulse: false,
      link: '/costs',
    },
  ];

  // ── Alert conditions ──
  const alerts: DashboardAlert[] = [];
  if (pendingApprovals > 0) alerts.push({ msg: de ? `${pendingApprovals} Genehmigung${pendingApprovals > 1 ? 'en' : ''} ausstehend` : `${pendingApprovals} approval${pendingApprovals > 1 ? 's' : ''} pending`, color: '#d4a373', link: '/approvals' });
  if (aufgaben.blockiert > 0) alerts.push({ msg: de ? `${aufgaben.blockiert} Tasks blockiert` : `${aufgaben.blockiert} tasks blocked`, color: '#c97b7b', link: '/tasks' });
  if (kosten.prozent >= 90) alerts.push({ msg: de ? `Budget fast aufgebraucht (${kosten.prozent}%)` : `Budget nearly exhausted (${kosten.prozent}%)`, color: '#c97b7b', link: '/costs' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── CEO Setup Wizard Modal ── */}
      {wizardOverlay}

      {/* ── SETUP STATUS BANNER — shown when no API provider is configured ── */}
      {hasApiKey === false && !setupBannerDismissed && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '1rem', padding: '0.875rem 1.25rem', flexWrap: 'wrap',
          background: 'linear-gradient(135deg, rgba(234,179,8,0.08), rgba(234,179,8,0.04))',
          border: '1px solid rgba(234,179,8,0.35)',
          borderLeft: '3px solid #eab308',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#eab308', boxShadow: '0 0 8px #eab308', animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#fef08a' }}>
                {de ? '⚙️ Kein AI-Provider konfiguriert' : '⚙️ No AI provider configured'}
              </span>
              <span style={{ fontSize: '0.8rem', color: '#78716c', marginLeft: '0.625rem' }}>
                {de ? 'Agenten können ohne API-Key nicht arbeiten.' : 'Agents cannot work without an API key.'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button
              onClick={() => { localStorage.setItem('oc_settings_tab', 'providers'); navigate('/settings'); }}
              style={{
                padding: '0.4rem 1rem', background: 'rgba(234,179,8,0.15)',
                border: '1px solid rgba(234,179,8,0.4)', color: '#eab308',
                fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {de ? 'Jetzt einrichten →' : 'Configure now →'}
            </button>
            <button
              onClick={() => { setSetupBannerDismissed(true); localStorage.setItem('oc_setup_banner_dismissed', '1'); }}
              style={{
                padding: '0.4rem 0.75rem', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.08)', color: '#57534e',
                fontSize: '0.8125rem', cursor: 'pointer',
              }}
            >
              {de ? 'Schließen' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}

      {/* ── ALERT STRIP — action required, always first ── */}
      {alerts.length > 0 && (
        <div style={{
          display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
        }}>
          {alerts.map((a, i) => (
            <button
              key={i}
              onClick={() => navigate(a.link)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                padding: '0.625rem 1.125rem',
                background: `${a.color}10`,
                border: `1px solid ${a.color}40`,
                color: a.color, cursor: 'pointer',
                fontSize: '0.875rem', fontWeight: 700,
                letterSpacing: '0.01em',
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: a.color, boxShadow: `0 0 8px ${a.color}`, animation: 'pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
              {a.msg}
              <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>→</span>
            </button>
          ))}
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#c5a059', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              {aktivesUnternehmen.name}
            </span>
            {experten.running > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.1rem 0.5rem', border: '1px solid rgba(197,160,89,0.2)', fontSize: '0.5625rem', color: '#c5a059', fontWeight: 700, letterSpacing: '0.08em' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#c5a059', animation: 'pulse 1.5s ease-in-out infinite' }} />
                {experten.running} LIVE
              </span>
            )}
          </div>
          <h1 className="page-title" style={{ margin: 0 }}>
            {t.dashboard.title}
          </h1>
          {(aktivesUnternehmen.ziel || aktivesUnternehmen.beschreibung) && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-tertiary)', marginTop: '0.375rem', maxWidth: 480, lineHeight: 1.5 }}>
              {((aktivesUnternehmen.ziel || aktivesUnternehmen.beschreibung) ?? '').slice(0, 100)}
              {((aktivesUnternehmen.ziel || aktivesUnternehmen.beschreibung) ?? '').length > 100 ? '…' : ''}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          <button onClick={() => navigate('/war-room')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem', background: 'rgba(155,135,200,0.08)', border: '1px solid rgba(155,135,200,0.2)', color: '#9b87c8', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
            <MonitorPlay size={14} /> War Room
          </button>
          <button onClick={() => navigate('/tasks')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.875rem', background: 'rgba(197,160,89,0.1)', border: '1px solid rgba(197,160,89,0.25)', color: '#c5a059', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
            <Plus size={14} /> {t('autoGenerated.newTask')}
          </button>
        </div>
      </div>

      {/* ── HERO KPI STRIP ── */}
      <HeroKpiStrip kpis={heroKpis} lang={lang} />

      {/* ── First-Run Banner ── */}
      {isFirstRun && !wizardDismissed && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(197,160,89,0.08), rgba(79,70,229,0.08))',
          border: '1px solid rgba(197,160,89,0.25)',
          borderRadius: 0, padding: '1.25rem 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: 0, background: 'rgba(197,160,89,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={22} style={{ color: '#c5a059' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#fff', marginBottom: 3 }}>
                {lang === 'de' ? 'Lass den CEO dein Team einrichten' : 'Let the CEO set up your team'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                {lang === 'de'
                  ? 'Beschreibe dein Vorhaben — CEO erstellt Projekte, Ordner, Agenten und Tasks automatisch'
                  : 'Describe your goal — CEO creates projects, folders, agents and tasks automatically'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button
              onClick={() => { setWizardDismissed(true); localStorage.setItem('oc_wizard_dismissed', '1'); }}
              style={{ padding: '0.5rem 0.875rem', borderRadius: 0, background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              {lang === 'de' ? 'Später' : 'Later'}
            </button>
            <button
              onClick={() => setShowWizard(true)}
              style={{
                padding: '0.5rem 1.25rem', borderRadius: 0,
                background: 'rgba(197,160,89,0.9)', border: '1px solid rgba(197,160,89,0.4)',
                color: '#000', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Sparkles size={14} /> {lang === 'de' ? 'CEO Setup starten' : 'Start CEO Setup'}
            </button>
          </div>
        </div>
      )}

      {/* ── My Team ── */}
      <MissionControl
        initialAgents={alleExperten}
        unternehmenId={aktivesUnternehmen.id}
        lang={lang}
        onChat={(id) => {
          const exp = topExperten.find(e => e.id === id) ?? alleExperten.find(a => a.id === id);
          if (exp) setChatExpert(exp as any);
        }}
      />

      {/* ── Activity + Task Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,0.8fr)', gap: '1rem' }}>

        {/* Recent Activity */}
        <Card style={{ padding: '1.5rem' }}>
          <SectionHeader
            title={t.dashboard.letzteAktivitaet}
            to="/activity"
            linkLabel={lang === 'de' ? 'Alle anzeigen' : 'View all'}
          />
          {letzteAktivitaet.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#475569' }}>
              <Activity size={32} style={{ opacity: 0.2, marginBottom: '0.75rem' }} />
              <p style={{ fontSize: '0.875rem', margin: 0 }}>
                {lang === 'de' ? 'Noch keine Aktivitäten' : 'No activity yet'}
              </p>
              <p style={{ fontSize: '0.75rem', marginTop: '0.375rem', color: '#334155' }}>
                {lang === 'de'
                  ? 'Agenten berichten hier nach ihrem ersten Arbeitszyklus'
                  : 'Agents report here after their first work cycle'}
              </p>
            </div>
          ) : (
            <ActivityList items={letzteAktivitaet.slice(0, 8)} lang={lang} />
          )}
        </Card>

        {/* Task Stats: Velocity + Breakdown */}
        <Card style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              {lang === 'de' ? 'Aufgaben' : 'Tasks'}
            </h2>
            <Link to="/tasks" style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              fontSize: '0.8125rem', color: '#64748b', textDecoration: 'none',
              padding: '0.375rem 0.75rem', borderRadius: 0,
              border: '1px solid rgba(255,255,255,0.07)',
              transition: 'color 0.15s, border-color 0.15s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c5a059'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(197,160,89,0.3)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#64748b'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
            >
              {lang === 'de' ? 'Alle anzeigen' : 'View all'} <ArrowRight size={12} />
            </Link>
          </div>

          {aufgaben.gesamt === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#475569' }}>
              <ListTodo size={32} style={{ opacity: 0.2, marginBottom: '0.75rem' }} />
              <p style={{ fontSize: '0.875rem', margin: 0 }}>
                {lang === 'de' ? 'Noch keine Aufgaben' : 'No tasks yet'}
              </p>
              <button onClick={() => navigate('/tasks')} style={{
                marginTop: '1rem', padding: '0.5rem 1rem', borderRadius: 0,
                background: 'rgba(197,160,89,0.1)', border: '1px solid rgba(197,160,89,0.2)',
                color: '#c5a059', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600,
              }}>
                {lang === 'de' ? 'Erste Aufgabe anlegen' : 'Create first task'}
              </button>
            </div>
          ) : (
            <>
              {/* Status breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {[
                  { label: lang === 'de' ? 'Aktiv' : 'Active',      value: aufgaben.inBearbeitung,                  color: '#3b82f6' },
                  { label: lang === 'de' ? 'Offen' : 'Open',        value: aufgaben.offen - aufgaben.inBearbeitung, color: '#94a3b8' },
                  { label: lang === 'de' ? 'Blockiert' : 'Blocked', value: aufgaben.blockiert,                      color: '#ef4444' },
                  { label: lang === 'de' ? 'Erledigt' : 'Done',     value: aufgaben.erledigt,                       color: '#22c55e' },
                ].filter(s => s.value > 0).map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <span style={{ fontSize: '0.6875rem', color: '#475569', width: 56, flexShrink: 0 }}>{s.label}</span>
                    <div style={{ flex: 1, height: 4, borderRadius: 0, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 0, background: s.color,
                        width: `${Math.round((s.value / aufgaben.gesamt) * 100)}%`,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: '#475569', width: 18, textAlign: 'right', flexShrink: 0 }}>{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Velocity chart */}
              <div style={{ paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <VelocityChart completedPerDay={aufgaben.completedPerDay ?? []} lang={lang} />
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Projects + Goals ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '1rem' }}>

        {/* Projects */}
        <Card style={{ padding: '1.5rem' }}>
          <SectionHeader
            title={lang === 'de' ? 'Aktive Projekte' : 'Active Projects'}
            to="/projects"
            linkLabel={lang === 'de' ? 'Alle anzeigen' : 'View all'}
          />
          <ProjectsWidget projects={topProjekte} lang={lang} />
        </Card>

        {/* Goals */}
        <Card style={{ padding: '1.5rem' }}>
          <SectionHeader
            title={(lang === 'de' ? 'Unternehmensziele' : 'Company Goals')}
            to="/goals"
            linkLabel={lang === 'de' ? 'Alle anzeigen' : 'View all'}
          />
          <GoalsWidget goals={aktiveZiele} lang={lang} />
        </Card>
      </div>

      {/* ── System Pulse (Live Trace) ── */}
      <SystemPulse
        unternehmenId={aktivesUnternehmen.id}
        lang={lang}
      />

      {/* ── Quick actions ── */}
      <QuickActionsGrid
        items={[
          { icon: Plus,         label: lang === 'de' ? 'Neue Aufgabe'   : 'New Task',         to: '/tasks',        accent: '#c5a059' },
          { icon: Users,        label: lang === 'de' ? 'Team verwalten' : 'Manage Team',       to: '/experts',      accent: '#6366f1' },
          { icon: ShieldCheck,  label: lang === 'de' ? 'Genehmigungen'  : 'Approvals',         to: '/approvals',    accent: '#f59e0b', badge: pendingApprovals > 0 ? pendingApprovals : undefined },
          { icon: Zap,          label: lang === 'de' ? 'Routinen'       : 'Routines',           to: '/routines',     accent: '#22c55e' },
          { icon: FolderOpen,   label: lang === 'de' ? 'Projekte'       : 'Projects',           to: '/projects',     accent: '#9b87c8' },
          { icon: Brain,        label: lang === 'de' ? 'Wissensbasis'   : 'Knowledge',          to: '/company-knowledge', accent: '#9b87c8' },
          { icon: MessageSquare,label: lang === 'de' ? 'Meetings'       : 'Meetings',           to: '/meetings',     accent: '#6366f1' },
          { icon: Clock,        label: lang === 'de' ? 'Aktivität'      : 'Activity',           to: '/activity',     accent: '#3b82f6' },
        ]}
        navigate={navigate}
      />

      {/* ── Channels strip ── */}
      {channels && channels.length > 0 && (
        <Card style={{ padding: '1rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem' }}>
              <Radio size={14} style={{ color: '#475569' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', letterSpacing: '0.05em' }}>
                CHANNELS
              </span>
            </div>
            {channels.map(ch => (
              <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: ch.status.connected ? '#22c55e' : '#ef4444',
                  boxShadow: `0 0 5px ${ch.status.connected ? '#22c55e80' : '#ef444480'}`,
                }} />
                <span style={{ fontSize: '0.75rem', color: ch.status.connected ? '#94a3b8' : '#475569', fontWeight: 500 }}>
                  {ch.icon} {ch.name}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Chat / Edit Drawer ── */}
      {(chatExpert || editExpert) && (
        <ExpertChatDrawer
          expert={(chatExpert || editExpert)!}
          initialTab={editExpert && !chatExpert ? 'einstellungen' : 'überblick'}
          onClose={() => { setChatExpert(null); setEditExpert(null); }}
          onUpdated={() => {}}
        />
      )}
      <StandupPanel open={standupOpen} onClose={() => setStandupOpen(false)} />
    </div>
  );
}
