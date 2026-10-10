import { useState } from 'react';

export function QuickActionCard({ item, onClick }: {
  item: { icon: React.ElementType; label: string; accent: string; badge?: number };
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const accent = item.accent;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.875rem 1.125rem', borderRadius: 0,
        background: hovered ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${hovered ? `${accent}30` : 'rgba(255,255,255,0.09)'}`,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered
          ? `inset 0 1px 0 rgba(255,255,255,0.18), 0 12px 32px rgba(0,0,0,0.3), 0 0 0 1px ${accent}15`
          : 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 16px rgba(0,0,0,0.18)',
        cursor: 'pointer', textAlign: 'left', transition: 'all 0.25s ease',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        opacity: hovered ? 1 : 0, transition: 'opacity 0.3s',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '14px 14px',
      }} />
      <div style={{
        width: 34, height: 34, borderRadius: 0, flexShrink: 0,
        background: hovered ? `${accent}20` : `${accent}15`,
        border: `1px solid ${hovered ? `${accent}35` : `${accent}20`}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.25s', position: 'relative',
      }}>
        <item.icon size={15} style={{ color: accent }} />
      </div>
      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: hovered ? '#f1f5f9' : '#94a3b8', transition: 'color 0.2s', position: 'relative' }}>
        {item.label}
      </span>
      {item.badge !== undefined && (
        <span style={{
          position: 'absolute', top: '0.5rem', right: '0.5rem',
          background: '#f59e0b', color: '#0a0a0f', borderRadius: 0,
          fontSize: '0.625rem', fontWeight: 800, padding: '0.1rem 0.375rem',
          minWidth: 16, textAlign: 'center',
        }}>
          {item.badge}
        </span>
      )}
    </button>
  );
}

export function QuickActionsGrid({ items, navigate }: {
  items: Array<{ icon: React.ElementType; label: string; to: string; accent: string; badge?: number }>;
  navigate: (to: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
      {items.map(item => (
        <QuickActionCard key={item.to} item={item} onClick={() => navigate(item.to)} />
      ))}
    </div>
  );
}
