export function VelocityChart({ completedPerDay, lang }: { completedPerDay: number[]; lang: string }) {
  const de = lang === 'de';
  const DAYS = 14;
  const W = 280, H = 60;
  const PAD = 4;

  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (DAYS - 1 - i));
    return d;
  });

  const counts = completedPerDay.length === DAYS ? completedPerDay : Array(DAYS).fill(0);

  const maxCount = Math.max(...counts, 1);
  const colW = (W - PAD * 2) / DAYS;

  const points = counts.map((c, i) => {
    const x = PAD + i * colW + colW / 2;
    const y = PAD + (H - PAD * 2) * (1 - c / maxCount);
    return { x, y };
  });

  const pathD = points.reduce((d, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cpx = (prev.x + p.x) / 2;
    return `${d} C ${cpx} ${prev.y} ${cpx} ${p.y} ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${H - PAD} L ${points[0].x} ${H - PAD} Z`;

  const total = counts.reduce((a, b) => a + b, 0);
  const today = counts[counts.length - 1];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#475569', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {de ? 'Aufgaben erledigt (14 Tage)' : 'Tasks done (14 days)'}
        </span>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline' }}>
          {today > 0 && (
            <span style={{ fontSize: '0.6875rem', color: '#22c55e', fontWeight: 600 }}>
              +{today} {de ? 'heute' : 'today'}
            </span>
          )}
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#c5a059' }}>{total}</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="velocity-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c5a059" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#c5a059" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.33, 0.67, 1].map((p, i) => (
          <line key={i}
            x1={PAD} y1={PAD + (H - PAD * 2) * (1 - p)}
            x2={W - PAD} y2={PAD + (H - PAD * 2) * (1 - p)}
            stroke="rgba(255,255,255,0.04)" strokeWidth={1}
          />
        ))}
        <path d={areaD} fill="url(#velocity-fill)" />
        <path d={pathD} fill="none" stroke="#c5a059" strokeWidth={1.5} strokeLinejoin="round" />
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r={3}
            fill="#c5a059"
          />
        )}
        {days.map((d, i) => {
          const show = d.getDay() === 1 || d.getDate() === 1;
          if (!show) return null;
          return (
            <text key={i} x={PAD + i * colW + colW / 2} y={H} fontSize={7} textAnchor="middle" fill="#3f3f46">
              {d.toLocaleDateString(de ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short' })}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
