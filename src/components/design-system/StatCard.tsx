import type { ReactNode } from 'react';

// KPI card for the top row of a page — the glossy "pearl" surface (see surfaces.css).
// Big number, optional small unit next to it, a note underneath, an icon badge top-right,
// and an optional inline visual (MiniBars, FillBar, …) at the bottom.

type Tone = 'muted' | 'green' | 'red' | 'amber' | 'gold';

const TONE: Record<Tone, string> = {
  muted: 'var(--oc-text-3)',
  green: 'var(--oc-green)',
  red: 'var(--oc-red)',
  amber: 'var(--oc-amber)',
  gold: 'var(--oc-gold)',
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  note?: ReactNode;
  noteTone?: Tone;
  icon?: ReactNode;
  /** Rendered left of the number instead of below it (e.g. a ProgressRing). */
  lead?: ReactNode;
  visual?: ReactNode;
  onClick?: () => void;
}

export function StatCard({ label, value, unit, note, noteTone = 'muted', icon, lead, visual, onClick }: StatCardProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`oc-card oc-card--pearl${onClick ? ' oc-card--clickable' : ''}`}
      style={{
        padding: '1.25rem 1.35rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.9rem',
        minHeight: 150, textAlign: 'left', width: '100%', color: 'inherit', font: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--oc-text-2)' }}>{label}</span>
        {icon && <span className="oc-icon-badge">{icon}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
        {lead}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '2rem', lineHeight: 1, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--oc-text)' }}>{value}</span>
            {unit && <span style={{ fontSize: '0.8125rem', color: 'var(--oc-text-3)' }}>{unit}</span>}
          </div>
          {note && lead && <div style={{ fontSize: '0.75rem', marginTop: 6, color: TONE[noteTone] }}>{note}</div>}
        </div>
      </div>

      {(visual || (note && !lead)) && (
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {visual}
          {note && !lead && <div style={{ fontSize: '0.75rem', color: TONE[noteTone] }}>{note}</div>}
        </div>
      )}
    </Tag>
  );
}

/** The row of KPI cards at the top of a page — same grid on every page. */
export function StatRow({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem', marginBottom: '1.5rem', ...style }}>
      {children}
    </div>
  );
}
