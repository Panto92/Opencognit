// Small inline visuals for KPI cards — plain SVG, no chart library.

const GOLD = '#c5a059';
const TRACK = 'rgba(255,255,255,0.07)';

/** One bar per value; the last (today) is highlighted. */
export function MiniBars({ values, height = 34, color = GOLD, label }: { values: number[]; height?: number; color?: string; label?: string }) {
  const max = Math.max(1, ...values);
  const n = Math.max(values.length, 1);
  const gap = 4;
  const w = 100 / n;
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" width="100%" height={height} role="img" aria-label={label}>
      {values.map((v, i) => {
        const h = v === 0 ? 2 : Math.max(3, (v / max) * height);
        const last = i === values.length - 1;
        return (
          <rect
            key={i}
            x={i * w + gap / 2}
            y={height - h}
            width={Math.max(1, w - gap)}
            height={h}
            rx={1.5}
            fill={v === 0 ? TRACK : color}
            opacity={v === 0 ? 1 : last ? 1 : 0.45}
          />
        );
      })}
    </svg>
  );
}

/** Circular progress, 0..1. The value text sits inside. */
export function ProgressRing({ value, size = 58, stroke = 5, color = GOLD, children }: { value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={stroke} />
        {v > 0 && <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${c * v} ${c}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 800, color: '#f2ece2' }}>
        {children}
      </div>
    </div>
  );
}

/** Thin horizontal fill bar, 0..1. */
export function FillBar({ value, color = GOLD, label }: { value: number; color?: string; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}
      style={{ height: 6, borderRadius: 999, background: TRACK, overflow: 'hidden' }}>
      <div style={{ width: `${v * 100}%`, height: '100%', borderRadius: 999, background: color, transition: 'width 0.6s ease' }} />
    </div>
  );
}
