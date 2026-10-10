// Swarm view ("WarRoom 2.0"): a cinematic Canvas 2D visualization of the company's live task
// swarm — glowing worker entities crawl over the task DAG, pulse packets travel along dependency
// edges while downstream tasks activate, and merges flash as expanding rings. The bottom HUD strip
// (DOM, i18n-labeled) shows per-stage progress, a spec-score gauge and the compact event log.
// All layout/simulation math is in layout.ts; this file only draws.

import { useEffect, useRef } from 'react';
import { useI18n } from '@/i18n';
import { FillBar, ProgressRing } from '@/components/design-system';
import {
  STAGE_ORDER, bezierPoint, edgeIsActive, edgeIsBroken, edgeRoute, layoutNodes, makeEntity, makeStarfield,
  stepEntity, type Star, type SwarmEntity,
} from './layout';
import type { PlacedNode, SwarmModel, SwarmPhase } from './types';

export interface SwarmViewProps {
  model: SwarmModel | null;
  loading?: boolean;
  onNodeClick?: (nodeId: string, taskId: string | null) => void;
}

const BG = '#070605';
const PHASE_COLOR: Record<SwarmPhase, string> = {
  waiting: 'rgba(255,255,255,0.32)',
  building: '#c5a059',
  testing: '#22d3ee',
  reviewing: '#f59e0b',
  needs_you: '#f87171',
  merged: '#34d399',
  blocked: '#6b7280',
};
const STAGE_COLOR: Record<string, string> = {
  waiting: 'rgba(255,255,255,0.35)',
  building: '#c5a059',
  testing: '#22d3ee',
  reviewing: '#f59e0b',
  needs_you: '#f87171',
  merged: '#34d399',
};
const NODE_R = 10;
const MERGE_FLASH_MS = 900;

interface FlashRing { x: number; y: number; startedAt: number }

interface DrawState {
  placed: PlacedNode[];
  byId: Map<string, PlacedNode>;
  entities: Map<string, SwarmEntity>;
  rings: FlashRing[];
  prevPhase: Map<string, SwarmPhase>;
  stars: Star[];
  sizeKey: string;
  laidOutFor: SwarmModel | null;
  lastTs: number;
}

export function SwarmView({ model, loading, onNodeClick }: SwarmViewProps) {
  const { t } = useI18n();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<SwarmModel | null>(null);
  const clickRef = useRef(onNodeClick);
  const stateRef = useRef<DrawState>({
    placed: [], byId: new Map(), entities: new Map(), rings: [], prevPhase: new Map(), stars: [], sizeKey: '', laidOutFor: null, lastTs: 0,
  });
  const hoverRef = useRef<string | null>(null);
  clickRef.current = onNodeClick;

  useEffect(() => { modelRef.current = model; }, [model]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // jsdom / unsupported: the DOM HUD still renders

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    let dispose = () => {};
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(resize);
      ro.observe(wrap);
      dispose = () => ro.disconnect();
    }

    const cssSize = () => ({ w: canvas.width / dpr, h: canvas.height / dpr });

    const ensureLayout = (st: DrawState) => {
      const { w, h } = cssSize();
      const m = modelRef.current;
      // Recompute when the canvas size OR the polled model (new object every poll) changes.
      const key = `${w}x${h}`;
      if ((!m && st.laidOutFor === null) || (st.laidOutFor === m && st.sizeKey === key) || !m || w < 10 || h < 10) return;
      st.sizeKey = key;
      st.laidOutFor = m;
      st.placed = layoutNodes(m.nodes, w, h);
      st.byId = new Map(st.placed.map((n) => [n.id, n]));
      const rng = makeStarfield(42, Math.min(140, Math.floor((w * h) / 9000)), w, h);
      st.stars = rng;
      // Entities crawl in from the left edge when they appear; merges spawn a flash ring.
      for (const n of st.placed) {
        if (!st.entities.has(n.id)) st.entities.set(n.id, makeEntity(n.id, { x: -30, y: n.y }));
        const prev = st.prevPhase.get(n.id);
        if (prev !== undefined && prev !== 'merged' && n.phase === 'merged') {
          st.rings.push({ x: n.x, y: n.y, startedAt: performance.now() });
        }
        st.prevPhase.set(n.id, n.phase);
      }
    };

    const draw = (now: number) => {
      const st = stateRef.current;
      const dt = st.lastTs ? Math.min(100, now - st.lastTs) : 16;
      st.lastTs = now;
      const { w, h } = cssSize();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);
      const m = modelRef.current;
      if (!m || w < 10 || h < 10) return;

      ensureLayout(st);
      for (const n of st.placed) {
        const e = st.entities.get(n.id);
        if (e) st.entities.set(n.id, stepEntity(e, n, dt));
      }

      // Starfield
      for (const s of st.stars) {
        const a = 0.10 + 0.12 * (0.5 + 0.5 * Math.sin(now / 1400 + s.twinkle));
        ctx.globalAlpha = a;
        ctx.fillStyle = '#e8e2d8';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Edges + pulse packets
      for (const edge of m.edges) {
        const from = st.byId.get(edge.from);
        const to = st.byId.get(edge.to);
        if (!from || !to) continue;
        const route = edgeRoute(from, to, edgeIsBroken(st.byId, edge.from, edge.to));
        const active = edgeIsActive(st.byId, edge.from, edge.to);
        ctx.beginPath();
        ctx.moveTo(route.from.x, route.from.y);
        ctx.bezierCurveTo(route.c1.x, route.c1.y, route.c2.x, route.c2.y, route.to.x, route.to.y);
        if (route.broken) {
          ctx.setLineDash([5, 7]);
          ctx.strokeStyle = 'rgba(248,113,113,0.30)';
          ctx.lineWidth = 1.2;
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle = active ? 'rgba(197,160,89,0.35)' : 'rgba(255,255,255,0.08)';
          ctx.lineWidth = active ? 1.6 : 1;
        }
        ctx.stroke();
        ctx.setLineDash([]);
        if (active && !route.broken) {
          const color = PHASE_COLOR[to.phase];
          for (let k = 0; k < 2; k++) {
            const p = bezierPoint(route, ((now / 2600) + k / 2 + (from.x % 17) / 17) % 1);
            ctx.save();
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      // Merge flash rings
      st.rings = st.rings.filter((r) => now - r.startedAt < MERGE_FLASH_MS);
      for (const r of st.rings) {
        const p = (now - r.startedAt) / MERGE_FLASH_MS;
        ctx.globalAlpha = (1 - p) * 0.75;
        ctx.strokeStyle = PHASE_COLOR.merged;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, NODE_R + p * 48, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Nodes + entities
      st.placed.forEach((n, idx) => {
        const e = st.entities.get(n.id) ?? n;
        const color = PHASE_COLOR[n.phase];
        const pulse = Math.sin(now / 280 + idx * 1.7);
        const hovered = hoverRef.current === n.id;

        // glow halo at the entity position (the worker), node body at the task position
        ctx.save();
        if (n.phase === 'building' || n.phase === 'needs_you' || n.phase === 'reviewing') {
          ctx.shadowColor = color;
          ctx.shadowBlur = n.phase === 'building' ? 16 + pulse * 6 : 12;
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, NODE_R, 0, Math.PI * 2);
        ctx.globalAlpha = n.phase === 'waiting' ? 0.35 : n.phase === 'blocked' ? 0.55 : 0.95;
        ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;

        if (n.phase === 'waiting') {
          ctx.strokeStyle = 'rgba(255,255,255,0.14)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(n.x, n.y, NODE_R, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (n.phase === 'testing') {
          // cyan sweep arc rotating around the node
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(n.x, n.y, NODE_R + 5, now / 380, now / 380 + Math.PI * 0.9);
          ctx.stroke();
        }
        if (n.phase === 'reviewing') {
          // faint orbit path around the node under review
          ctx.strokeStyle = 'rgba(167,139,250,0.25)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(n.x, n.y, NODE_R + 13, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (n.phase === 'needs_you') {
          ctx.strokeStyle = `rgba(248,113,113,${0.35 + 0.3 * Math.max(0, pulse)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(n.x, n.y, NODE_R + 5 + Math.max(0, pulse) * 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (n.phase === 'blocked') {
          ctx.setLineDash([4, 5]);
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(n.x, n.y, NODE_R + 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (hovered) {
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(n.x, n.y, NODE_R + 8, 0, Math.PI * 2);
          ctx.stroke();
        }

        // inner core brightens as the entity (worker) arrives at the node
        const dist = Math.hypot(e.x - n.x, e.y - n.y);
        const arrived = Math.max(0, 1 - dist / 120);
        if (arrived > 0.02) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.beginPath();
          ctx.arc(n.x, n.y, NODE_R * 0.35 * arrived + 1, 0, Math.PI * 2);
          ctx.fill();
        }

        // label
        ctx.font = '11px ui-sans-serif, system-ui, sans-serif';
        ctx.fillStyle = hovered ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)';
        const label = n.title.length > 26 ? `${n.title.slice(0, 25)}…` : n.title;
        ctx.textAlign = 'center';
        ctx.fillText(label, n.x, n.y - NODE_R - 10);
      });
    };

    let raf = 0;
    const loop = (now: number) => {
      try { draw(now); } catch { /* never let one bad frame kill the loop */ }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const nodeAt = (x: number, y: number): PlacedNode | null => {
      const st = stateRef.current;
      let best: PlacedNode | null = null;
      let bestD = 24;
      for (const n of st.placed) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bestD) { bestD = d; best = n; }
      }
      return best;
    };
    const onMove = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const n = nodeAt(ev.clientX - rect.left, ev.clientY - rect.top);
      hoverRef.current = n?.id ?? null;
      canvas.style.cursor = n ? 'pointer' : 'default';
    };
    const onLeave = () => { hoverRef.current = null; canvas.style.cursor = 'default'; };
    const onClick = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const n = nodeAt(ev.clientX - rect.left, ev.clientY - rect.top);
      if (n) clickRef.current?.(n.id, n.taskId);
    };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('click', onClick);

    return () => {
      cancelAnimationFrame(raf);
      dispose();
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('click', onClick);
    };
  }, []);

  const telemetry = model?.telemetry ?? null;
  // The spec score is only meaningful when at least one finished node carries a test or review
  // signal; backends without test/review tracking (plain tasks) show the placeholder instead of
  // a misleading 0%.
  const specKnown = !!model && model.nodes.some(
    (n) => n.phase === 'merged' && (n.testsPassed !== null || n.reviewVerdict !== null),
  );
  const eventKinds = t.swarm.eventKinds as unknown as Record<string, string>;

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="swarm-view">
      <div ref={wrapRef} className="relative flex-1 min-h-0 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0" aria-label={t.swarm.viewTitle} />
        {!model && !loading && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="oc-card px-5 py-4 text-[13px] text-white/45">{t.swarm.empty}</div>
          </div>
        )}
        {model && (
          <div className="absolute top-3 left-4 flex items-center gap-2.5 pointer-events-none min-w-0">
            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${model.running ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'}`} />
            <span className="text-[12.5px] font-semibold text-white/75 truncate max-w-[38vw]">{model.title}</span>
            <span className="text-[11px] tracking-[0.18em] uppercase text-white/45 flex-shrink-0">
              {model.running ? t.swarm.live : t.swarm.idle} · {t.swarm.updated} {new Date(model.updatedAt).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* HUD strip */}
      <div className="flex-shrink-0 border-t border-white/5 bg-black/40 backdrop-blur px-5 py-3 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-x-8 gap-y-3 items-center">
        <div>
          <div className="text-[10px] font-semibold tracking-[0.16em] uppercase text-white/40 mb-1.5">
            {t.swarm.progress}
          </div>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-1.5 max-w-2xl">
            {STAGE_ORDER.map((key) => {
              const stage = telemetry?.stages.find((s) => s.key === key);
              return (
                <div key={key} className="min-w-[84px]">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <span className="text-[10.5px] text-white/50">{t.swarm.stages[key]}</span>
                    <span className="text-[10.5px] tabular-nums text-white/70">{stage?.count ?? 0}</span>
                  </div>
                  <FillBar value={stage?.fraction ?? 0} color={STAGE_COLOR[key]} label={t.swarm.stages[key]} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ProgressRing value={specKnown && telemetry ? telemetry.specScore : 0} size={54} stroke={4.5}
            color={!specKnown || !telemetry ? 'rgba(255,255,255,0.2)' : telemetry.specScore >= 0.8 ? '#34d399' : telemetry.specScore >= 0.5 ? '#fbbf24' : '#f87171'}>
            <div className="absolute inset-0 grid place-items-center text-[11px] font-bold tabular-nums text-white/85">
              {specKnown && telemetry ? `${Math.round(telemetry.specScore * 100)}%` : t.swarm.noFinished}
            </div>
          </ProgressRing>
          <div>
            <div className="text-[11px] font-semibold text-white/75">{t.swarm.specScore}</div>
            <div className="text-[10px] text-white/40 max-w-[130px] leading-tight">{t.swarm.specScoreHint}</div>
          </div>
        </div>

        <div className="min-w-[220px] md:max-w-[300px] w-full">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-white/40">{t.swarm.events}</span>
            <span className="text-[10px] tabular-nums text-white/40">
              {t.swarm.eventsPerMin.replace('{n}', String(Math.round(telemetry?.eventRatePerMin ?? 0)))}
            </span>
          </div>
          <div className="space-y-0.5">
            {(model?.events ?? []).slice(0, 6).map((e) => {
              const tone = ['error', 'merge_conflict', 'pr_failed'].includes(e.kind) ? '#f87171'
                : ['approved', 'tests', 'commit', 'receipt'].includes(e.kind) ? '#34d399'
                : ['review', 'critic', 'fix_requested', 'review_note'].includes(e.kind) ? '#a78bfa'
                : 'rgba(255,255,255,0.45)';
              const kindLabel = eventKinds[e.kind] ?? eventKinds.default;
              return (
                <div key={e.id} className="flex items-center gap-1.5 text-[10.5px] text-white/55 truncate">
                  <span className="h-1 w-1 rounded-full flex-shrink-0" style={{ background: tone }} />
                  <span className="tabular-nums text-white/35 flex-shrink-0">
                    {new Date(e.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="truncate">{kindLabel}{e.nodeTitle ? ` · ${e.nodeTitle}` : ''}</span>
                </div>
              );
            })}
            {(model?.events ?? []).length === 0 && (
              <div className="text-[10.5px] text-white/30">—</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SwarmView;
