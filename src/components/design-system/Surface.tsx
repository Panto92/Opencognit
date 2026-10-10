import { useState } from 'react';

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Accent color for hover glow — default gold */
  accent?: string;
  /** Always show active/hover state */
  active?: boolean;
  /** Skip blur — use for high-density lists */
  noBlur?: boolean;
  /** Show ambient top-edge glow */
  ambient?: boolean;
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Enable hover lift effect */
  hoverable?: boolean;
}

const PAD_MAP = {
  none: 0,
  sm: '0.875rem',
  md: '1.25rem',
  lg: '1.5rem',
};

export function Surface({
  children,
  style = {},
  accent = '#c5a059',
  active = false,
  noBlur = false,
  ambient = false,
  padding = 'md',
  hoverable = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
  className,
  ...rest
}: SurfaceProps) {
  const [hovered, setHovered] = useState(false);
  const on = hovered || active;
  const pad = PAD_MAP[padding];

  return (
    <div
      {...rest}
      className={className}
      onClick={onClick}
      onMouseEnter={(e) => { setHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHovered(false); onMouseLeave?.(e); }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius-md)',
        padding: pad,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease',
        ...(noBlur
          ? {
              background: on ? 'rgba(20,16,10,0.95)' : 'rgba(14,11,7,0.92)',
              boxShadow: on
                ? `inset 0 0 0 1px ${accent}45, inset 0 1px 0 ${accent}30, 0 4px 20px rgba(0,0,0,0.5)`
                : `inset 0 0 0 1px rgba(197,160,89,0.10), inset 0 1px 0 rgba(197,160,89,0.06), 0 1px 4px rgba(0,0,0,0.4)`,
            }
          : {
              background: on
                ? `linear-gradient(160deg, rgba(18,14,9,0.96) 0%, rgba(10,7,4,0.98) 100%)`
                : `rgba(8,6,4,0.88)`,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: on
                ? `inset 0 0 0 1px ${accent}30, inset 0 1px 0 ${accent}22, 0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px ${accent}12`
                : `inset 0 0 0 1px rgba(197,160,89,0.10), inset 0 1px 0 rgba(197,160,89,0.07), 0 4px 16px rgba(0,0,0,0.4)`,
              transform: hoverable && on ? 'translateY(-2px)' : 'none',
            }),
        ...style,
      }}
    >
      {/* Top-edge accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: on
            ? `linear-gradient(90deg, transparent 0%, ${accent}65 35%, ${accent}65 65%, transparent 100%)`
            : `linear-gradient(90deg, transparent 0%, ${accent}22 35%, ${accent}22 65%, transparent 100%)`,
          transition: 'opacity 0.25s',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Ambient top glow */}
      {(on || ambient) && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 80,
            background: `linear-gradient(180deg, ${accent}08 0%, transparent 100%)`,
            pointerEvents: 'none',
            zIndex: 1,
            opacity: on ? 1 : 0.5,
            transition: 'opacity 0.25s',
          }}
        />
      )}

      {/* Subtle dot-matrix pattern on hover */}
      {!noBlur && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: on ? 0.6 : 0,
            transition: 'opacity 0.3s',
            backgroundImage: 'radial-gradient(circle, rgba(197,160,89,0.04) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}
