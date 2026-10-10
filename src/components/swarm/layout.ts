// Pure layout & simulation math for the Swarm view — no DOM, no canvas, unit-testable in jsdom.
// Owns: DAG depth layering, canvas positioning (depth = column, parallel tasks spread vertically),
// bezier edge routing, worker-entity movement (exponential approach, monotonic), starfield
// generation (seeded PRNG) and HUD telemetry (per-stage fractions, event rate, spec score).

import type { Point, PlacedNode, StageKey, StageStat, SwarmEvent, SwarmNode, SwarmTelemetry } from './types';

export const STAGE_ORDER: StageKey[] = ['waiting', 'building', 'testing', 'reviewing', 'needs_you', 'merged'];

/** Longest-path depth of each node; cycles and missing deps degrade gracefully. */
export function computeDepths(nodes: Pick<SwarmNode, 'id' | 'dependsOn'>[]): Map<string, number> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depth = new Map<string, number>();
  const visit = (id: string, seen: Set<string>): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const deps = byId.get(id)?.dependsOn.filter((d) => byId.has(d)) ?? [];
    const d = deps.length ? Math.max(...deps.map((x) => visit(x, seen) + 1)) : 0;
    depth.set(id, d);
    return d;
  };
  for (const n of nodes) visit(n.id, new Set());
  return depth;
}

/**
 * Position nodes for the canvas: one column per DAG depth (left → right flow of the pipeline),
 * tasks within a column spread vertically and centered. Returns copies with x/y attached;
 * input order within a depth column is preserved (stable).
 */
export function layoutNodes<T extends Pick<SwarmNode, 'id' | 'dependsOn'>>(nodes: T[], width: number, height: number): (T & Point)[] {
  const marginX = Math.max(48, width * 0.07);
  const marginY = Math.max(44, height * 0.1);
  const depth = computeDepths(nodes);
  const columns = new Map<number, T[]>();
  for (const n of nodes) {
    const d = depth.get(n.id) ?? 0;
    const col = columns.get(d) ?? [];
    col.push(n);
    columns.set(d, col);
  }
  const maxDepth = Math.max(0, ...columns.keys());
  const usableW = Math.max(1, width - marginX * 2);
  const usableH = Math.max(1, height - marginY * 2);
  const colX = (d: number) => (maxDepth === 0 ? width / 2 : marginX + (d / maxDepth) * usableW);

  const out: (T & Point)[] = [];
  for (const [d, col] of columns) {
    const x = colX(d);
    col.forEach((n, i) => {
      const y = marginY + ((i + 1) / (col.length + 1)) * usableH;
      out.push({ ...n, x, y });
    });
  }
  return out;
}

export interface EdgeRoute {
  from: Point;
  to: Point;
  /** Cubic bezier control points, horizontally biased like a left-to-right flow diagram. */
  c1: Point;
  c2: Point;
  /** True when the upstream dependency is unmet — the edge renders "broken". */
  broken: boolean;
}

/** Route an edge as a horizontal cubic bezier between two node positions. */
export function edgeRoute(from: Point, to: Point, broken = false): EdgeRoute {
  const dx = Math.max(60, Math.abs(to.x - from.x) * 0.5);
  const flip = to.x < from.x;
  return {
    from,
    to,
    c1: { x: from.x + (flip ? -dx : dx), y: from.y },
    c2: { x: to.x + (flip ? dx : -dx), y: to.y },
    broken,
  };
}

/** Point on a cubic bezier at parameter t (0..1). */
export function bezierPoint(r: Pick<EdgeRoute, 'from' | 'to' | 'c1' | 'c2'>, t: number): Point {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return {
    x: w0 * r.from.x + w1 * r.c1.x + w2 * r.c2.x + w3 * r.to.x,
    y: w0 * r.from.y + w1 * r.c1.y + w2 * r.c2.y + w3 * r.to.y,
  };
}

/** A worker entity crawling across the graph toward its task node. */
export interface SwarmEntity {
  nodeId: string;
  x: number;
  y: number;
}

export function makeEntity(nodeId: string, start: Point): SwarmEntity {
  return { nodeId, x: start.x, y: start.y };
}

/**
 * Move an entity toward its target with an exponential approach (frame-rate independent).
 * The distance to the target never increases, so approach is monotonic; a small snap threshold
 * avoids endless micro-movement.
 */
export function stepEntity(e: SwarmEntity, target: Point, dtMs: number): SwarmEntity {
  const k = 1 - Math.exp(-(dtMs / 1000) * 3.2);
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  if (dx * dx + dy * dy < 0.25) return { ...e, x: target.x, y: target.y };
  return { x: e.x + dx * k, y: e.y + dy * k, nodeId: e.nodeId };
}

export function entityDistance(e: SwarmEntity, target: Point): number {
  return Math.hypot(target.x - e.x, target.y - e.y);
}

/** Deterministic PRNG (mulberry32) so the starfield is stable across renders. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Star {
  x: number;
  y: number;
  r: number;
  twinkle: number;
}

/** Pre-generated background stars, cheap to draw and stable for a given seed. */
export function makeStarfield(seed: number, count: number, width: number, height: number): Star[] {
  const rng = makeRng(seed);
  return Array.from({ length: count }, () => ({
    x: rng() * width,
    y: rng() * height,
    r: 0.4 + rng() * 1.1,
    twinkle: rng() * Math.PI * 2,
  }));
}

/** Trailing window for the event-rate computation (ms). */
export const EVENT_RATE_WINDOW_MS = 120_000;

/**
 * HUD telemetry: per-stage counts/fractions, review aggregation (approved / changes_requested
 * among finished nodes) and the "spec score" = share of finished nodes that passed tests AND got
 * an approving review. Event rate = events in the trailing window per minute.
 */
export function computeTelemetry(nodes: SwarmNode[], events: SwarmEvent[], nowMs = Date.now()): SwarmTelemetry {
  const total = nodes.length;
  const counts = new Map<StageKey, number>();
  for (const key of STAGE_ORDER) counts.set(key, 0);
  for (const n of nodes) {
    if (n.phase !== 'blocked') counts.set(n.phase, (counts.get(n.phase) ?? 0) + 1);
  }

  const stages: StageStat[] = STAGE_ORDER.map((key) => ({
    key,
    count: counts.get(key) ?? 0,
    fraction: total ? (counts.get(key) ?? 0) / total : 0,
  }));

  const finished = nodes.filter((n) => n.phase === 'merged');
  const testsOk = finished.filter((n) => n.testsPassed === true).length;
  const approved = finished.filter((n) => n.reviewVerdict === 'approve').length;
  const rejected = finished.filter((n) => n.reviewVerdict === 'changes_requested').length;
  const specScore = finished.length
    ? finished.filter((n) => n.testsPassed === true && n.reviewVerdict === 'approve').length / finished.length
    : 0;

  const cutoff = nowMs - EVENT_RATE_WINDOW_MS;
  const recent = events.filter((e) => {
    const t = Date.parse(e.ts);
    return Number.isFinite(t) && t >= cutoff;
  }).length;
  const windowMin = EVENT_RATE_WINDOW_MS / 60_000;
  const spanMs = (() => {
    if (events.length < 2) return EVENT_RATE_WINDOW_MS;
    const first = Date.parse(events[0].ts);
    const last = Date.parse(events[events.length - 1].ts);
    return Number.isFinite(first) && Number.isFinite(last) && last > first ? Math.min(last - first, EVENT_RATE_WINDOW_MS) : EVENT_RATE_WINDOW_MS;
  })();

  return {
    total,
    stages,
    specScore,
    finished: finished.length,
    testsOk,
    approved,
    rejected,
    eventRatePerMin: spanMs > 0 ? (recent / (spanMs / 60_000)) : recent / windowMin,
  };
}

/** Place a full model (nodes already carry their phase); convenience wrapper around layoutNodes. */
export function placeModel(nodes: SwarmNode[], width: number, height: number): PlacedNode[] {
  return layoutNodes(nodes, width, height);
}

/** Whether an edge should animate pulse packets: downstream node is active (something is happening). */
export function edgeIsActive(nodeById: Map<string, PlacedNode>, from: string, to: string): boolean {
  const downstream = nodeById.get(to);
  if (!downstream) return false;
  return downstream.phase === 'building' || downstream.phase === 'testing' || downstream.phase === 'reviewing';
}

/** Whether an edge renders as broken: upstream is blocked/failed and downstream has not merged. */
export function edgeIsBroken(nodeById: Map<string, PlacedNode>, from: string, to: string): boolean {
  const upstream = nodeById.get(from);
  const downstream = nodeById.get(to);
  if (!upstream || !downstream) return false;
  return upstream.phase === 'blocked' && downstream.phase !== 'merged';
}
