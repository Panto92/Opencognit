import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  to?: string;
  linkLabel?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, to, linkLabel, action }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.25rem',
      }}
    >
      <h2
        style={{
          fontSize: '1rem',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          margin: 0,
        }}
      >
        {title}
      </h2>
      {action ? (
        action
      ) : to && linkLabel ? (
        <Link
          to={to}
          className="btn btn-ghost"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            fontSize: '0.8125rem',
            height: 32,
            padding: '0 0.75rem',
            textDecoration: 'none',
          }}
        >
          {linkLabel} <ArrowRight size={12} />
        </Link>
      ) : null}
    </div>
  );
}
