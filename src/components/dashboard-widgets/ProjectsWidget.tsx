import { useNavigate } from 'react-router-dom';
import { FolderOpen, Clock } from 'lucide-react';
import { EmptyState } from '../design-system';

export function ProjectsWidget({ projects, lang }: { projects: any[]; lang: string }) {
  const navigate = useNavigate();
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderOpen}
        title={lang === 'de' ? 'Noch keine Projekte' : 'No projects yet'}
        action={{ label: lang === 'de' ? 'Projekt anlegen' : 'Create project', onClick: () => navigate('/projects') }}
        compact
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {projects.map((p: any) => (
        <div key={p.id} onClick={() => navigate('/projects')} style={{
          padding: '0.75rem 0.875rem', borderRadius: 0,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${p.farbe || '#c5a059'}40`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.farbe || '#c5a059', flexShrink: 0 }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                {p.name}
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: p.fortschritt >= 80 ? '#22c55e' : p.fortschritt >= 40 ? '#c5a059' : '#94a3b8' }}>
              {p.fortschritt}%
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 0, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 0, transition: 'width 0.6s ease',
              width: `${p.fortschritt}%`,
              background: p.fortschritt >= 80 ? '#22c55e' : p.fortschritt >= 40 ? p.farbe || '#c5a059' : '#475569',
            }} />
          </div>
          {p.deadline && (
            <div style={{ fontSize: '0.6875rem', color: '#475569', marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Clock size={10} />
              {new Date(p.deadline).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short' })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
