import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  compact?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: compact ? '0.5rem' : '0.75rem',
        padding: compact ? '2rem 1rem' : '3rem 1rem',
        color: '#475569',
      }}
    >
      <Icon size={compact ? 28 : 40} style={{ opacity: 0.25, color: 'var(--color-text-tertiary)' }} />
      <p
        style={{
          fontSize: compact ? '0.8125rem' : '0.9375rem',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          margin: 0,
        }}
      >
        {title}
      </p>
      {description && (
        <p
          style={{
            fontSize: '0.8125rem',
            color: 'var(--color-text-tertiary)',
            margin: 0,
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="btn btn-primary"
          style={{
            marginTop: '0.5rem',
            height: 32,
            padding: '0 0.875rem',
            fontSize: '0.75rem',
            gap: '0.375rem',
          }}
        >
          {action.label}
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}
