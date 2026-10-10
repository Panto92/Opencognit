import React from 'react';

// A light band sweeping across the text.
export type TextShimmerProps = {
  as?: string;
  duration?: number;
  spread?: number;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>;

export function TextShimmer({ as = 'span', className = '', duration = 4, spread = 20, children, style, ...props }: TextShimmerProps) {
  const dynamicSpread = Math.min(Math.max(spread, 5), 45);
  const Component = as as React.ElementType;
  return (
    <Component
      className={`bg-[length:200%_auto] bg-clip-text font-medium text-transparent animate-[text-shimmer_4s_infinite_linear] motion-reduce:animate-none ${className}`}
      style={{
        backgroundImage: `linear-gradient(to right, var(--muted-foreground) ${50 - dynamicSpread}%, var(--foreground) 50%, var(--muted-foreground) ${50 + dynamicSpread}%)`,
        animationDuration: `${duration}s`,
        ...style,
      }}
      {...props}
    >
      {children}
    </Component>
  );
}
