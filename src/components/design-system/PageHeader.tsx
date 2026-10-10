import type { ReactNode } from 'react';

// The one page header: title (optionally with a gold accent word), a muted subtitle,
// and actions on the right (use `oc-pill` / `oc-pill oc-pill--gold` buttons).
// The company name no longer sits above every title — it is in the sidebar and breadcrumb.

interface PageHeaderProps {
  title: ReactNode;
  /** Shown in gold right after the title, e.g. a count or a name. */
  accent?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Small inline element after the title, e.g. a live badge. */
  badge?: ReactNode;
}

export function PageHeader({ title, accent, subtitle, actions, badge }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{
          margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
          fontFamily: 'var(--font-family)', fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em',
          color: 'var(--oc-text)', lineHeight: 1.15,
        }}>
          <span>{title}{accent !== undefined && accent !== null && <span style={{ color: 'var(--oc-gold)' }}> {accent}</span>}</span>
          {badge}
        </h1>
        {subtitle && <p style={{ margin: '0.4rem 0 0', fontSize: '0.8125rem', color: 'var(--oc-text-3)', maxWidth: 640 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

/** Title + subtitle only — for pages that keep their own header row with actions. */
export function PageTitle({ title, subtitle, badge }: Pick<PageHeaderProps, 'title' | 'subtitle' | 'badge'>) {
  return (
    <div style={{ minWidth: 0 }}>
      <h1 style={{
        margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
        fontFamily: 'var(--font-family)', fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em',
        color: 'var(--oc-text)', lineHeight: 1.15,
      }}>
        {title}{badge}
      </h1>
      {subtitle && <p style={{ margin: '0.4rem 0 0', fontSize: '0.8125rem', color: 'var(--oc-text-3)', maxWidth: 640 }}>{subtitle}</p>}
    </div>
  );
}
