interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ width = '100%', height = 16, circle = false, className, style }: SkeletonProps) {
  return (
    <div
      className={className}
      style={{
        width,
        height: circle ? width : height,
        borderRadius: circle ? '50%' : 0,
        background: 'var(--skeleton)',
        animation: 'skeleton-pulse 2s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

interface SkeletonCardProps {
  lines?: number;
  header?: boolean;
}

export function SkeletonCard({ lines = 3, header = true }: SkeletonCardProps) {
  return (
    <div
      style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {header && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <Skeleton width="40%" height={14} />
          <Skeleton width={32} height={32} />
        </div>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} height={12} />
      ))}
    </div>
  );
}
