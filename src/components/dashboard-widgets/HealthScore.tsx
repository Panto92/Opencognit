import { useState } from 'react';
import { Card } from './KpiSection';

export function computeHealthScore(
  experten: { gesamt: number; aktiv: number; running: number; error: number },
  aufgaben: { gesamt: number; erledigt: number; fehlgeschlagen?: number; blockiert: number; inBearbeitung: number },
  kosten: { prozent: number },
  pendingApprovals: number,
  zyklen?: { total: number; succeeded: number; failed: number },
  recentActivityCount?: number,
  lang = 'en',
): { score: number; grade: string; gradeColor: string; factors: Array<{ label: string; delta: number; color: string }> } {
  const de = lang === 'de';
  let score = 60; // base — agents must earn the rest
  const factors: Array<{ label: string; delta: number; color: string }> = [];

  // ── Bonuses (up to +40) ──────────────────────────────────────────────────

  // Task success rate (max +20)
  const erledigt = aufgaben.erledigt || 0;
  const fehlgeschlagen = aufgaben.fehlgeschlagen || 0;
  const taskTotal = erledigt + fehlgeschlagen;
  if (taskTotal > 0) {
    const rate = erledigt / taskTotal;
    const bonus = Math.round(rate * 20);
    score += bonus;
    const pct = Math.round(rate * 100);
    factors.push({
      label: de ? `Task-Erfolgsrate ${pct}%` : `Task success rate ${pct}%`,
      delta: bonus,
      color: rate >= 0.8 ? '#22c55e' : rate >= 0.5 ? '#f59e0b' : '#ef4444',
    });
  } else if (erledigt > 0) {
    // Only completed tasks, zero failures — full bonus
    score += 20;
    factors.push({ label: de ? `${erledigt} Tasks erledigt` : `${erledigt} tasks completed`, delta: 20, color: '#22c55e' });
  }

  // Cycle reliability (max +15)
  if (zyklen && zyklen.total > 0) {
    const cycleRate = zyklen.succeeded / zyklen.total;
    const bonus = Math.round(cycleRate * 15);
    score += bonus;
    const pct = Math.round(cycleRate * 100);
    factors.push({
      label: de ? `Zyklen-Zuverlässigkeit ${pct}%` : `Cycle reliability ${pct}%`,
      delta: bonus,
      color: cycleRate >= 0.8 ? '#22c55e' : cycleRate >= 0.5 ? '#f59e0b' : '#ef4444',
    });
  }

  // Recent activity bonus (max +5)
  if (recentActivityCount && recentActivityCount > 0) {
    score += 5;
    factors.push({
      label: de ? `${recentActivityCount} Agenten heute aktiv` : `${recentActivityCount} agents active today`,
      delta: 5,
      color: '#22c55e',
    });
  } else if (experten.running > 0) {
    score += 5;
    factors.push({
      label: de ? `${experten.running} Agenten laufen gerade` : `${experten.running} agents running now`,
      delta: 5,
      color: '#c5a059',
    });
  }

  // ── Penalties ────────────────────────────────────────────────────────────

  // Budget (max -30)
  if (kosten.prozent >= 100) {
    score -= 30; factors.push({ label: de ? 'Budget überschritten' : 'Budget exceeded', delta: -30, color: '#ef4444' });
  } else if (kosten.prozent >= 90) {
    score -= 20; factors.push({ label: de ? 'Budget kritisch' : 'Budget critical', delta: -20, color: '#ef4444' });
  } else if (kosten.prozent >= 75) {
    score -= 10; factors.push({ label: de ? 'Budget knapp' : 'Budget low', delta: -10, color: '#f59e0b' });
  }

  // Agent errors (max -20)
  const errPenalty = Math.min(experten.error * 5, 20);
  if (errPenalty > 0) {
    score -= errPenalty;
    factors.push({ label: de ? `${experten.error} Agenten fehlerhaft` : `${experten.error} agents in error`, delta: -errPenalty, color: '#ef4444' });
  }

  // Failed tasks penalty (max -10) — separate from success rate
  if (fehlgeschlagen > 0 && taskTotal === 0) {
    // Only failures, zero success
    const pen = Math.min(fehlgeschlagen * 3, 10);
    score -= pen;
    factors.push({ label: de ? `${fehlgeschlagen} Tasks fehlgeschlagen` : `${fehlgeschlagen} tasks failed`, delta: -pen, color: '#ef4444' });
  }

  // Blocked tasks (max -15)
  const blockPenalty = Math.min(aufgaben.blockiert * 5, 15);
  if (blockPenalty > 0) {
    score -= blockPenalty;
    factors.push({ label: de ? `${aufgaben.blockiert} Tasks blockiert` : `${aufgaben.blockiert} tasks blocked`, delta: -blockPenalty, color: '#f59e0b' });
  }

  // Pending approvals (-5)
  if (pendingApprovals > 0) {
    score -= 5;
    factors.push({ label: de ? `${pendingApprovals} Genehmigungen offen` : `${pendingApprovals} approvals pending`, delta: -5, color: '#f59e0b' });
  }

  score = Math.max(0, Math.min(100, score));
  const grade = score >= 90
    ? (de ? 'Exzellent' : 'Excellent')
    : score >= 70
    ? (de ? 'Gut' : 'Good')
    : score >= 50
    ? (de ? 'Mittel' : 'Fair')
    : (de ? 'Kritisch' : 'Critical');
  const gradeColor = score >= 90 ? '#22c55e' : score >= 70 ? '#c5a059' : score >= 50 ? '#f59e0b' : '#ef4444';

  return { score, grade, gradeColor, factors };
}

function HealthScoreGauge({ score, color, size = 80 }: { score: number; color: string; size?: number }) {
  const r = (size / 2) - 6;
  const circ = 2 * Math.PI * r;
  const arc = 0.75 * circ; // 270 degrees
  const pct = Math.max(0, Math.min(1, score / 100));
  const dash = pct * arc;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(135deg)' }}>
      {/* Background track */}
      <circle cx={size/2} cy={size/2} r={r}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7}
        strokeDasharray={`${arc} ${circ - arc}`} strokeLinecap="round"
      />
      {/* Value arc */}
      <circle cx={size/2} cy={size/2} r={r}
        fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color}80)`, transition: 'stroke-dasharray 0.8s ease' }}
      />
    </svg>
  );
}

export function HealthScoreCard({ experten, aufgaben, kosten, pendingApprovals, zyklen, recentActivityCount, lang }: {
  experten: { gesamt: number; aktiv: number; running: number; error: number };
  aufgaben: { gesamt: number; erledigt: number; fehlgeschlagen?: number; blockiert: number; inBearbeitung: number };
  kosten: { prozent: number };
  pendingApprovals: number;
  zyklen?: { total: number; succeeded: number; failed: number };
  recentActivityCount?: number;
  lang: string;
}) {
  const de = lang === 'de';
  const { score, grade, gradeColor, factors } = computeHealthScore(experten, aufgaben, kosten, pendingApprovals, zyklen, recentActivityCount, lang);
  const [expanded, setExpanded] = useState(false);

  return (
    <Card style={{ padding: '1.25rem 1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {/* Gauge */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <HealthScoreGauge score={score} color={gradeColor} size={72} />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexDirection: 'column',
          }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: gradeColor, lineHeight: 1 }}>{score}</span>
          </div>
        </div>

        {/* Labels */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {de ? 'Unternehmensgesundheit' : 'Company Health'}
            </span>
          </div>
          <div style={{ fontSize: '1.125rem', fontWeight: 800, color: gradeColor, marginBottom: '0.375rem' }}>
            {grade}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {factors.slice(0, 3).map((f, i) => (
              <span key={i} style={{
                fontSize: '0.6875rem', padding: '0.15rem 0.5rem', borderRadius: 0,
                background: `${f.color}18`, border: `1px solid ${f.color}30`, color: f.color,
              }}>
                {f.delta < 0 ? `${f.delta}` : '+'} {f.label}
              </span>
            ))}
            {factors.length > 3 && (
              <button onClick={() => setExpanded(e => !e)} style={{
                fontSize: '0.6875rem', padding: '0.15rem 0.5rem', borderRadius: 0,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', cursor: 'pointer',
              }}>
                {expanded ? (de ? 'weniger' : 'less') : `+${factors.length - 3} ${de ? 'mehr' : 'more'}`}
              </button>
            )}
          </div>
          {expanded && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.375rem' }}>
              {factors.slice(3).map((f, i) => (
                <span key={i} style={{
                  fontSize: '0.6875rem', padding: '0.15rem 0.5rem', borderRadius: 0,
                  background: `${f.color}18`, border: `1px solid ${f.color}30`, color: f.color,
                }}>
                  {f.delta < 0 ? `${f.delta}` : ''} {f.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
