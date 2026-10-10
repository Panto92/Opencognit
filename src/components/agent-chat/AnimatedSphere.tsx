import React, { useMemo } from 'react';

// A quiet, slowly turning sphere of dots in OpenCognit gold for the chat's welcome screen.
const AnimatedSphere: React.FC = () => {
  const points = useMemo(() => {
    const numPoints = 180;
    const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle
    return Array.from({ length: numPoints }, (_, i) => {
      const y = 1 - (i / (numPoints - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = phi * i;
      return { x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius };
    });
  }, []);

  return (
    <div className="w-32 h-32 relative [perspective:1000px] flex items-center justify-center" aria-hidden>
      <div className="absolute inset-6 rounded-full bg-brand-500/10 blur-lg" />
      <div className="w-full h-full absolute animate-spin motion-reduce:animate-none" style={{ animationDuration: '70s', animationTimingFunction: 'linear' }}>
        <div className="w-full h-full relative [transform-style:preserve-3d]">
          {points.map((p, i) => {
            // Gold (hsl 40) with lightness/saturation tapering toward the poles for depth.
            const lightness = 38 + (p.y + 1) * 13;
            const saturation = 30 + (1 - Math.abs(p.y)) * 30;
            return (
              <div key={i} className="absolute w-1 h-1 rounded-full" style={{
                left: '50%', top: '50%',
                transform: `translate3d(-50%, -50%, 0) translate3d(${p.x * 60}px, ${p.y * 60}px, ${p.z * 60}px) scale(0.8)`,
                backgroundColor: `hsl(40, ${saturation}%, ${lightness}%)`,
                opacity: 0.6 + Math.abs(p.y) * 0.4,
              }} />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AnimatedSphere;
