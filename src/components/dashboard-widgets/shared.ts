// Shared utilities, types and configs for dashboard widgets

import type { Experte as ExperteType } from '@/api/types';

export function euro(cent: number) {
  return (cent / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function reltime(iso: string, lang: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return lang === 'de' ? 'gerade eben' : 'just now';
  if (m < 60) return lang === 'de' ? `vor ${m} Min.` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === 'de' ? `vor ${h} Std.` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return lang === 'de' ? `vor ${d} Tag${d > 1 ? 'en' : ''}` : `${d}d ago`;
}

export const STATUS_CFG: Record<string, { color: string; bg: string; label: { de: string; en: string } }> = {
  running:    { color: '#c5a059', bg: 'rgba(197,160,89,0.12)',  label: { de: 'Arbeitet', en: 'Working' } },
  active:     { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   label: { de: 'Aktiv',    en: 'Active'  } },
  idle:       { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', label: { de: 'Bereit',   en: 'Idle'    } },
  paused:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: { de: 'Pausiert', en: 'Paused'  } },
  error:      { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: { de: 'Fehler',   en: 'Error'   } },
  terminated: { color: '#6b7280', bg: 'rgba(107,114,128,0.10)', label: { de: 'Beendet',  en: 'Off'     } },
};

export const TRACE_CFG: Record<string, { color: string; bg: string; label: string }> = {
  thinking: { color: '#9b87c8', bg: 'rgba(155,135,200,0.08)', label: '💭 Think' },
  action:   { color: '#c5a059', bg: 'rgba(197,160,89,0.08)',  label: '⚡ Act'   },
  result:   { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   label: '✓ Result' },
  error:    { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   label: '✗ Error'  },
  warning:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  label: '⚠ Warn'   },
  info:     { color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', label: 'ℹ Info'   },
};

export const PULSE_CFG: Record<string, { color: string; bg: string; symbol: string }> = {
  thinking:       { color: '#9b87c8', bg: 'rgba(155,135,200,0.07)', symbol: '💭' },
  action:         { color: '#c5a059', bg: 'rgba(197,160,89,0.07)', symbol: '⚡' },
  result:         { color: '#22c55e', bg: 'rgba(34,197,94,0.07)',  symbol: '✓'  },
  error:          { color: '#ef4444', bg: 'rgba(239,68,68,0.07)',  symbol: '✗'  },
  warning:        { color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', symbol: '⚠'  },
  task_started:   { color: '#c5a059', bg: 'rgba(197,160,89,0.05)', symbol: '▶'  },
  task_completed: { color: '#22c55e', bg: 'rgba(34,197,94,0.05)',  symbol: '✔'  },
  info:           { color: '#475569', bg: 'rgba(71,85,105,0.06)',  symbol: '·'  },
};

export interface TraceEvent {
  id: string;
  expertId: string;
  expertName?: string;
  typ: string;
  titel: string;
  erstelltAm: string;
}

export interface LiveAgent {
  id: string; name: string; rolle: string; titel?: string;
  avatar?: string; avatarFarbe: string;
  status: string; zyklusAktiv: boolean;
  letzterZyklus?: string;
  budgetPct: number;
  currentTask: { id: string; titel: string; status: string } | null;
  lastTrace: { typ: string; titel: string } | null;
  traceEvents: { typ: string; titel: string }[];
  isOrchestrator?: boolean;
  principles?: string[];
}

export interface DashboardKPI {
  value: string | number;
  label: string;
  color: string;
  pulse: boolean;
  link: string;
}

export interface DashboardAlert {
  msg: string;
  color: string;
  link: string;
}
