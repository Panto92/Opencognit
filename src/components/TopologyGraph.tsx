import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ────────────────────────────────────────────────────────────────────

interface TopologyAgent {
  id: string;
  name: string;
  rolle: string;
  avatar: string;
  avatarFarbe: string;
  status: string;
  isOrchestrator?: boolean;
  reportsTo?: string | null;
}

interface TopologyTrace {
  expertId: string;
  typ: string;
  titel: string;
  erstelltAm: string;
}

interface TopologyProps {
  agents: TopologyAgent[];
  recentTraces: TopologyTrace[];
  language: string;
}

// ── Node Layout Engine ───────────────────────────────────────────────────────

interface NodePos {
  id: string;
  x: number;
  y: number;
  agent: TopologyAgent;
}

function computeLayout(agents: TopologyAgent[], width: number, height: number): NodePos[] {
  if (agents.length === 0) return [];

  const cx = width / 2;
  const cy = height / 2;

  // Find CEO / Orchestrator
  const ceo = agents.find(a => a.isOrchestrator);
  const workers = agents.filter(a => !a.isOrchestrator);

  const positions: NodePos[] = [];

  if (ceo) {
    // CEO at top center
    positions.push({ id: ceo.id, x: cx, y: 50, agent: ceo });

    // Workers arranged in a semicircle below
    const radius = Math.min(width * 0.35, height * 0.35, 140);
    const startAngle = Math.PI * 0.15;
    const endAngle = Math.PI * 0.85;
    const step = workers.length > 1 ? (endAngle - startAngle) / (workers.length - 1) : 0;

    workers.forEach((agent, i) => {
      const angle = workers.length === 1 ? Math.PI / 2 : startAngle + step * i;
      const x = cx + radius * Math.cos(angle) * (width > 300 ? 1.4 : 1);
      const y = 50 + radius * Math.sin(angle) * 1.6 + 20;
      positions.push({ id: agent.id, x, y, agent });
    });
  } else {
    // No CEO — arrange in a circle
    const radius = Math.min(width * 0.3, height * 0.3, 100);
    agents.forEach((agent, i) => {
      const angle = (2 * Math.PI * i) / agents.length - Math.PI / 2;
      positions.push({
        id: agent.id,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        agent,
      });
    });
  }

  return positions;
}

// ── Animated Message Particle ────────────────────────────────────────────────

interface Particle {
  id: string;
  fromId: string;
  toId: string;
  startTime: number;
  duration: number;
  color: string;
}

// ── Status Colors ────────────────────────────────────────────────────────────

function statusColor(status: string): string {
  switch (status) {
    case 'running': return '#c5a059';
    case 'active': return '#7cb97a';
    case 'error': return '#c97b7b';
    case 'paused': return '#d4a373';
    default: return '#5c554d';
  }
}

function statusGlow(status: string): string {
  switch (status) {
    case 'running': return '0 0 12px rgba(197,160,89,0.5)';
    case 'active': return '0 0 6px rgba(124,185,122,0.3)';
    case 'error': return '0 0 8px rgba(201,123,123,0.4)';
    default: return 'none';
  }
}

// ── Main Component ───────────────────────────────────────────────────────────

export function TopologyGraph({ agents, recentTraces, language }: TopologyProps) {
  const de = language === 'de';
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 340, h: 250 });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const prevTraceCount = useRef(0);
  const animFrame = useRef(0);

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setSize({ w: width, h: height });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Compute node positions
  const nodes = useMemo(() => computeLayout(agents, size.w, size.h), [agents, size.w, size.h]);
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // Build edges (CEO → each worker, and between workers who share reportsTo)
  const edges = useMemo(() => {
    const result: { from: string; to: string }[] = [];
    const ceo = agents.find(a => a.isOrchestrator);
    if (ceo) {
      for (const agent of agents) {
        if (agent.id !== ceo.id) {
          result.push({ from: ceo.id, to: agent.id });
        }
      }
    }
    return result;
  }, [agents]);

  // When new traces arrive, spawn particles
  useEffect(() => {
    if (recentTraces.length <= prevTraceCount.current) {
      prevTraceCount.current = recentTraces.length;
      return;
    }

    const newTraces = recentTraces.slice(prevTraceCount.current);
    prevTraceCount.current = recentTraces.length;

    const ceo = agents.find(a => a.isOrchestrator);

    for (const trace of newTraces) {
      // Show particle from agent to CEO (result/completion) or CEO to agent (action/delegation)
      let fromId: string | null = null;
      let toId: string | null = null;
      let color = '#c5a059';

      if (trace.typ === 'action' || trace.typ === 'task_started') {
        // CEO delegating
        if (ceo) {
          fromId = ceo.id;
          toId = trace.expertId;
          color = '#c5a059';
        }
      } else if (trace.typ === 'result' || trace.typ === 'task_completed') {
        // Worker reporting back
        if (ceo) {
          fromId = trace.expertId;
          toId = ceo.id;
          color = '#7cb97a';
        }
      } else if (trace.typ === 'error' || trace.typ === 'critic_rejected') {
        if (ceo) {
          fromId = trace.expertId;
          toId = ceo.id;
          color = '#c97b7b';
        }
      } else if (trace.typ === 'thinking') {
        // Self-loop — pulse on the agent node itself
        fromId = trace.expertId;
        toId = trace.expertId;
        color = '#9b87c8';
      }

      if (fromId && toId && fromId !== toId && nodeMap.has(fromId) && nodeMap.has(toId)) {
        setParticles(prev => [
          ...prev.slice(-10),
          {
            id: `p-${Date.now()}-${Math.random()}`,
            fromId,
            toId,
            startTime: Date.now(),
            duration: 800,
            color,
          },
        ]);
      }
    }
  }, [recentTraces, agents, nodeMap]);

  // Animate particles
  const [, forceUpdate] = useState(0);
  const tick = useCallback(() => {
    const now = Date.now();
    setParticles(prev => {
      const alive = prev.filter(p => now - p.startTime < p.duration);
      return alive.length !== prev.length ? alive : prev;
    });
    forceUpdate(c => c + 1);
    animFrame.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    animFrame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame.current);
  }, [tick]);

  // Active edges (edges where either node is running)
  const activeEdges = useMemo(() => {
    const runningIds = new Set(agents.filter(a => a.status === 'running').map(a => a.id));
    return new Set(
      edges.filter(e => runningIds.has(e.from) || runningIds.has(e.to))
        .map(e => `${e.from}-${e.to}`)
    );
  }, [agents, edges]);

  const now = Date.now();

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <svg
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        style={{ display: 'block' }}
      >
        <defs>
          {/* Gold glow filter */}
          <filter id="topo-glow-gold" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="topo-glow-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="topo-glow-red" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Edges */}
        {edges.map(edge => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;
          const key = `${edge.from}-${edge.to}`;
          const isActive = activeEdges.has(key);
          const isHovered = hoveredNode === edge.from || hoveredNode === edge.to;

          return (
            <line
              key={key}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={isActive ? 'rgba(197,160,89,0.5)' : isHovered ? 'rgba(197,160,89,0.35)' : 'rgba(255,255,255,0.06)'}
              strokeWidth={isActive ? 2 : 1.5}
              strokeDasharray={isActive ? 'none' : '4,4'}
              style={{ transition: 'stroke 0.3s, stroke-width 0.3s' }}
            />
          );
        })}

        {/* Particles */}
        {particles.map(p => {
          const from = nodeMap.get(p.fromId);
          const to = nodeMap.get(p.toId);
          if (!from || !to) return null;
          const progress = Math.min(1, (now - p.startTime) / p.duration);
          const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
          const x = from.x + (to.x - from.x) * eased;
          const y = from.y + (to.y - from.y) * eased;
          const opacity = progress < 0.1 ? progress / 0.1 : progress > 0.8 ? (1 - progress) / 0.2 : 1;

          return (
            <circle
              key={p.id}
              cx={x}
              cy={y}
              r={4}
              fill={p.color}
              opacity={opacity}
              filter="url(#topo-glow-gold)"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const isRunning = node.agent.status === 'running';
          const isCeo = node.agent.isOrchestrator;
          const isHovered = hoveredNode === node.id;
          const r = isCeo ? 24 : 18;
          const sc = statusColor(node.agent.status);

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              style={{ cursor: 'default' }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {/* Outer pulse ring for running agents */}
              {isRunning && (
                <circle
                  r={r + 6}
                  fill="none"
                  stroke={sc}
                  strokeWidth={1.5}
                  opacity={0.3}
                  style={{ animation: 'aura 2s ease-in-out infinite' }}
                />
              )}

              {/* Node circle */}
              <circle
                r={r}
                fill={isHovered ? 'rgba(20,18,16,0.95)' : 'rgba(12,12,18,0.9)'}
                stroke={isRunning ? sc : isHovered ? 'rgba(197,160,89,0.5)' : 'rgba(255,255,255,0.12)'}
                strokeWidth={isCeo ? 2.5 : 2}
                style={{
                  transition: 'stroke 0.2s, fill 0.2s',
                  filter: isRunning ? statusGlow(node.agent.status) : 'none',
                }}
              />

              {/* Avatar emoji */}
              <text
                dy="1"
                textAnchor="middle"
                dominantBaseline="central"
                style={{
                  fontSize: isCeo ? 16 : 13,
                  pointerEvents: 'none',
                  userSelect: 'none',
                }}
              >
                {node.agent.avatar || '🤖'}
              </text>

              {/* Name label below */}
              <text
                dy={r + 14}
                textAnchor="middle"
                style={{
                  fill: isHovered ? '#f1f5f9' : '#64748b',
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: "'Inter', sans-serif",
                  letterSpacing: '0.04em',
                  pointerEvents: 'none',
                  transition: 'fill 0.2s',
                }}
              >
                {node.agent.name.length > 12 ? node.agent.name.slice(0, 11) + '…' : node.agent.name}
              </text>

              {/* Status dot */}
              <circle
                cx={r * 0.7}
                cy={-r * 0.7}
                r={4}
                fill={sc}
                stroke="rgba(6,4,3,0.9)"
                strokeWidth={2}
                style={{
                  filter: statusGlow(node.agent.status),
                  ...(isRunning ? { animation: 'pulse 1.5s ease-in-out infinite' } : {}),
                }}
              />

              {/* CEO crown badge */}
              {isCeo && (
                <text
                  dy={-r - 8}
                  textAnchor="middle"
                  style={{
                    fontSize: 12,
                    pointerEvents: 'none',
                    filter: 'drop-shadow(0 0 3px rgba(255,215,0,0.4))',
                  }}
                >
                  👑
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredNode && (() => {
          const node = nodeMap.get(hoveredNode);
          if (!node) return null;
          return (
            <motion.div
              key={hoveredNode}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                left: Math.min(node.x - 60, size.w - 140),
                top: Math.max(node.y - 70, 4),
                background: 'rgba(8,6,4,0.95)',
                border: '1px solid rgba(197,160,89,0.3)',
                padding: '6px 10px',
                pointerEvents: 'none',
                zIndex: 10,
                minWidth: 120,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>
                {node.agent.name}
              </div>
              <div style={{ fontSize: 9, color: '#c5a059', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {node.agent.rolle}
              </div>
              <div style={{ fontSize: 9, color: statusColor(node.agent.status), marginTop: 3, fontWeight: 700 }}>
                ● {node.agent.status.toUpperCase()}
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: 6,
        left: 8,
        display: 'flex',
        gap: 10,
        fontSize: 8,
        color: '#334155',
        fontFamily: "'Inter', sans-serif",
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#c5a059' }} />
          {de ? 'Aktiv' : 'Active'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#7cb97a' }} />
          {de ? 'Bereit' : 'Ready'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#5c554d' }} />
          Idle
        </span>
      </div>
    </div>
  );
}
