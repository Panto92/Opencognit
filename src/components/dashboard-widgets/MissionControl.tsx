import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Crown, MessageSquare, Play, Pause, Radio, Loader2, Zap, ZapOff, Clock,
  Cpu, Plus, ArrowRight,
} from 'lucide-react';
import { useWebSocketEvent } from '../../hooks/useWebSocket';
import { STATUS_CFG, TRACE_CFG, reltime } from './shared';
import type { LiveAgent } from './shared';

function ActionBtn({ icon, label, color, onClick, disabled }: {
  icon: React.ReactNode; label: string; color: string;
  onClick: (e: React.MouseEvent) => void; disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.25rem',
        padding: '0.2rem 0.5rem', borderRadius: 0,
        background: hovered ? `${color}12` : 'transparent',
        border: `1px solid ${hovered ? `${color}30` : 'rgba(255,255,255,0.06)'}`,
        color: hovered ? color : '#52525b',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: '0.625rem', fontWeight: 600,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function AgentMissionCard({
  agent, lang, onChat, onWakeup, waking, onPause, pausing,
}: {
  agent: LiveAgent; lang: string;
  onChat: (id: string) => void;
  onWakeup: (id: string) => void;
  waking: boolean;
  onPause: (id: string, isPaused: boolean) => void;
  pausing: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const isRunning = agent.status === 'running';
  const isError   = agent.status === 'error';
  const isCEO     = agent.isOrchestrator === true;
  const isPaused = agent.status === 'paused';
  const isReady = agent.status === 'active' || agent.status === 'idle';
  const statusColor = isRunning ? '#c5a059' : isError ? '#ef4444' : isPaused ? '#eab308' : isReady ? '#22c55e' : '#475569';
  const statusLabel = isRunning ? (lang === 'de' ? 'Arbeitet' : 'Working') : isError ? (lang === 'de' ? 'Fehler' : 'Error') : isPaused ? (lang === 'de' ? 'Pausiert' : 'Paused') : (lang === 'de' ? 'Bereit' : 'Ready');
  const traceEvents = agent.traceEvents || [];
  const traceCfg = agent.lastTrace ? (TRACE_CFG[agent.lastTrace.typ] || TRACE_CFG.info) : null;

  const borderColor = isCEO
    ? (hovered ? 'rgba(255,215,0,0.5)' : 'rgba(255,215,0,0.25)')
    : isRunning ? 'rgba(197,160,89,0.35)'
    : isError ? 'rgba(239,68,68,0.25)'
    : hovered ? `${agent.avatarFarbe}30` : 'rgba(255,255,255,0.07)';

  const shadowStyle = isCEO
    ? (hovered ? 'inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 32px rgba(255,215,0,0.12)' : 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 16px rgba(255,215,0,0.04)')
    : isRunning ? 'inset 0 1px 0 rgba(255,255,255,0.12), 0 0 32px rgba(197,160,89,0.08), 0 6px 24px rgba(0,0,0,0.25)'
    : hovered ? 'inset 0 1px 0 rgba(255,255,255,0.15), 0 8px 32px rgba(0,0,0,0.3)'
    : 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.15)';

  const hasTask = !!agent.currentTask;
  const hasPrinciples = agent.principles && agent.principles.length > 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', overflow: 'hidden',
        borderRadius: 0, padding: '1.25rem',
        background: hovered ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.035)',
        border: `1px solid ${borderColor}`,
        boxShadow: shadowStyle,
        transform: hovered ? 'translateY(-3px)' : 'none',
        transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
        cursor: 'pointer',
      }}
    >
      {isCEO && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: 3, height: '100%',
          background: 'linear-gradient(to bottom, #FFD700, #FFA500)',
        }} />
      )}
      {isRunning && (
        <div style={{
          position: 'absolute', inset: -1, borderRadius: 0,
          border: '1px solid rgba(197,160,89,0.35)',
          animation: 'aura 3s ease-in-out infinite', pointerEvents: 'none',
        }} />
      )}

      {/* Header */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: '0.875rem', marginBottom: '0.875rem' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 0, flexShrink: 0,
          background: isCEO ? 'rgba(255,215,0,0.08)' : `${agent.avatarFarbe}18`,
          border: `1px solid ${isCEO ? 'rgba(255,215,0,0.25)' : `${agent.avatarFarbe}35`}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1rem', fontWeight: 700,
          color: isCEO ? '#FFD700' : agent.avatarFarbe,
          boxShadow: isRunning ? `0 0 12px ${agent.avatarFarbe}25` : isCEO ? '0 0 12px rgba(255,215,0,0.1)' : 'none',
          position: 'relative',
        }}>
          {agent.avatar || agent.name.slice(0, 2).toUpperCase()}
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 10, height: 10, borderRadius: '50%',
            background: statusColor, border: '2px solid rgba(4,4,10,0.95)',
            boxShadow: isRunning ? `0 0 6px ${statusColor}` : 'none',
            animation: isRunning ? 'pulse 2s ease-in-out infinite' : 'none',
          }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.125rem' }}>
            <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {agent.name}
            </span>
            {isCEO && <Crown size={12} color="#FFD700" style={{ flexShrink: 0, opacity: 0.9 }} />}
          </div>
          <div style={{ fontSize: '0.8125rem', color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.375rem' }}>
            {agent.titel || agent.rolle}
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.15rem 0.5rem', borderRadius: 0,
            background: `${statusColor}12`, border: `1px solid ${statusColor}28`,
          }}>
            {isRunning
              ? <Loader2 size={8} style={{ color: statusColor, animation: 'spin 1s linear infinite' }} />
              : <div style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor }} />
            }
            <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: statusColor, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flexShrink: 0 }}>
          <ActionBtn
            icon={<MessageSquare size={13} />}
            label={lang === 'de' ? 'Chat' : 'Chat'}
            color="#c5a059"
            onClick={(e) => { e.stopPropagation(); onChat(agent.id); }}
          />
          <ActionBtn
            icon={pausing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : agent.status === 'paused' ? <Play size={13} /> : <Pause size={13} />}
            label={agent.status === 'paused' ? (lang === 'de' ? 'Start' : 'Start') : (lang === 'de' ? 'Pause' : 'Pause')}
            color={agent.status === 'paused' ? '#22c55e' : '#eab308'}
            onClick={(e) => { e.stopPropagation(); onPause(agent.id, agent.status === 'paused'); }}
            disabled={pausing}
          />
          <ActionBtn
            icon={waking ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Radio size={13} />}
            label={lang === 'de' ? 'Run' : 'Run'}
            color="#22c55e"
            onClick={(e) => { e.stopPropagation(); onWakeup(agent.id); }}
            disabled={waking}
          />
        </div>
      </div>

      {/* Principles */}
      {hasPrinciples && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
          {agent.principles!.slice(0, 3).map((p, i) => (
            <span key={i} style={{
              padding: '0.15rem 0.5rem', borderRadius: 0,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: '0.625rem', color: '#52525b',
              whiteSpace: 'nowrap',
            }}>
              {p.replace(/^[-•*\d]+\.?\s*/, '').slice(0, 40)}{p.length > 40 ? '…' : ''}
            </span>
          ))}
          {agent.principles!.length > 3 && (
            <span style={{ fontSize: '0.625rem', color: '#3f3f46', padding: '0.15rem 0' }}>
              +{agent.principles!.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Task */}
      <div style={{
        padding: '0.5rem 0.625rem', borderRadius: 0,
        background: isRunning ? 'rgba(197,160,89,0.06)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${isRunning ? 'rgba(197,160,89,0.15)' : 'rgba(255,255,255,0.05)'}`,
        marginBottom: '0.625rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: hasTask ? '0.375rem' : 0 }}>
          {isRunning
            ? <Loader2 size={10} style={{ color: '#c5a059', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            : <div style={{ width: 5, height: 5, borderRadius: '50%', background: hasTask ? '#22c55e' : '#334155', flexShrink: 0 }} />
          }
          <span style={{ fontSize: '0.8125rem', color: hasTask ? '#e2e8f0' : '#52525b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: hasTask ? 500 : 400 }}>
            {hasTask ? agent.currentTask!.titel : (lang === 'de' ? 'Keine aktive Aufgabe' : 'No active task')}
          </span>
          {hasTask && agent.currentTask!.status && (
            <span style={{
              fontSize: '0.5625rem', fontWeight: 700, color: '#52525b',
              textTransform: 'uppercase', letterSpacing: '0.04em',
              padding: '0.1rem 0.35rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}>
              {agent.currentTask!.status}
            </span>
          )}
        </div>
        {hasTask && (
          <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 0, overflow: 'hidden', marginTop: '0.25rem' }}>
            <div style={{
              height: '100%', borderRadius: 0,
              width: isRunning ? '60%' : '100%',
              background: isRunning ? '#c5a059' : '#22c55e',
              transition: 'width 0.6s ease',
              animation: isRunning ? 'shimmer 2s ease-in-out infinite' : 'none',
            }} />
          </div>
        )}
      </div>

      {/* Live Trace */}
      {traceEvents.length > 0 && (
        <div style={{ marginBottom: '0.625rem' }}>
          <div
            onClick={(e) => { e.stopPropagation(); setShowTrace(v => !v); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              cursor: 'pointer', padding: '0.25rem 0.375rem',
              borderRadius: 0, background: showTrace ? 'rgba(197,160,89,0.06)' : 'transparent',
              border: `1px solid ${showTrace ? 'rgba(197,160,89,0.15)' : 'transparent'}`,
              transition: 'all 0.15s',
            }}
          >
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isRunning ? '#c5a059' : '#52525b',
              animation: isRunning ? 'pulse 2s ease-in-out infinite' : 'none',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: '0.6875rem', fontWeight: 600, color: isRunning ? '#c5a059' : '#71717a',
              letterSpacing: '0.03em', textTransform: 'uppercase', flexShrink: 0,
            }}>
              {lang === 'de' ? 'Live' : 'Live'}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#52525b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {agent.lastTrace?.titel}
            </span>
            <span style={{ fontSize: '0.6875rem', color: '#3f3f46', flexShrink: 0 }}>
              {showTrace ? '▲' : '▼'} {traceEvents.length}
            </span>
          </div>

          {showTrace && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '0.25rem',
              marginTop: '0.375rem', padding: '0.5rem 0.625rem',
              background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)',
              maxHeight: '160px', overflow: 'auto',
            }}>
              {traceEvents.map((ev, i) => {
                const cfg = TRACE_CFG[ev.typ] || TRACE_CFG.info;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    fontSize: '0.6875rem', lineHeight: 1.4,
                  }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%', background: cfg.color, flexShrink: 0,
                    }} />
                    <span style={{ color: '#71717a', flexShrink: 0, fontWeight: 600, minWidth: '3.5rem' }}>
                      {cfg.label}
                    </span>
                    <span style={{ color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.titel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: '0.625rem',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        fontSize: '0.6875rem', color: '#52525b',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {agent.budgetPct > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{
                color: agent.budgetPct > 90 ? '#ef4444' : agent.budgetPct > 70 ? '#eab308' : '#71717a',
                fontWeight: 600,
              }}>{agent.budgetPct}%</span>
              <span>Budget</span>
            </span>
          )}
          {agent.letzterZyklus && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Clock size={9} />
              {reltime(agent.letzterZyklus, lang)}
            </span>
          )}
        </div>
        <span style={{
          display: 'flex', alignItems: 'center', gap: '0.25rem',
          color: agent.zyklusAktiv ? '#c5a059' : '#3f3f46',
        }}>
          {agent.zyklusAktiv ? <Zap size={10} /> : <ZapOff size={10} />}
          {agent.zyklusAktiv
            ? (lang === 'de' ? 'Auto' : 'Auto')
            : (lang === 'de' ? 'Manuell' : 'Manual')
          }
        </span>
      </div>
    </div>
  );
}

export function MissionControl({
  initialAgents, unternehmenId, lang, onChat,
}: {
  initialAgents: LiveAgent[]; unternehmenId: string; lang: string;
  onChat: (expertId: string) => void;
}) {
  const [agents, setAgents] = useState<LiveAgent[]>(initialAgents);
  const [waking, setWaking] = useState<Set<string>>(new Set());
  const [pausing, setPausing] = useState<Set<string>>(new Set());

  useEffect(() => {
    setAgents(initialAgents.map(a => ({ ...a, traceEvents: a.traceEvents || [] })));
  }, [initialAgents]);

  useWebSocketEvent(
    '*',
    (msg) => {
      if (msg.type === 'heartbeat' && msg.data?.expertId) {
        setAgents(prev => prev.map(a =>
          a.id === msg.data.expertId
            ? { ...a, status: msg.data.status || a.status, letzterZyklus: new Date().toISOString() }
            : a
        ));
      }
      if (msg.type === 'task_completed' && msg.agentId) {
        setAgents(prev => prev.map(a =>
          a.id === msg.agentId ? { ...a, status: 'active', currentTask: null } : a
        ));
      }
      if (msg.type === 'task_started' && msg.agentId) {
        setAgents(prev => prev.map(a =>
          a.id === msg.agentId
            ? { ...a, status: 'running', currentTask: { id: msg.taskId || '', titel: msg.taskTitel || '', status: 'in_progress' } }
            : a
        ));
      }
      if (msg.type === 'trace' && msg.data?.expertId) {
        setAgents(prev => prev.map(a => {
          if (a.id !== msg.data.expertId) return a;
          const ev = { typ: msg.data.typ, titel: msg.data.titel };
          return {
            ...a,
            lastTrace: ev,
            status: 'running',
            traceEvents: [ev, ...(a.traceEvents || [])].slice(0, 8),
          };
        }));
      }
    },
    [unternehmenId],
  );

  const handleWakeup = async (agentId: string) => {
    setWaking(prev => new Set(prev).add(agentId));
    const token = localStorage.getItem('opencognit_token');
    await fetch(`/api/experten/${agentId}/wakeup`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
    setTimeout(() => {
      setWaking(prev => { const s = new Set(prev); s.delete(agentId); return s; });
    }, 2000);
  };

  const handlePause = async (agentId: string, isPaused: boolean) => {
    setPausing(prev => new Set(prev).add(agentId));
    const token = localStorage.getItem('opencognit_token');
    const endpoint = isPaused ? `/api/mitarbeiter/${agentId}/fortsetzen` : `/api/mitarbeiter/${agentId}/pausieren`;
    await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
    setAgents(prev => prev.map(a =>
      a.id === agentId ? { ...a, status: isPaused ? 'idle' : 'paused' } : a
    ));
    setTimeout(() => {
      setPausing(prev => { const s = new Set(prev); s.delete(agentId); return s; });
    }, 1000);
  };

  const runningCount = agents.filter(a => a.status === 'running').length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: runningCount > 0 ? '#c5a059' : '#475569',
              boxShadow: runningCount > 0 ? '0 0 8px #c5a05980' : 'none',
              animation: runningCount > 0 ? 'pulse 2s ease-in-out infinite' : 'none',
            }} />
          </div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            {lang === 'de' ? 'Mein Team' : 'My Team'}
          </h2>
          {runningCount > 0 && (
            <span style={{
              padding: '0.2rem 0.625rem', borderRadius: 0,
              background: 'rgba(197,160,89,0.1)', border: '1px solid rgba(197,160,89,0.2)',
              fontSize: '0.6875rem', fontWeight: 700, color: '#c5a059',
            }}>
              {runningCount} {lang === 'de' ? 'aktiv' : 'active'}
            </span>
          )}
        </div>
        <Link to="/experts" className="btn btn-ghost" style={{
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          fontSize: '0.8125rem', height: 32, padding: '0 0.75rem',
          textDecoration: 'none',
        }}>
          {lang === 'de' ? `Alle Agenten (${agents.length})` : `All agents (${agents.length})`} <ArrowRight size={14} />
        </Link>
      </div>

      {agents.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem',
          background: 'rgba(255,255,255,0.02)', borderRadius: 0,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <Cpu size={40} style={{ opacity: 0.15, marginBottom: '0.75rem', color: '#c5a059' }} />
          <p style={{ color: '#475569', fontWeight: 600, margin: '0 0 0.5rem' }}>
            {lang === 'de' ? 'Noch keine Agenten' : 'No agents yet'}
          </p>
          <Link to="/experts" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', textDecoration: 'none' }}>
            <Plus size={14} /> {lang === 'de' ? 'Agent erstellen' : 'Create agent'}
          </Link>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}>
          {agents.slice(0, 4).map(agent => (
            <AgentMissionCard
              key={agent.id}
              agent={agent}
              lang={lang}
              onChat={onChat}
              onWakeup={handleWakeup}
              waking={waking.has(agent.id)}
              onPause={handlePause}
              pausing={pausing.has(agent.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
