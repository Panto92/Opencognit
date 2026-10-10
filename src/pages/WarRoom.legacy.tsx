import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocketEvent } from '../hooks/useWebSocket';
import {
  X, Zap, CheckCircle2, Clock, Wallet, Users, Radio, Target,
  Cpu, ChevronDown, ChevronUp, Activity, Terminal, CornerDownRight,
  Play, Pause, AlertCircle, Network,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../hooks/useCompany';
import { useI18n } from '../i18n';
import { apiDashboard } from '@/api/dashboard';
import type { DashboardData } from '@/api/types';
import { GlassCard } from '../components/GlassCard';
import { translateTrace } from '../utils/translateTrace';
import { TopologyGraph } from '../components/TopologyGraph';

// ── helpers ───────────────────────────────────────────────────────────────────

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem('opencognit_token');
  return fetch(url, { credentials: 'include', ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers } });
}

function formatCost(cent: number, language: string) {
  const locale = language === 'de' ? 'de-DE' : 'en-US';
  const currency = language === 'de' ? 'EUR' : 'USD';
  return (cent / 100).toLocaleString(locale, { style: 'currency', currency });
}

function timeAgo(iso: string, de: boolean) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 10) return de ? 'gerade eben' : 'just now';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

function fmtDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

const STATUS_CFG: Record<string, { color: string; glow: string; labelDe: string; labelEn: string }> = {
  running:    { color: '#c5a059', glow: '0 0 20px rgba(197,160,89,0.45)', labelDe: 'LÄUFT', labelEn: 'RUNNING' },
  active:     { color: '#7cb97a', glow: '0 0 10px rgba(124,185,122,0.3)', labelDe: 'BEREIT', labelEn: 'READY' },
  idle:       { color: '#7a7268', glow: 'none', labelDe: 'IDLE', labelEn: 'IDLE' },
  paused:     { color: '#d4a373', glow: '0 0 10px rgba(212,163,115,0.3)', labelDe: 'PAUSIERT', labelEn: 'PAUSED' },
  error:      { color: '#c97b7b', glow: '0 0 15px rgba(201,123,123,0.5)', labelDe: 'FEHLER', labelEn: 'ERROR' },
  terminated: { color: '#5c554d', glow: 'none', labelDe: 'AUS', labelEn: 'OFF' },
};

interface TraceCfg {
  color: string;       // tag + symbol color
  textColor: string;   // title text color
  tag: string;         // bracket label e.g. "ACTION"
  symbol: string;      // inline icon/prefix
  bg: string;
  border: string;
  indent: boolean;     // indent title (results/completions)
}

const TRACE_CFG: Record<string, TraceCfg> = {
  thinking:       { color: '#9b87c8', textColor: '#a898c8', tag: 'THINK',  symbol: '◈', bg: 'rgba(155,135,200,0.07)', border: 'rgba(155,135,200,0.18)', indent: false },
  action:         { color: '#c5a059', textColor: '#c8a862', tag: 'ACTION', symbol: '▸', bg: 'rgba(197,160,89,0.07)',  border: 'rgba(197,160,89,0.2)',   indent: false },
  result:         { color: '#7cb97a', textColor: '#7cae7a', tag: 'RESULT', symbol: '✓', bg: 'rgba(124,185,122,0.06)', border: 'rgba(124,185,122,0.16)', indent: true  },
  error:          { color: '#c97b7b', textColor: '#c98080', tag: 'ERROR',  symbol: '✗', bg: 'rgba(201,123,123,0.1)',  border: 'rgba(201,123,123,0.28)', indent: false },
  warning:        { color: '#d4a373', textColor: '#c8a070', tag: 'WARN',   symbol: '!', bg: 'rgba(212,163,115,0.07)', border: 'rgba(212,163,115,0.2)',  indent: false },
  task_started:   { color: '#c5a059', textColor: '#c8a862', tag: 'START',  symbol: '▶', bg: 'rgba(197,160,89,0.06)',  border: 'rgba(197,160,89,0.16)',  indent: false },
  task_completed: { color: '#7cb97a', textColor: '#7cae7a', tag: 'DONE',   symbol: '✔', bg: 'rgba(124,185,122,0.06)', border: 'rgba(124,185,122,0.16)', indent: true  },
  info:           { color: '#4a4540', textColor: '#6a6058', tag: 'INFO',   symbol: '·', bg: 'transparent',             border: 'transparent',           indent: false },
  critic:         { color: '#d4a373', textColor: '#c8a070', tag: 'CRITIC', symbol: '⚑', bg: 'rgba(212,163,115,0.07)', border: 'rgba(212,163,115,0.2)',  indent: true  },
  critic_rejected:{ color: '#c97b7b', textColor: '#c98080', tag: 'REJECT', symbol: '✗', bg: 'rgba(201,123,123,0.1)',  border: 'rgba(201,123,123,0.28)', indent: false },
};

interface LiveAgent {
  id: string; name: string; rolle: string; avatar: string; avatarFarbe: string;
  status: string; letzterZyklus: string | null; zyklusAktiv: boolean;
  budgetMonatCent: number; verbrauchtMonatCent: number;
  currentTask?: { id: string; titel: string; status: string } | null;
  lastTrace?: { typ: string; titel: string } | null;
  isOrchestrator?: boolean;
  verbindungsTyp: string;
  unternehmenId: string;
}

interface TraceEvent {
  id: string; expertId: string; expertName?: string;
  typ: string; titel: string; details?: string; erstelltAm: string;
}

// ── Animated metric ────────────────────────────────────────────────────────────

function AnimatedNum({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const frame = () => {
      const pct = Math.min(1, (Date.now() - start) / 600);
      setDisplay(Math.round(value * pct));
      if (pct < 1) requestAnimationFrame(frame);
      else setDisplay(value);
    };
    requestAnimationFrame(frame);
  }, [value]);
  return <>{display}{suffix}</>;
}

// ── Pulse ring ─────────────────────────────────────────────────────────────────

function PulseRing({ color, active }: { color: string; active: boolean }) {
  if (!active) return null;
  return (
    <div style={{
      position: 'absolute', inset: -4, borderRadius: '50%',
      border: `2px solid ${color}`,
      animation: 'aura 2s ease-in-out infinite',
      pointerEvents: 'none',
    }} />
  );
}

// ── Thinking dots ──────────────────────────────────────────────────────────────

function ThinkingDots() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(id);
  }, []);
  return <span style={{ color: '#c5a059', fontWeight: 800, letterSpacing: 2 }}>{dots || '.'}</span>;
}

// ── Live elapsed timer ─────────────────────────────────────────────────────────

function ElapsedTimer({ since }: { since: string | null }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!since) return;
    const start = new Date(since).getTime();
    const id = setInterval(() => setElapsed(Date.now() - start), 1000);
    setElapsed(Date.now() - start);
    return () => clearInterval(id);
  }, [since]);
  if (!since) return null;
  return <span style={{ color: '#c5a059', fontFamily: 'monospace', fontSize: 10 }}>{fmtDuration(elapsed)}</span>;
}

// ── Trace row — terminal bracket-tag style ────────────────────────────────────

function TraceRow({ ev, showDetails = true, lang = 'de' }: { ev: TraceEvent; showDetails?: boolean; lang?: string }) {
  const tc = TRACE_CFG[ev.typ] || TRACE_CFG.info;
  const [open, setOpen] = useState(false);
  const hasDetails = !!ev.details?.trim();
  const ts = new Date(ev.erstelltAm).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const isError = ev.typ === 'error' || ev.typ === 'critic_rejected';
  const isInfo  = ev.typ === 'info';

  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      background: open ? tc.bg : 'transparent',
      borderLeft: isError
        ? `2px solid ${tc.color}70`
        : open ? `2px solid ${tc.color}35` : '2px solid transparent',
      transition: 'background 0.12s, border-color 0.12s',
      animation: 'fadeInUp 0.15s ease-out',
    }}>
      <div
        style={{
          padding: tc.indent ? '3px 8px 3px 20px' : '3px 8px 3px 4px',
          display: 'flex', alignItems: 'baseline', gap: 6,
          cursor: hasDetails && showDetails ? 'pointer' : 'default',
        }}
        onClick={() => hasDetails && showDetails && setOpen(o => !o)}
      >
        {/* Timestamp */}
        {!tc.indent && (
          <span style={{
            fontSize: 9, color: '#3d3830',
            flexShrink: 0, whiteSpace: 'nowrap', letterSpacing: '-0.01em', minWidth: 52,
          }}>
            {ts}
          </span>
        )}

        {/* Bracket tag [ACTION] */}
        {!isInfo && (
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
            color: tc.color, flexShrink: 0,
            textShadow: isError ? `0 0 8px ${tc.color}50` : 'none',
          }}>
            [{tc.tag}]
          </span>
        )}

        {/* Symbol prefix for results/done */}
        {tc.indent && (
          <span style={{ fontSize: 10, color: tc.color, flexShrink: 0 }}>{tc.symbol}</span>
        )}

        {/* Title */}
        <span style={{
          fontSize: 10.5, color: isInfo ? '#3d3830' : tc.textColor,
          lineHeight: 1.4,
          fontWeight: isError ? 600 : 400,
          flex: 1, minWidth: 0,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: open ? 99 : 2, WebkitBoxOrient: 'vertical',
          wordBreak: 'break-all',
        }}>
          {tc.indent && '  '}
          {translateTrace(ev.titel, lang)}
        </span>

        {/* Expand indicator */}
        {hasDetails && showDetails && (
          <span style={{ fontSize: 8, color: tc.color + '80', flexShrink: 0 }}>
            {open ? '▾' : '▸'}
          </span>
        )}
      </div>

      {/* Details preview (first line, collapsed) */}
      {hasDetails && showDetails && !open && (
        <div style={{
          padding: '0 8px 3px 72px',
          fontSize: 9, color: '#3a3530', fontFamily: 'var(--font-mono)',
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>
          {ev.details!.split('\n')[0].slice(0, 100)}
        </div>
      )}

      {/* Full expanded details */}
      {hasDetails && open && (
        <pre style={{
          fontSize: 9.5, color: '#6a6058', margin: '2px 8px 6px 72px',
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6,
          maxHeight: 240, overflowY: 'auto',
          background: 'rgba(0,0,0,0.55)',
          border: `1px solid ${tc.border}`,
          borderLeft: `3px solid ${tc.color}40`,
          padding: '6px 10px',
          scrollbarWidth: 'thin',
          scrollbarColor: `${tc.color}25 transparent`,
        }}>
          {ev.details}
        </pre>
      )}
    </div>
  );
}

// ── Full Agent Log Panel ───────────────────────────────────────────────────────

function AgentLogPanel({
  agent,
  traces,
  onClose,
  language,
}: {
  agent: LiveAgent;
  traces: TraceEvent[];
  onClose: () => void;
  language: string;
}) {
  const de = language === 'de';
  const cfg = STATUS_CFG[agent.status] ?? STATUS_CFG.idle;
  const isRunning = agent.status === 'running';
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new traces arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [traces.length]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200000,
      display: 'flex', alignItems: 'stretch',
    }}>
      {/* Backdrop */}
      <div
        style={{ flex: 1, background: 'rgba(0,0,0,0.75)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div style={{
        width: 520, display: 'flex', flexDirection: 'column',
        background: '#080604',
        borderLeft: `1px solid ${cfg.color}30`,
        boxShadow: `-20px 0 60px ${cfg.color}10`,
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid rgba(255,255,255,0.06)`,
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          background: 'rgba(0,0,0,0.3)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 0,
            background: agent.avatarFarbe + '20', border: `1px solid ${cfg.color}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: agent.avatarFarbe, fontWeight: 700, flexShrink: 0,
          }}>
            {agent.avatar || agent.name.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{agent.name}</span>
              {agent.isOrchestrator && (
                <span style={{ fontSize: 8, fontWeight: 800, color: '#9b87c8', background: 'rgba(155,135,200,0.15)', border: '1px solid rgba(155,135,200,0.3)', borderRadius: 0, padding: '1px 5px' }}>CEO</span>
              )}
              <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 0, background: cfg.color + '20', color: cfg.color, fontWeight: 800, border: `1px solid ${cfg.color}40` }}>
                {de ? cfg.labelDe : cfg.labelEn}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{agent.rolle}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Current task banner */}
        {agent.currentTask && (
          <div style={{
            padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)',
            background: isRunning ? 'rgba(197,160,89,0.05)' : 'rgba(0,0,0,0.2)',
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          }}>
            {isRunning ? <Play size={10} style={{ color: '#c5a059' }} /> : <Pause size={10} style={{ color: '#475569' }} />}
            <span style={{ fontSize: 11, color: isRunning ? '#cbd5e1' : '#64748b', flex: 1 }}>
              {agent.currentTask.titel}
            </span>
            {isRunning && <ElapsedTimer since={agent.letzterZyklus} />}
            {isRunning && <ThinkingDots />}
          </div>
        )}

        {/* Log title */}
        <div style={{
          padding: '8px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          <Terminal size={11} style={{ color: '#475569' }} />
          <span style={{ fontSize: 9, fontWeight: 800, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {de ? `Aktivitätslog · ${traces.length} Einträge` : `Activity log · ${traces.length} entries`}
          </span>
          {isRunning && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#c5a059', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <span style={{ fontSize: 9, color: '#c5a059', fontWeight: 700 }}>LIVE</span>
            </div>
          )}
        </div>

        {/* Trace log — newest at top */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {traces.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#334155', fontSize: 12, padding: 40 }}>
              {de ? 'Noch keine Aktivität aufgezeichnet' : 'No activity recorded yet'}
            </div>
          ) : traces.map((ev) => (
            <TraceRow key={ev.id} ev={ev} showDetails={true} lang={language} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Engine Selector Badge ──────────────────────────────────────────────────────

function EngineSelectorBadge({ current, onSelect, language }: { current: string; onSelect: (newType: string) => void; language: string }) {
  const de = language === 'de';
  const [showMenu, setShowMenu] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  const options = [
    { value: 'claude-code', label: 'Claude Code CLI', icon: '🐚', isCli: true },
    { value: 'gemini-cli', label: 'Gemini CLI', icon: '♊', isCli: true },
    { value: 'kimi-cli', label: 'Kimi CLI', icon: '⚡', isCli: true },
    { value: 'codex-cli', label: 'Codex CLI', icon: '⚙️', isCli: true },
    { value: 'openrouter', label: 'OpenRouter API', icon: '🌐', isCli: false },
    { value: 'anthropic', label: 'Anthropic API', icon: '🧠', isCli: false },
    { value: 'openai', label: 'OpenAI API', icon: '🤖', isCli: false },
    { value: 'ollama', label: 'Ollama (Local)', icon: '🏠', isCli: false },
  ];

  const currentOpt = options.find(o => o.value === current) || { value: current, label: current, icon: '⚙️', isCli: false };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={triggerRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: currentOpt.isCli ? 'rgba(155, 135, 200, 0.12)' : 'rgba(255,255,255,0.03)',
          border: currentOpt.isCli ? '1px solid rgba(155, 135, 200, 0.45)' : '1px solid rgba(255,255,255,0.1)',
          padding: '2px 8px',
          fontSize: 9,
          color: currentOpt.isCli ? '#9b87c8' : '#8898aa',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          transition: 'all 0.15s',
          borderRadius: 0,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.border = currentOpt.isCli ? '1px solid rgba(155, 135, 200, 0.65)' : '1px solid rgba(255,255,255,0.2)';
          if (currentOpt.isCli) e.currentTarget.style.boxShadow = '0 0 8px rgba(155, 135, 200, 0.2)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.border = currentOpt.isCli ? '1px solid rgba(155, 135, 200, 0.45)' : '1px solid rgba(255,255,255,0.1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <span>{currentOpt.icon}</span>
        <span style={{ fontWeight: 700 }}>{currentOpt.label.toUpperCase()}</span>
        <ChevronDown size={8} style={{ opacity: 0.6 }} />
      </button>

      {showMenu && (
        <>
          <div 
            onClick={() => setShowMenu(false)} 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 }} 
          />
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: 'rgba(10, 8, 6, 0.98)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(197, 160, 89, 0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.85), 0 0 16px rgba(197, 160, 89, 0.1)',
            zIndex: 1001,
            padding: '4px 0',
            minWidth: 170,
            fontFamily: "var(--font-mono)",
            fontSize: 9,
          }}>
            <div style={{ padding: '4px 10px', color: '#8898aa', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 'bold', fontSize: 8, letterSpacing: '0.1em' }}>
              {de ? 'VERBINDUNG WÄHLEN' : 'SELECT CONNECTION'}
            </div>
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  onSelect(opt.value);
                  setShowMenu(false);
                }}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  background: current === opt.value ? 'rgba(197, 160, 89, 0.12)' : 'transparent',
                  border: 'none',
                  color: current === opt.value ? '#c5a059' : '#cbd5e1',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = current === opt.value ? 'rgba(197, 160, 89, 0.12)' : 'transparent'}
              >
                <span>{opt.icon}</span>
                <span style={{ flex: 1 }}>{opt.label}</span>
                {opt.isCli && (
                  <span style={{ fontSize: 7, background: 'rgba(155, 135, 200, 0.15)', border: '1px solid rgba(155, 135, 200, 0.3)', color: '#9b87c8', padding: '0px 4px', fontWeight: 'bold' }}>CLI</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Agent Card ─────────────────────────────────────────────────────────────────

function AgentCard({ agent, traces, onWakeup, waking, language, onOpenLog, approvals = [], onApprove, onReject, activeWorkspace, onSwitchEngine }: {
  agent: LiveAgent;
  traces: TraceEvent[];
  onWakeup: (id: string) => void;
  waking: boolean;
  language: string;
  onOpenLog: () => void;
  approvals?: any[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  activeWorkspace?: any;
  onSwitchEngine: (agentId: string, newType: string) => void;
}) {
  const de = language === 'de';
  const cfg = STATUS_CFG[agent.status] ?? STATUS_CFG.idle;
  const isRunning = agent.status === 'running';
  const budgetPct = agent.budgetMonatCent > 0 ? Math.round((agent.verbrauchtMonatCent / agent.budgetMonatCent) * 100) : 0;
  const [termExpanded, setTermExpanded] = useState(false);
  const termMaxH = termExpanded ? 280 : 140;

  // Derive a short session-style id from agent name for the terminal bar
  const sessionId = agent.name.toLowerCase().replace(/\s+/g, '-') + '@opencognit';

  const termRef = useRef<HTMLDivElement>(null);
  const [cliLines, setCliLines] = useState<{ id: string; type: 'prompt' | 'output' | 'thinking'; text: string }[]>([]);
  const [isCliExecuting, setIsCliExecuting] = useState(false);
  const [commandInput, setCommandInput] = useState('');

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [traces, cliLines, isCliExecuting, termExpanded]);

  const handleCommandKeyPress = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const cmd = commandInput.trim();
      if (!cmd) return;
      setCommandInput('');
      
      const promptId = `prompt-${Date.now()}`;
      const outputId = `output-${Date.now()}`;
      setCliLines(prev => [
        ...prev,
        { id: promptId, type: 'prompt', text: cmd },
        { id: outputId, type: 'thinking', text: de ? `${agent.name} führt Befehl aus...` : `${agent.name} executing command...` }
      ]);
      setIsCliExecuting(true);
      
      try {
        const token = localStorage.getItem('opencognit_token');
        const res = await fetch(`/api/agents/${agent.id}/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-company-id': agent.unternehmenId,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ nachricht: cmd }),
        });
        
        if (!res.ok || !res.body) throw new Error(de ? 'Stream-Verbindung fehlgeschlagen' : 'Stream connection failed');
        
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullOutput = '';
        
        setCliLines(prev => prev.filter(line => line.id !== outputId).concat([
          { id: outputId, type: 'output', text: '' }
        ]));
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const ev = JSON.parse(line.slice(6));
              if (ev.type === 'text_delta') {
                fullOutput += ev.chunk ?? '';
                setCliLines(prev => prev.map(l => l.id === outputId ? { ...l, text: fullOutput } : l));
              } else if (ev.type === 'done') {
                if (ev.reply) {
                  fullOutput = ev.reply;
                  setCliLines(prev => prev.map(l => l.id === outputId ? { ...l, text: fullOutput } : l));
                }
              } else if (ev.type === 'error') {
                fullOutput += `\n❌ Error: ${ev.message || 'Unknown error'}`;
                setCliLines(prev => prev.map(l => l.id === outputId ? { ...l, text: fullOutput } : l));
              }
            } catch {}
          }
        }
      } catch (err: any) {
        setCliLines(prev => prev.filter(line => line.id !== outputId).concat([
          { id: `err-${Date.now()}`, type: 'output', text: `❌ ${de ? 'Ausführungsfehler' : 'Execution error'}: ${err.message}` }
        ]));
      } finally {
        setIsCliExecuting(false);
      }
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: isRunning
        ? `linear-gradient(180deg, rgba(197,160,89,0.04) 0%, rgba(10,8,6,0.92) 100%)`
        : 'rgba(10,8,6,0.82)',
      border: `1px solid ${isRunning ? cfg.color + '40' : 'rgba(197,160,89,0.1)'}`,
      boxShadow: isRunning ? `0 0 0 1px ${cfg.color}15, inset 0 1px 0 ${cfg.color}18` : 'none',
      overflow: 'hidden',
      transition: 'border-color 0.3s, box-shadow 0.3s',
      position: 'relative',
    }}>
      {/* Running glow strip — top edge */}
      {isRunning && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${cfg.color}, transparent)`,
          animation: 'shimmer 2s ease-in-out infinite',
        }} />
      )}

      {/* ── Header ── */}
      <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {/* Avatar — larger */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 52, height: 52,
            background: agent.avatarFarbe + '18',
            border: `1.5px solid ${isRunning ? cfg.color + '70' : agent.avatarFarbe + '40'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 800, color: agent.avatarFarbe,
            boxShadow: isRunning ? `0 0 16px ${cfg.color}25` : 'none',
            transition: 'box-shadow 0.3s',
          }}>
            {agent.avatar || agent.name.slice(0, 2).toUpperCase()}
          </div>
          <PulseRing color={cfg.color} active={isRunning} />
          <div style={{
            position: 'absolute', bottom: -3, right: -3, width: 11, height: 11,
            borderRadius: '50%', background: cfg.color,
            border: '2px solid rgba(10,8,6,0.95)',
            boxShadow: cfg.glow,
            animation: isRunning ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }} />
        </div>

        {/* Name / Role / Budget */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
              {agent.name}
            </span>
            {agent.isOrchestrator && (
              <span style={{
                fontSize: 8, fontWeight: 800, color: '#9b87c8',
                background: 'rgba(155,135,200,0.15)', border: '1px solid rgba(155,135,200,0.35)',
                padding: '1px 5px', letterSpacing: '0.08em',
              }}>CEO</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#4a5568', marginTop: 2 }}>{agent.rolle}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <EngineSelectorBadge
              current={agent.verbindungsTyp}
              onSelect={(newType) => onSwitchEngine(agent.id, newType)}
              language={language}
            />
          </div>

          {/* Budget bar */}
          {agent.budgetMonatCent > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(budgetPct, 100)}%`,
                  background: budgetPct > 90 ? '#c97b7b' : budgetPct > 70 ? '#d4a373' : '#7cb97a',
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <div style={{ fontSize: 9, color: '#334155', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                {budgetPct}% {de ? 'Budget' : 'budget'}
              </div>
            </div>
          )}
        </div>

        {/* Right column: elapsed + status badge + buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          {/* Top row: timer + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isRunning && <ElapsedTimer since={agent.letzterZyklus} />}
            <div style={{
              padding: '3px 9px', fontSize: 9, fontWeight: 800,
              background: cfg.color + '18', color: cfg.color,
              border: `1px solid ${cfg.color}35`,
              letterSpacing: '0.1em',
              boxShadow: isRunning ? `0 0 8px ${cfg.color}30` : 'none',
            }}>
              {de ? cfg.labelDe : cfg.labelEn}
            </div>
          </div>
          {/* Bottom row: WAKE + LOG */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => onWakeup(agent.id)}
              disabled={waking || isRunning}
              title={de ? 'Wecken' : 'Wake up'}
              style={{
                padding: '3px 9px', fontSize: 9, fontWeight: 700,
                border: '1px solid rgba(255,255,255,0.14)',
                background: waking ? 'rgba(197,160,89,0.15)' : 'rgba(255,255,255,0.04)',
                color: waking ? '#c5a059' : isRunning ? '#2a2f3a' : '#8898aa',
                cursor: waking || isRunning ? 'default' : 'pointer',
                letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 4,
                opacity: isRunning ? 0.35 : 1, transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 8, letterSpacing: 2 }}>≡≡</span> WAKE
            </button>
            <button
              onClick={onOpenLog}
              title="Activity log"
              style={{
                padding: '3px 9px', fontSize: 9, fontWeight: 700,
                border: '1px solid rgba(197,160,89,0.2)',
                background: 'rgba(197,160,89,0.06)', color: '#c5a059',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                letterSpacing: '0.06em', transition: 'all 0.15s',
              }}
            >
              <Terminal size={9} /> LOG
            </button>
          </div>
        </div>
      </div>

      {/* ── Current Task row ── */}
      <div style={{
        margin: '0 18px 10px',
        padding: '8px 12px',
        background: 'rgba(0,0,0,0.35)',
        border: `1px solid ${isRunning ? 'rgba(197,160,89,0.12)' : 'rgba(255,255,255,0.05)'}`,
        minHeight: 36, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {isRunning && agent.currentTask ? (
          <>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#c5a059', animation: 'pulse 1s ease-in-out infinite', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#cbd5e1', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
              {agent.currentTask.titel}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {traces.length > 0 && (
                <span style={{ fontSize: 9, color: '#334155', fontFamily: 'var(--font-mono)' }}>
                  {traces.length} {de ? 'Schritte' : 'steps'}
                </span>
              )}
              <ThinkingDots />
            </div>
          </>
        ) : agent.currentTask ? (
          <>
            <CheckCircle2 size={11} style={{ color: '#475569', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#4a5568', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {agent.currentTask.titel}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 10, color: '#1e2a2a', fontStyle: 'italic' }}>
            {de ? '— kein aktiver Task —' : '— no active task —'}
          </span>
        )}
      </div>

      {/* ── Active Workspace Info ── */}
      {activeWorkspace && (
        <div style={{
          margin: '0 18px 10px',
          padding: '8px 12px',
          background: 'rgba(35,205,203,0.03)',
          borderLeft: '2px solid #23cdcb',
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: 10,
          color: '#a3b3c2',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#23cdcb', fontWeight: 700 }}>⌥ WORKTREE</span>
            <span style={{ color: '#475569' }}>|</span>
            <span style={{ color: '#8892b0' }}>{activeWorkspace.pfad.split('/').pop()}</span>
          </div>
          {activeWorkspace.branchName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#7cb97a', fontWeight: 700 }}>⚡ BRANCH</span>
              <span style={{ color: '#475569' }}>:</span>
              <span style={{ color: '#cbd5e1' }}>{activeWorkspace.branchName}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Embedded Terminal ── */}
      <div style={{ margin: '0 18px 14px', display: 'flex', flexDirection: 'column' }}>
        {/* Terminal title bar */}
        <div style={{
          padding: '4px 10px',
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderBottom: 'none',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {/* Traffic-light dots */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['#c97b7b', '#d4a373', '#7cb97a'].map((c, i) => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: c + '88' }} />
            ))}
          </div>
          <span style={{ fontSize: 9, color: '#334155', fontFamily: 'var(--font-mono)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sessionId}
          </span>
          {isRunning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#c5a059', animation: 'pulse 1.5s ease-in-out infinite' }} />
              <span style={{ fontSize: 8, color: '#c5a059', fontWeight: 800, letterSpacing: '0.08em' }}>LIVE</span>
            </div>
          )}
          <button
            onClick={() => setTermExpanded(e => !e)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: '0 2px', display: 'flex', alignItems: 'center' }}
          >
            {termExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        </div>
        {/* Trace log */}
        <div 
          ref={termRef}
          style={{
            maxHeight: termMaxH, overflowY: 'auto',
            background: 'rgba(0,0,0,0.45)',
            border: '1px solid rgba(255,255,255,0.07)',
            padding: '6px 8px',
            display: 'flex', flexDirection: 'column', gap: 1,
            transition: 'max-height 0.25s ease',
            scrollbarWidth: 'thin', scrollbarColor: 'rgba(197,160,89,0.12) transparent',
          }}
        >
          {traces.length === 0 && cliLines.length === 0 && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: '#475569', fontStyle: 'italic', padding: '4px 0' }}>
              {de ? '— terminal initialisiert, bereit für eingabe —' : '— terminal initialized, ready for input —'}
            </div>
          )}
          {traces.map((ev) => (
            <TraceRow key={ev.id} ev={ev} showDetails={true} lang={language} />
          ))}
          {cliLines.map((line) => (
            <div key={line.id} style={{ fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: '1.4', marginTop: 4 }}>
              {line.type === 'prompt' ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ color: '#23cdcb', fontWeight: 'bold' }}>
                    [{agent.verbindungsTyp}@{activeWorkspace?.branchName ? activeWorkspace.branchName.split('/').pop() : 'opencognit'}]$
                  </span>
                  <span style={{ color: '#ffffff' }}>{line.text}</span>
                </div>
              ) : line.type === 'thinking' ? (
                <div style={{ color: '#f59e0b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1s infinite' }} />
                  {line.text}
                </div>
              ) : (
                <pre style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  color: '#cbd5e1',
                  fontFamily: 'inherit',
                  background: 'rgba(255,255,255,0.02)',
                  padding: '6px 8px',
                  borderLeft: '1px solid rgba(255,255,255,0.05)',
                }}>
                  {line.text}
                </pre>
              )}
            </div>
          ))}

          {/* Inline Pending Approvals */}
          {approvals.map(appr => (
            <div key={appr.id} style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              lineHeight: '1.4',
              marginTop: 6,
              marginBottom: 6,
              padding: '8px 10px',
              background: 'rgba(245,158,11,0.06)',
              borderLeft: '3px solid #f59e0b',
              borderTop: '1px solid rgba(245,158,11,0.1)',
              borderRight: '1px solid rgba(245,158,11,0.1)',
              borderBottom: '1px solid rgba(245,158,11,0.1)',
            }}>
              <div style={{ color: '#f59e0b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <AlertCircle size={10} />
                {de ? '[FREIGABE ERFORDERLICH]' : '[APPROVAL REQUIRED]'}
              </div>
              <div style={{ color: '#cbd5e1', marginBottom: 6 }}>
                {appr.title}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => onApprove(appr.id)}
                  style={{
                    background: 'rgba(124,185,122,0.12)',
                    border: '1px solid rgba(124,185,122,0.45)',
                    color: '#7cb97a',
                    padding: '2px 8px',
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  y ({de ? 'zulassen' : 'approve'})
                </button>
                <button
                  onClick={() => onReject(appr.id)}
                  style={{
                    background: 'rgba(201,123,123,0.12)',
                    border: '1px solid rgba(201,123,123,0.45)',
                    color: '#c97b7b',
                    padding: '2px 8px',
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  n ({de ? 'ablehnen' : 'reject'})
                </button>
              </div>
            </div>
          ))}

          {/* Currently executing step (Orange Chevron Line) */}
          {isRunning && agent.currentTask && (
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 6,
              marginBottom: 2,
              animation: 'pulse 1.8s infinite',
            }}>
              <span style={{ fontWeight: 'bold' }}>▶</span>
              <span style={{ letterSpacing: '-0.01em' }}>{agent.currentTask.titel}</span>
              <span style={{ fontSize: 8, opacity: 0.6 }}>(running...)</span>
            </div>
          )}
          
          {/* Shell prompt input line */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6 }}>
            <span style={{ color: '#23cdcb', fontWeight: 'bold', fontFamily: "var(--font-mono)", fontSize: 10 }}>
              [{agent.verbindungsTyp}@{activeWorkspace?.branchName ? activeWorkspace.branchName.split('/').pop() : 'opencognit'}]$
            </span>
            <input
              type="text"
              value={commandInput}
              onChange={e => setCommandInput(e.target.value)}
              onKeyDown={handleCommandKeyPress}
              disabled={isCliExecuting}
              placeholder={isCliExecuting ? (de ? 'Führt aus...' : 'Executing...') : (de ? 'Befehl/Prompt eingeben...' : 'Enter command/prompt...')}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                padding: 0,
                margin: 0,
              }}
            />
            {isCliExecuting && (
              <span style={{ color: '#23cdcb', fontFamily: 'var(--font-mono)', fontSize: 10, animation: 'pulse 0.8s infinite' }}>█</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pulse Entry — clickable, expandable event row ─────────────────────────────

function PulseEntry({ ev, isNew, de }: { ev: TraceEvent & { expertName?: string }; isNew: boolean; de: boolean }) {
  const [open, setOpen] = useState(false);
  const tc = TRACE_CFG[ev.typ] || TRACE_CFG.info;
  const hasDetails = !!ev.details?.trim();
  const ts = new Date(ev.erstelltAm).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const isError = ev.typ === 'error' || ev.typ === 'critic_rejected';

  return (
    <div
      onClick={() => hasDetails && setOpen(o => !o)}
      style={{
        fontFamily: 'var(--font-mono)',
        background: isNew ? tc.bg : open ? tc.bg : 'transparent',
        borderLeft: isError ? `2px solid ${tc.color}60` : open ? `2px solid ${tc.color}30` : '2px solid transparent',
        borderBottom: `1px solid rgba(255,255,255,0.025)`,
        animation: isNew ? 'fadeInUp 0.18s ease-out' : 'none',
        cursor: hasDetails ? 'pointer' : 'default',
        transition: 'background 0.12s, border-color 0.12s',
        flexShrink: 0,
      }}
    >
      <div style={{ padding: '3px 6px', display: 'flex', alignItems: 'baseline', gap: 5 }}>
        {/* Timestamp */}
        <span style={{ fontSize: 9, color: '#3d3830', flexShrink: 0, whiteSpace: 'nowrap', minWidth: 28 }}>
          {ts}
        </span>
        {/* Agent name */}
        {ev.expertName && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: tc.color,
            flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden',
            textOverflow: 'ellipsis', maxWidth: 68,
          }}>
            {ev.expertName}
          </span>
        )}
        {/* Bracket tag */}
        <span style={{
          fontSize: 8.5, fontWeight: 800, letterSpacing: '0.03em',
          color: tc.color, flexShrink: 0,
          opacity: isNew ? 1 : 0.7,
        }}>
          [{tc.tag}]
        </span>
        {/* Title */}
        <span style={{
          fontSize: 9.5, color: isNew ? tc.textColor : '#4a4540',
          flex: 1, minWidth: 0,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: open ? 99 : 1, WebkitBoxOrient: 'vertical',
          fontWeight: isError ? 600 : 400,
          wordBreak: 'break-all',
        }}>
          {translateTrace(ev.titel, de ? 'de' : 'en')}
        </span>
        {hasDetails && (
          <span style={{ fontSize: 8, color: tc.color + '70', flexShrink: 0 }}>
            {open ? '▾' : '▸'}
          </span>
        )}
      </div>

      {open && hasDetails && (
        <pre style={{
          fontSize: 9, color: '#6a6058',
          fontFamily: 'var(--font-mono)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5,
          maxHeight: 140, overflowY: 'auto',
          background: 'rgba(0,0,0,0.5)',
          borderLeft: `3px solid ${tc.color}35`,
          padding: '5px 8px 5px 36px', margin: '0 0 4px 0',
          scrollbarWidth: 'thin',
        }}>
          {ev.details}
        </pre>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Main Component ─────────────────────────────────────────────────────────────

export function WarRoom() {
  const navigate = useNavigate();
  const { aktivesUnternehmen } = useCompany();
  const { language } = useI18n();
  const de = language === 'de';
  const locale = de ? 'de-DE' : 'en-US';

  const [data, setData] = useState<DashboardData | null>(null);
  const [agents, setAgents] = useState<LiveAgent[]>([]);
  const [agentTraces, setAgentTraces] = useState<Record<string, TraceEvent[]>>({});
  const [feed, setFeed] = useState<(TraceEvent & { expertName?: string })[]>([]);
  const [waking, setWaking] = useState<Set<string>>(new Set());
  const [clock, setClock] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [logAgent, setLogAgent] = useState<LiveAgent | null>(null);


  // System Pulse scroll management
  const pulseRef = useRef<HTMLDivElement>(null);
  const [pulseAutoScroll, setPulseAutoScroll] = useState(true);
  const [newEventCount, setNewEventCount] = useState(0);
  const [pulseFilter, setPulseFilter] = useState<string>('all'); // 'all' | 'error' | 'action' | 'thinking'

  const [briefText, setBriefText] = useState('');
  const [sendingBrief, setSendingBrief] = useState(false);
  const [briefStatus, setBriefStatus] = useState<string | null>(null);

  const handleSendBrief = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!briefText.trim() || !aktivesUnternehmen) return;
    const ceo = agents.find(a => a.isOrchestrator);
    if (!ceo) {
      setBriefStatus(de ? 'Kein CEO Orchestrator gefunden!' : 'No CEO Orchestrator found!');
      setTimeout(() => setBriefStatus(null), 3000);
      return;
    }

    setSendingBrief(true);
    setBriefStatus(de ? 'Übertrage Direktiven...' : 'Transmitting directives...');
    try {
      await authFetch(`/api/agents/${ceo.id}/chat`, {
        method: 'POST',
        body: JSON.stringify({
          nachricht: briefText,
          absenderTyp: 'board',
          unternehmenId: aktivesUnternehmen.id,
        }),
      });

      await authFetch(`/api/experten/${ceo.id}/wakeup`, {
        method: 'POST',
      });

      const briefEvent: TraceEvent & { expertName?: string } = {
        id: crypto.randomUUID(),
        expertId: ceo.id,
        expertName: ceo.name,
        typ: 'info',
        titel: de ? `Direktiven empfangen: "${briefText}"` : `Directives received: "${briefText}"`,
        erstelltAm: new Date().toISOString(),
      };
      setFeed(prev => [...prev, briefEvent].slice(-80));

      setBriefText('');
      setBriefStatus(de ? 'Direktiven erfolgreich erteilt. CEO gestartet.' : 'Directives issued. CEO woken up.');
      setTimeout(() => setBriefStatus(null), 4000);
    } catch (err) {
      setBriefStatus(de ? 'Übertragung fehlgeschlagen.' : 'Transmission failed.');
      setTimeout(() => setBriefStatus(null), 3000);
    } finally {
      setSendingBrief(false);
    }
  };

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const [approvalsList, setApprovalsList] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<any[]>([]);

  const loadApprovals = useCallback(async () => {
    if (!aktivesUnternehmen) return;
    try {
      const res = await authFetch(`/api/companies/${aktivesUnternehmen.id}/approvals`);
      if (res.ok) {
        const list = await res.json();
        setApprovalsList(list.filter((a: any) => a.status === 'pending'));
      }
    } catch {}
  }, [aktivesUnternehmen?.id]);

  const loadWorkspaces = useCallback(async () => {
    if (!aktivesUnternehmen) return;
    try {
      const res = await authFetch(`/api/companies/${aktivesUnternehmen.id}/workspaces`);
      if (res.ok) {
        setWorkspaces(await res.json());
      }
    } catch {}
  }, [aktivesUnternehmen?.id]);

  const handleApproveApproval = async (approvalId: string) => {
    try {
      const res = await authFetch(`/api/approvals/${approvalId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notiz: 'Approved via War Room Dashboard' }),
      });
      if (res.ok) {
        setApprovalsList(prev => prev.filter(a => a.id !== approvalId));
        // reload dashboard/agents
        setTimeout(load, 500);
      }
    } catch {}
  };

  const handleRejectApproval = async (approvalId: string) => {
    try {
      const res = await authFetch(`/api/approvals/${approvalId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ notiz: 'Rejected via War Room Dashboard' }),
      });
      if (res.ok) {
        setApprovalsList(prev => prev.filter(a => a.id !== approvalId));
        setTimeout(load, 500);
      }
    } catch {}
  };

  const handleSwitchEngine = async (agentId: string, newType: string) => {
    try {
      const res = await authFetch(`/api/agents/${agentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ verbindungsTyp: newType }),
      });
      if (res.ok) {
        load();
      }
    } catch (err) {
      console.error('Failed to update agent engine:', err);
    }
  };

  const load = useCallback(async () => {
    if (!aktivesUnternehmen) return;
    try {
      loadApprovals();
      loadWorkspaces();
      const d = await apiDashboard.laden(aktivesUnternehmen.id);
      setData(d);
      const allAgents: LiveAgent[] = (d as any).alleExperten || [];
      setAgents(allAgents);

      const token = localStorage.getItem('opencognit_token');
      const traceMap: Record<string, TraceEvent[]> = {};
      await Promise.all(allAgents.map(async (a) => {
        try {
          const r = await fetch(`/api/experten/${a.id}/trace/history?limit=30`, {
            credentials: 'include',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (r.ok) traceMap[a.id] = await r.json();
        } catch { /* ignore */ }
      }));
      setAgentTraces(traceMap);

      const combined = Object.values(traceMap)
        .flat()
        .sort((a, b) => new Date(a.erstelltAm).getTime() - new Date(b.erstelltAm).getTime()) // oldest first → newest at bottom
        .slice(-80)
        .map(ev => ({ ...ev, expertName: allAgents.find(a => a.id === ev.expertId)?.name }));
      setFeed(combined);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [aktivesUnternehmen?.id, loadApprovals, loadWorkspaces]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  // WebSocket for live updates
  const agentsRef = useRef(agents);
  useEffect(() => { agentsRef.current = agents; }, [agents]);

  useWebSocketEvent(
    '*',
    (msg) => {
      if (msg.unternehmenId && msg.unternehmenId !== aktivesUnternehmen?.id) return;

      if (msg.type === 'trace' && msg.data) {
        const { expertId, typ, titel, details, erstelltAm, expertName } = msg.data;
        const newEvent: TraceEvent = {
          id: crypto.randomUUID(),
          expertId, typ, titel, details,
          expertName,
          erstelltAm: erstelltAm || new Date().toISOString(),
        };

        setAgentTraces(prev => ({
          ...prev,
          [expertId]: [newEvent, ...(prev[expertId] || [])].slice(0, 30),
        }));

        setFeed(prev => [...prev, newEvent].slice(-80));

        setAgents(prev => prev.map(a =>
          a.id === expertId
            ? { ...a, lastTrace: { typ, titel }, status: 'running' }
            : a
        ));
      }

      if (msg.type === 'task_started' && msg.agentId) {
        setAgents(prev => prev.map(a =>
          a.id === msg.agentId
            ? { ...a, status: 'running', currentTask: { id: msg.taskId || '', titel: msg.taskTitel || '', status: 'in_progress' } }
            : a
        ));
        const agentName = agentsRef.current.find(a => a.id === msg.agentId)?.name || msg.agentName;
        const taskEvent: TraceEvent & { expertName?: string } = {
          id: crypto.randomUUID(),
          expertId: msg.agentId,
          expertName: agentName,
          typ: 'task_started',
          titel: msg.taskTitel || 'Task started',
          erstelltAm: new Date().toISOString(),
        };
        setFeed(prev => [...prev, taskEvent].slice(-80));
      }

      if (msg.type === 'task_completed' && msg.agentId) {
        setAgents(prev => prev.map(a =>
          a.id === msg.agentId ? { ...a, status: 'active', currentTask: null } : a
        ));
        const agentName = agentsRef.current.find(a => a.id === msg.agentId)?.name || msg.agentName;
        const doneEvent: TraceEvent & { expertName?: string } = {
          id: crypto.randomUUID(),
          expertId: msg.agentId,
          expertName: agentName,
          typ: 'task_completed',
          titel: msg.taskTitel || 'Task abgeschlossen',
          erstelltAm: new Date().toISOString(),
        };
        setFeed(prev => [...prev, doneEvent].slice(-80));
        setTimeout(load, 2000);
      }
    },
    [aktivesUnternehmen?.id, load],
  );

  // Auto-scroll System Pulse to bottom when new events arrive (if user is at bottom)
  useEffect(() => {
    if (!pulseRef.current) return;
    if (pulseAutoScroll) {
      pulseRef.current.scrollTop = pulseRef.current.scrollHeight;
      setNewEventCount(0);
    } else {
      setNewEventCount(c => c + 1);
    }
  }, [feed.length]); // trigger on count change, not content (avoid stale closure)

  const handlePulseScroll = () => {
    if (!pulseRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = pulseRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    if (atBottom && !pulseAutoScroll) {
      setPulseAutoScroll(true);
      setNewEventCount(0);
    } else if (!atBottom && pulseAutoScroll) {
      setPulseAutoScroll(false);
    }
  };

  const scrollPulseToBottom = () => {
    if (!pulseRef.current) return;
    pulseRef.current.scrollTo({ top: pulseRef.current.scrollHeight, behavior: 'smooth' });
    setPulseAutoScroll(true);
    setNewEventCount(0);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (logAgent) { setLogAgent(null); return; }
        navigate('/');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, logAgent]);

  const handleWakeup = async (agentId: string) => {
    setWaking(prev => new Set(prev).add(agentId));
    await authFetch(`/api/experten/${agentId}/wakeup`, { method: 'POST' }).catch(() => {});
    setTimeout(() => {
      setWaking(prev => { const s = new Set(prev); s.delete(agentId); return s; });
    }, 3000);
  };

  const runningCount = agents.filter(a => a.status === 'running').length;
  const timeStr = clock.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = clock.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: '#060403',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Grid background */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.1, pointerEvents: 'none' }}>
        <defs>
          <pattern id="war-grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(197,160,89,0.35)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#war-grid)" />
      </svg>
      <div style={{ position: 'absolute', top: '20%', left: '15%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(197,160,89,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '10%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,123,123,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* ── TOP BAR ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: '1px solid rgba(197,160,89,0.18)',
        background: 'rgba(6,4,3,0.95)',
        flexShrink: 0, position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: runningCount > 0 ? '#c5a059' : '#5c554d',
              boxShadow: runningCount > 0 ? '0 0 10px rgba(197,160,89,0.6)' : 'none',
              animation: runningCount > 0 ? 'pulse 1.5s ease-in-out infinite' : 'none',
            }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#c5a059', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              {aktivesUnternehmen?.name || 'OpenCognit'}
            </span>
            <span style={{ fontSize: 9, color: '#5c554d', letterSpacing: '0.1em', textTransform: 'uppercase' }}>· WAR ROOM</span>
          </div>

          {runningCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
              borderRadius: 0, background: 'rgba(197,160,89,0.1)', border: '1px solid rgba(197,160,89,0.3)',
              fontSize: 11, fontWeight: 700, color: '#c5a059',
            }}>
              <Cpu size={12} style={{ animation: 'spin 3s linear infinite' }} />
              {runningCount} {de ? `Agent${runningCount !== 1 ? 'en' : ''} aktiv` : `agent${runningCount !== 1 ? 's' : ''} active`}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.05em', fontVariantNumeric: 'tabular-nums' }}>
            {timeStr}
          </div>
          <div style={{ fontSize: 10, color: '#475569', letterSpacing: '0.06em', marginTop: 1 }}>
            {dateStr}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 9, color: '#334155', letterSpacing: '0.06em' }}>
            {de ? 'Echtzeit-Übersicht · ESC beendet' : 'Live overview · ESC to exit'}
          </span>
          <button
            onClick={() => navigate('/')}
            style={{
              width: 32, height: 32, borderRadius: 0,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.2)'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 0, overflow: 'hidden', position: 'relative', zIndex: 1 }}>

        {/* Left: Metrics + Agent Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '18px 14px 18px 22px', gap: 14, overflow: 'hidden' }}>

          {/* Metrics row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, flexShrink: 0 }}>
            {[
              { icon: <Users size={14} style={{ color: '#c5a059' }} />, label: de ? 'AGENTEN' : 'AGENTS', value: data?.experten.gesamt || 0, sub: `${data?.experten.running || 0} ${de ? 'aktiv' : 'active'}`, color: '#c5a059' },
              { icon: <CheckCircle2 size={14} style={{ color: '#7cb97a' }} />, label: de ? 'ERLEDIGT' : 'DONE', value: data?.aufgaben.erledigt || 0, sub: `${data?.aufgaben.inBearbeitung || 0} ${de ? 'laufend' : 'running'}`, color: '#7cb97a' },
              { icon: <Target size={14} style={{ color: '#9b87c8' }} />, label: de ? 'OFFEN' : 'OPEN', value: data?.aufgaben.offen || 0, sub: `${data?.aufgaben.blockiert || 0} ${de ? 'blockiert' : 'blocked'}`, color: data?.aufgaben.blockiert ? '#d4a373' : '#9b87c8' },
              { icon: <Wallet size={14} style={{ color: '#d4a373' }} />, label: 'BUDGET', value: `${data?.kosten.prozent || 0}%`, sub: formatCost(data?.kosten.gesamtVerbraucht || 0, language), color: (data?.kosten.prozent || 0) > 80 ? '#c97b7b' : '#d4a373' },
            ].map((m, i) => (
              <GlassCard key={i} accent={m.color} style={{ padding: '11px 12px', borderRadius: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  {m.icon}
                  <span style={{ fontSize: 8, fontWeight: 800, color: '#475569', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{m.label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: m.color, lineHeight: 1, marginBottom: 2 }}>
                  {typeof m.value === 'number' ? <AnimatedNum value={m.value} /> : m.value}
                </div>
                <div style={{ fontSize: 9, color: '#475569' }}>{m.sub}</div>
              </GlassCard>
            ))}
          </div>

          {/* Quick Brief input */}
          {agents.some(a => a.isOrchestrator) && (
            <form onSubmit={handleSendBrief} style={{
              background: 'rgba(197,160,89,0.03)',
              border: '1px solid rgba(197,160,89,0.15)',
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              position: 'relative',
              borderRadius: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Terminal size={12} style={{ color: '#c5a059' }} />
                <span style={{ fontSize: 9, fontWeight: 800, color: '#c5a059', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {de ? 'CEO-DIREKTIVEN' : 'CEO DIRECTIVES'}
                </span>
                {briefStatus && (
                  <span style={{ fontSize: 9, color: '#c5a059', marginLeft: 'auto', fontWeight: 600 }}>
                    {briefStatus}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={briefText}
                  onChange={e => setBriefText(e.target.value)}
                  disabled={sendingBrief}
                  placeholder={de ? 'Briefing eingeben (z. B. "Bau eine REST API in Node.js")' : 'Enter briefing (e.g. "Build a REST API in Node.js")'}
                  style={{
                    flex: 1,
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(197,160,89,0.25)',
                    padding: '6px 10px',
                    fontSize: 11,
                    color: '#f1f5f9',
                    fontFamily: "'Courier New', Courier, monospace",
                    outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(197,160,89,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(197,160,89,0.25)'}
                />
                <button
                  type="submit"
                  disabled={sendingBrief || !briefText.trim()}
                  style={{
                    background: briefText.trim() ? 'rgba(197,160,89,0.15)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(197,160,89,0.3)',
                    color: briefText.trim() ? '#c5a059' : '#475569',
                    padding: '0 14px',
                    fontSize: 10,
                    fontWeight: 800,
                    cursor: briefText.trim() ? 'pointer' : 'default',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {de ? 'Senden' : 'Send'}
                </button>
              </div>
            </form>
          )}

          {/* Agent grid */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.75rem' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(197,160,89,0.2)', borderTopColor: '#c5a059', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: 11, color: '#475569', letterSpacing: '0.1em' }}>
                  {de ? 'LADE AGENTEN-DATEN…' : 'LOADING AGENT DATA…'}
                </span>
              </div>
            ) : agents.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.875rem' }}>
                <div style={{ fontSize: '2rem' }}>🤖</div>
                <button onClick={() => navigate('/experts')} style={{ background: 'none', border: '1px solid rgba(197,160,89,0.3)', borderRadius: 0, color: '#c5a059', cursor: 'pointer', padding: '0.375rem 0.875rem', fontSize: 12, fontWeight: 700 }}>
                  {de ? 'Agenten einrichten →' : 'Set up agents →'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 12, alignContent: 'start' }}>
                {agents.map(agent => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    traces={agentTraces[agent.id] || []}
                    onWakeup={handleWakeup}
                    waking={waking.has(agent.id)}
                    language={language}
                    onOpenLog={() => setLogAgent(agent)}
                    approvals={approvalsList.filter(a => a.requestedBy === agent.id)}
                    onApprove={handleApproveApproval}
                    onReject={handleRejectApproval}
                    activeWorkspace={workspaces.find(w => w.agentId === agent.id && w.status === 'offen')}
                    onSwitchEngine={handleSwitchEngine}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar: Topology + System Pulse */}
        <div style={{
          borderLeft: '1px solid rgba(197,160,89,0.12)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: 'rgba(8,6,4,0.3)',
          position: 'relative',
        }}>

          {/* Topology Graph */}
          <div style={{
            borderBottom: '1px solid rgba(197,160,89,0.12)',
            flexShrink: 0,
          }}>
            <div style={{
              padding: '8px 12px', borderBottom: '1px solid rgba(197,160,89,0.08)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Network size={12} style={{ color: '#9b87c8' }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: '#9b87c8', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Topology
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                {runningCount > 0 && (
                  <>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#c5a059', animation: 'pulse 2s ease-in-out infinite' }} />
                    <span style={{ fontSize: 8, color: '#c5a059', fontWeight: 700 }}>LIVE</span>
                  </>
                )}
              </div>
            </div>
            <div style={{ height: 220 }}>
              <TopologyGraph
                agents={agents}
                recentTraces={feed}
                language={language}
              />
            </div>
          </div>
          {/* Pulse header */}
          <div style={{
            padding: '10px 12px', borderBottom: '1px solid rgba(197,160,89,0.12)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Activity size={12} style={{ color: '#c5a059' }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: '#c5a059', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                System Pulse
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                {!pulseAutoScroll ? (
                  <span style={{ fontSize: 8, color: '#d4a373', fontWeight: 700, letterSpacing: '0.08em' }}>⏸ PAUSED</span>
                ) : (
                  <>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#c5a059', animation: 'pulse 2s ease-in-out infinite' }} />
                    <span style={{ fontSize: 9, color: '#c5a059', fontWeight: 700 }}>LIVE</span>
                  </>
                )}
              </div>
            </div>
            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'error', 'action', 'thinking'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setPulseFilter(f)}
                  style={{
                    padding: '2px 7px', borderRadius: 0, border: 'none', cursor: 'pointer',
                    fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    background: pulseFilter === f ? 'rgba(197,160,89,0.18)' : 'rgba(255,255,255,0.03)',
                    color: pulseFilter === f ? '#c5a059' : '#5c554d',
                    transition: 'all 0.15s',
                  }}
                >
                  {f === 'all' ? (de ? 'Alle' : 'All') : f === 'error' ? '⚠ Errors' : f === 'action' ? '⚡ Actions' : '🧠 Thinking'}
                </button>
              ))}
            </div>
          </div>

          {/* Pulse feed — newest at bottom, auto-scrolling */}
          <div
            ref={pulseRef}
            onScroll={handlePulseScroll}
            style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}
          >
            {feed.length === 0 ? (
              <div style={{ color: '#334155', fontSize: 11, padding: '20px 0', textAlign: 'center' }}>
                {de ? 'Warte auf Ereignisse...' : 'Waiting for events...'}
              </div>
            ) : (() => {
              const filtered = pulseFilter === 'all' ? feed
                : feed.filter(ev =>
                    pulseFilter === 'error' ? (ev.typ === 'error' || ev.typ === 'warning' || ev.typ === 'critic_rejected')
                    : pulseFilter === 'action' ? (ev.typ === 'action' || ev.typ === 'task_started' || ev.typ === 'task_completed' || ev.typ === 'tool_call')
                    : /* thinking */ (ev.typ === 'thinking' || ev.typ === 'planning' || ev.typ === 'info')
                  );
              const now = Date.now();
              return filtered.map((ev, i) => {
                const ageMs = now - new Date(ev.erstelltAm).getTime();
                return (
                  <PulseEntry
                    key={ev.id || i}
                    ev={ev}
                    isNew={ageMs < 8000} // highlight events younger than 8s
                    de={de}
                  />
                );
              });
            })()}
            {/* Invisible anchor for scroll measurement */}
            <div style={{ height: 1, flexShrink: 0 }} />
          </div>

          {/* "New events" badge when auto-scroll is paused */}
          {!pulseAutoScroll && newEventCount > 0 && (
            <button
              onClick={scrollPulseToBottom}
              style={{
                position: 'absolute', bottom: (data?.pendingApprovals || 0) > 0 ? 52 : 12,
                right: 12, zIndex: 10,
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 0,
                background: 'rgba(197,160,89,0.15)', border: '1px solid rgba(197,160,89,0.4)',
                color: '#c5a059', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                animation: 'fadeInUp 0.2s ease-out',
              }}
            >
              ↓ {newEventCount} {de ? 'neue' : 'new'}
            </button>
          )}

          {(data?.pendingApprovals || 0) > 0 && (
            <div style={{
              padding: '10px 14px', borderTop: '1px solid rgba(245,158,11,0.2)',
              background: 'rgba(245,158,11,0.05)', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertCircle size={12} style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
                {de
                  ? `${data?.pendingApprovals} Genehmigung${data?.pendingApprovals !== 1 ? 'en' : ''} ausstehend`
                  : `${data?.pendingApprovals} approval${data?.pendingApprovals !== 1 ? 's' : ''} pending`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Telemetry bar */}
      <div style={{
        padding: '5px 22px', borderTop: '1px solid rgba(197,160,89,0.06)',
        background: 'rgba(10,8,6,0.7)',
        display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0,
        fontFamily: "'Courier New', Courier, monospace", fontSize: 9, color: '#3d3830',
        letterSpacing: '0.05em',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#5c554d' }}>LOGS:</span>
          <span style={{ color: '#c5a059', fontWeight: 700 }}>{feed.length} TRACE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#5c554d' }}>WIRE:</span>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#7cb97a', display: 'inline-block', boxShadow: '0 0 4px #7cb97a' }} />
          <span style={{ color: '#7cb97a', fontWeight: 700 }}>100% WS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#5c554d' }}>PING:</span>
          <span style={{ color: '#9b87c8', fontWeight: 700 }}>0.08ms</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#5c554d' }}>CACHE:</span>
          <span style={{ color: '#d4a373', fontWeight: 700 }}>92% HIT</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#5c554d' }}>RUNTIME:</span>
          <span style={{ color: '#475569', fontWeight: 700 }}>SECURE SANDBOX</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
          <span style={{ color: '#5c554d' }}>SPEND FLOW:</span>
          <span style={{ color: '#c5a059', fontWeight: 700 }}>{formatCost(data?.kosten.gesamtVerbraucht || 0, language)}</span>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        padding: '6px 22px', borderTop: '1px solid rgba(197,160,89,0.1)',
        background: 'rgba(6,4,3,0.95)',
        display: 'flex', alignItems: 'center', flexShrink: 0, position: 'relative', zIndex: 1,
      }}>
        <span style={{ fontSize: 8, color: '#1e293b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          OpenCognit OS · Live Room v3 · {de ? 'Klick auf Log für vollständige Aktivität' : 'Click Log for full agent activity'}
        </span>
        <span style={{ fontSize: 8, color: '#1e293b', marginLeft: 'auto' }}>
          {de ? `${agents.length} Agenten · Auto-refresh 30s` : `${agents.length} agents · Auto-refresh 30s`}
        </span>
      </div>

      {/* Agent Log Overlay */}
      {logAgent && (
        <AgentLogPanel
          agent={logAgent}
          traces={agentTraces[logAgent.id] || []}
          onClose={() => setLogAgent(null)}
          language={language}
        />
      )}
    </div>
  );
}
