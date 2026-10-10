import { useState } from 'react';
import { Radio } from 'lucide-react';
import { useWebSocketEvent, useWebSocketStatus } from '../../hooks/useWebSocket';
import { translateTrace } from '../../utils/translateTrace';
import { PULSE_CFG, TraceEvent, reltime } from './shared';
import { Card } from './KpiSection';

export function SystemPulse({ unternehmenId, lang }: { unternehmenId: string; lang: string }) {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const connected = useWebSocketStatus();

  useWebSocketEvent(
    '*',
    (msg) => {
      if (msg.unternehmenId && msg.unternehmenId !== unternehmenId) return;
      if (msg.type === 'trace' && msg.data) {
        setEvents(prev => [{
          id: crypto.randomUUID(),
          expertId: msg.data.expertId,
          expertName: msg.data.expertName,
          typ: msg.data.typ,
          titel: msg.data.titel,
          erstelltAm: msg.data.erstelltAm || new Date().toISOString(),
        }, ...prev].slice(0, 12));
      }
      if (msg.type === 'task_started' && msg.agentId) {
        setEvents(prev => [{
          id: crypto.randomUUID(),
          expertId: msg.agentId,
          expertName: msg.agentName,
          typ: 'task_started',
          titel: msg.taskTitel || (lang === 'de' ? 'Task gestartet' : 'Task started'),
          erstelltAm: new Date().toISOString(),
        }, ...prev].slice(0, 12));
      }
      if (msg.type === 'task_completed' && msg.agentId) {
        setEvents(prev => [{
          id: crypto.randomUUID(),
          expertId: msg.agentId,
          expertName: msg.agentName,
          typ: 'task_completed',
          titel: msg.taskTitel || (lang === 'de' ? 'Task abgeschlossen' : 'Task completed'),
          erstelltAm: new Date().toISOString(),
        }, ...prev].slice(0, 12));
      }
    },
    [unternehmenId, lang],
  );

  return (
    <Card style={{ padding: '1.25rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: connected ? '#c5a059' : '#475569',
          boxShadow: connected ? '0 0 8px #c5a05980' : 'none',
          animation: connected ? 'pulse 2s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: connected ? '#c5a059' : '#475569', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {lang === 'de' ? 'Live-Aktivität' : 'Live Activity'}
        </span>
        {events.length > 0 && (
          <span style={{
            padding: '0.1rem 0.4rem', borderRadius: 0,
            background: 'rgba(197,160,89,0.1)', border: '1px solid rgba(197,160,89,0.2)',
            fontSize: '0.625rem', fontWeight: 700, color: '#c5a059',
          }}>
            {events.length}
          </span>
        )}
        <span style={{ fontSize: '0.6875rem', color: '#334155', marginLeft: 'auto' }}>
          {connected
            ? (lang === 'de' ? 'Verbunden — warte auf Events' : 'Connected — waiting for events')
            : (lang === 'de' ? 'Verbinde…' : 'Connecting…')
          }
        </span>
      </div>

      {events.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '2rem 1rem',
          color: '#334155', fontSize: '0.8125rem',
        }}>
          <Radio size={24} style={{ opacity: 0.2, marginBottom: '0.5rem', display: 'block', margin: '0 auto 0.5rem' }} />
          {lang === 'de'
            ? 'Noch keine Live-Events. Aktivitäten erscheinen hier, sobald Agenten arbeiten.'
            : 'No live events yet. Activity will appear here once agents start working.'
          }
        </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {events.map(ev => {
          const cfg = PULSE_CFG[ev.typ] ?? PULSE_CFG.info;
          const isTask = ev.typ === 'task_started' || ev.typ === 'task_completed';
          return (
            <div key={ev.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.625rem',
              padding: '0.4rem 0.75rem', borderRadius: 0,
              background: cfg.bg,
              border: `1px solid ${cfg.color}${isTask ? '30' : '15'}`,
            }}>
              <span style={{ fontSize: '0.625rem', flexShrink: 0, color: cfg.color }}>{cfg.symbol}</span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                {ev.expertName && (
                  <span style={{ fontSize: '0.6875rem', color: cfg.color, fontWeight: 700, flexShrink: 0 }}>
                    {ev.expertName}
                  </span>
                )}
                <span style={{ fontSize: '0.6875rem', color: isTask ? '#94a3b8' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {translateTrace(ev.titel, lang)}
                </span>
              </div>
              <span style={{ fontSize: '0.625rem', color: '#334155', flexShrink: 0 }}>
                {reltime(ev.erstelltAm, lang)}
              </span>
            </div>
          );
        })}
      </div>
      )}
    </Card>
  );
}
