export function CompanyBrief({
  experten, aufgaben, kosten, pendingApprovals, letzteAktivitaet, lang,
}: {
  experten: { aktiv: number; running: number; gesamt: number };
  aufgaben: { offen: number; inBearbeitung: number; blockiert: number; erledigt: number; gesamt: number };
  kosten: { prozent: number };
  pendingApprovals: number;
  letzteAktivitaet: any[];
  lang: string;
}) {
  const de = lang === 'de';

  const today = new Date().toDateString();
  const todayEvents = letzteAktivitaet.filter(a => new Date(a.erstelltAm).toDateString() === today);

  type Insight = { color: string; text: string };
  let insight: Insight | null = null;
  if (kosten.prozent >= 90) {
    insight = { color: '#ef4444', text: de ? `⚠ Budget fast aufgebraucht (${kosten.prozent}%)` : `⚠ Budget nearly exhausted (${kosten.prozent}%)` };
  } else if (aufgaben.blockiert > 0 && experten.aktiv > experten.running) {
    const idleCount = experten.aktiv - experten.running;
    insight = { color: '#f59e0b', text: de
      ? `${aufgaben.blockiert} blockierte Aufgaben · ${idleCount} Agenten verfügbar`
      : `${aufgaben.blockiert} blocked tasks · ${idleCount} agents available` };
  } else if (pendingApprovals > 0) {
    insight = { color: '#f59e0b', text: de
      ? `${pendingApprovals} Genehmigung${pendingApprovals > 1 ? 'en' : ''} ausstehend`
      : `${pendingApprovals} approval${pendingApprovals > 1 ? 's' : ''} pending` };
  } else if (experten.running > 0) {
    insight = { color: '#c5a059', text: de
      ? `${experten.running} Agent${experten.running > 1 ? 'en' : ''} arbeitet gerade`
      : `${experten.running} agent${experten.running > 1 ? 's' : ''} working right now` };
  } else if (aufgaben.erledigt > 0) {
    insight = { color: '#22c55e', text: de
      ? `${aufgaben.erledigt} Aufgaben erledigt gesamt`
      : `${aufgaben.erledigt} tasks completed total` };
  }

  const metrics: { label: string; value: string | number; color: string }[] = [
    { label: de ? 'Heute aktiv' : 'Events today',    value: todayEvents.length, color: '#c5a059' },
    { label: de ? 'Laufende Agenten' : 'Running',     value: experten.running,   color: '#22c55e' },
    { label: de ? 'Offene Aufgaben' : 'Open tasks',  value: aufgaben.offen,     color: '#94a3b8' },
    { label: de ? 'Budget genutzt' : 'Budget used',  value: `${kosten.prozent}%`, color: kosten.prozent > 80 ? '#ef4444' : '#22c55e' },
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
      padding: '0.875rem 1.5rem', borderRadius: 0,
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: '0.625rem', fontWeight: 700, color: '#334155', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {de ? 'Heute' : 'Today'}
        </div>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#64748b' }}>
          {new Date().toLocaleDateString(de ? 'de-DE' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
        </div>
      </div>

      <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

      {metrics.map((m, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span style={{ fontSize: '1.125rem', fontWeight: 800, color: m.color }}>{m.value}</span>
          <span style={{ fontSize: '0.75rem', color: '#475569' }}>{m.label}</span>
        </div>
      ))}

      {insight && (
        <>
          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.07)', flexShrink: 0, marginLeft: 'auto' }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.3rem 0.75rem', borderRadius: 0,
            background: insight.color + '12', border: `1px solid ${insight.color}30`,
            fontSize: '0.75rem', fontWeight: 600, color: insight.color, flexShrink: 0,
          }}>
            {insight.text}
          </div>
        </>
      )}
    </div>
  );
}
