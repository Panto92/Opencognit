import { translateActivity } from '../../utils/activityTranslator';
import { Activity } from 'lucide-react';
import { reltime } from './shared';

export function ActivityItem({ item, lang }: { item: any; lang: string }) {
  const dotColor =
    item.entitaetTyp === 'aufgabe'     ? '#3b82f6' :
    item.entitaetTyp === 'kosten'      ? '#22c55e' :
    item.entitaetTyp === 'genehmigung' ? '#f59e0b' :
    item.entitaetTyp === 'experte'     ? '#c5a059' : '#475569';

  const actionText = translateActivity(item.aktion, lang);

  return (
    <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
      <div style={{
        width: 28, height: 28, borderRadius: 0, flexShrink: 0, marginTop: 1,
        background: dotColor + '15', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.8125rem', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
          <strong style={{ color: '#f1f5f9', fontWeight: 600 }}>{item.akteurName}</strong>
          {' '}{actionText}
        </p>
        <p style={{ fontSize: '0.6875rem', color: '#475569', marginTop: '0.1875rem' }}>
          {reltime(item.erstelltAm, lang)}
        </p>
      </div>
    </div>
  );
}

export function ActivityList({ items, lang }: { items: any[]; lang: string }) {
  const de = lang === 'de';

  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#475569' }}>
        <Activity size={32} style={{ opacity: 0.2, marginBottom: '0.75rem' }} />
        <p style={{ fontSize: '0.875rem', margin: 0 }}>
          {de ? 'Noch keine Aktivitäten' : 'No activity yet'}
        </p>
        <p style={{ fontSize: '0.75rem', marginTop: '0.375rem', color: '#334155' }}>
          {de
            ? 'Agenten berichten hier nach ihrem ersten Arbeitszyklus'
            : 'Agents report here after their first work cycle'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {items.slice(0, 8).map(a => (
        <ActivityItem key={a.id} item={a} lang={lang} />
      ))}
    </div>
  );
}
