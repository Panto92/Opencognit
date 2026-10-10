import type { ReactNode } from 'react';
import { useBreadcrumbs } from '../../hooks/useBreadcrumbs';

interface PageShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: string[];
  tabs?: {
    key: string;
    label: string;
    active?: boolean;
    onClick?: () => void;
  }[];
}

export function PageShell({ children, title, subtitle, actions, breadcrumbs: propCrumbs, tabs }: PageShellProps) {
  useBreadcrumbs(propCrumbs);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      {(title || actions) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            {title && (
              <h1 className="page-title" style={{ margin: 0 }}>
                {title}
              </h1>
            )}
            {subtitle && (
              <p
                className="page-subtitle"
                style={{ margin: '0.25rem 0 0 0' }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      {tabs && tabs.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 0,
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={tab.onClick}
              style={{
                padding: '0.625rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                background: 'none',
                border: 'none',
                borderBottom: tab.active ? '2px solid var(--color-accent)' : '2px solid transparent',
                color: tab.active ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {children}
    </div>
  );
}
