import { useNavigate } from 'react-router-dom';
import { Target } from 'lucide-react';
import { EmptyState } from '../design-system';

export function GoalsWidget({ goals, lang }: { goals: any[]; lang: string }) {
  const navigate = useNavigate();
  if (goals.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title={lang === 'de' ? 'Noch keine Ziele definiert' : 'No goals defined yet'}
        action={{ label: lang === 'de' ? 'Ziel erstellen' : 'Create goal', onClick: () => navigate('/goals') }}
        compact
      />
    );
  }

  const statusColor: Record<string, string> = {
    active:   '#22c55e',
    planned:  '#94a3b8',
    achieved: '#c5a059',
    cancelled:'#475569',
  };

  function progressColor(pct: number): string {
    if (pct >= 100) return '#c5a059';
    if (pct >= 70)  return '#22c55e';
    if (pct >= 40)  return '#3b82f6';
    return '#94a3b8';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {goals.map((g: any) => {
        const pct = g.fortschritt ?? 0;
        const pColor = progressColor(pct);
        return (
          <div key={g.id} onClick={() => navigate('/goals')} style={{
            padding: '0.625rem 0.875rem', borderRadius: 0,
            background: 'rgba(255,255,255,0.02)', border: `1px solid ${g.status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)'}`,
            cursor: 'pointer', transition: 'border-color 0.15s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = g.status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: pct > 0 ? '0.375rem' : 0 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: statusColor[g.status] || '#475569',
                boxShadow: g.status === 'active' ? `0 0 5px ${statusColor[g.status]}80` : 'none',
              }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.titel}</span>
              {pct > 0 && (
                <span style={{ fontSize: '0.625rem', fontWeight: 700, color: pColor, flexShrink: 0 }}>{pct}%</span>
              )}
            </div>
            {pct > 0 && (
              <div style={{ height: 3, borderRadius: 0, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 0, background: pColor,
                  width: `${pct}%`, transition: 'width 0.6s ease',
                }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
