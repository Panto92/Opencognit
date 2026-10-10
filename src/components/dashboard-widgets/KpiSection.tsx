import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { DashboardKPI } from './shared';

export function Card({ children, style = {}, accent = '#c5a059', onClick }: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  accent?: string;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: hovered ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        borderRadius: 0,
        border: `1px solid ${hovered ? `${accent}30` : 'rgba(255,255,255,0.09)'}`,
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered
          ? `inset 0 1px 0 rgba(255,255,255,0.18), 0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px ${accent}18`
          : 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 16px rgba(0,0,0,0.2)',
        transition: 'all 0.25s ease',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        opacity: hovered ? 1 : 0, transition: 'opacity 0.3s',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)',
        backgroundSize: '16px 16px',
      }} />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 0, pointerEvents: 'none',
        background: `linear-gradient(135deg, ${accent}12, transparent 60%, ${accent}08)`,
        opacity: hovered ? 1 : 0, transition: 'opacity 0.3s',
      }} />
      <div style={{ position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}

export function KpiCard({
  label, value, sub, icon: Icon, accent, bar, trend,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent: string;
  bar?: { pct: number; color: string };
  trend?: 'up' | 'down' | 'neutral';
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#475569';

  return (
    <Card style={{ padding: '1.5rem' }} accent={accent}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#94a3b8' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {trend && <TrendIcon size={13} style={{ color: trendColor }} />}
          <div style={{
            width: 36, height: 36, borderRadius: 0,
            background: `${accent}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={16} style={{ color: accent }} />
          </div>
        </div>
      </div>
      <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.375rem' }}>{sub}</div>}
      {bar && (
        <div style={{ marginTop: '0.875rem', height: 4, borderRadius: 0, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 0, transition: 'width 0.6s ease',
            width: `${Math.min(bar.pct, 100)}%`, background: bar.color,
          }} />
        </div>
      )}
    </Card>
  );
}

export function HeroKpiStrip({ kpis, lang }: { kpis: DashboardKPI[]; lang: string }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${kpis.length}, 1fr)`,
      border: '1px solid rgba(197,160,89,0.12)',
    }}>
      {kpis.map((kpi, i) => (
        <button
          key={i}
          onClick={() => window.location.href = kpi.link}
          style={{
            display: 'flex', flexDirection: 'column', gap: '0.375rem',
            padding: '1.375rem 1.5rem',
            background: 'rgba(8,6,4,0.82)',
            border: 'none',
            borderRight: i < kpis.length - 1 ? '1px solid rgba(197,160,89,0.10)' : 'none',
            cursor: 'pointer', textAlign: 'left',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(197,160,89,0.05)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(8,6,4,0.82)')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {kpi.pulse && <div style={{ width: 6, height: 6, borderRadius: '50%', background: kpi.color, boxShadow: `0 0 6px ${kpi.color}`, animation: 'pulse 2s ease-in-out infinite', flexShrink: 0 }} />}
            <span style={{ fontSize: '2.25rem', fontWeight: 800, color: kpi.color, lineHeight: 1, fontFamily: 'var(--font-mono)', letterSpacing: '-0.03em' }}>
              {kpi.value}
            </span>
          </div>
          <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
            {kpi.label}
          </span>
        </button>
      ))}
    </div>
  );
}
