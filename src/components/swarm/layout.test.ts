import { describe, it, expect } from 'vitest';
import {
  bezierPoint, computeDepths, computeTelemetry, edgeIsActive, edgeIsBroken, edgeRoute, entityDistance,
  layoutNodes, makeEntity, makeRng, makeStarfield, stepEntity, STAGE_ORDER,
} from './layout';
import type { SwarmEvent, SwarmNode } from './types';

function node(id: string, dependsOn: string[] = [], phase: SwarmNode['phase'] = 'waiting', extra: Partial<SwarmNode> = {}): SwarmNode {
  return { id, taskId: id, title: id, depth: 0, dependsOn, phase, attempts: 0, testsPassed: null, reviewVerdict: null, ...extra };
}

describe('computeDepths', () => {
  it('layers a DAG by longest path', () => {
    const nodes = [node('a'), node('b', ['a']), node('c', ['a']), node('d', ['b', 'c'])];
    const depth = computeDepths(nodes);
    expect(depth.get('a')).toBe(0);
    expect(depth.get('b')).toBe(1);
    expect(depth.get('c')).toBe(1);
    expect(depth.get('d')).toBe(2);
  });

  it('treats missing deps as depth 0 and terminates on cycles', () => {
    const depth = computeDepths([node('x', ['ghost']), node('y', ['z']), node('z', ['y'])]);
    expect(depth.get('x')).toBe(0);
    // Cycles are not real plans; the guarantee is that layout terminates and stays small.
    for (const d of depth.values()) {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(3);
    }
  });
});

describe('layoutNodes', () => {
  it('assigns deeper nodes a larger x and keeps all nodes inside the canvas', () => {
    const nodes = [node('a'), node('b', ['a']), node('c', ['b'])];
    const placed = layoutNodes(nodes, 1000, 600);
    const byId = new Map(placed.map((p) => [p.id, p]));
    expect(byId.get('a')!.x).toBeLessThan(byId.get('b')!.x);
    expect(byId.get('b')!.x).toBeLessThan(byId.get('c')!.x);
    for (const p of placed) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(1000);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(600);
    }
  });

  it('spreads parallel nodes of the same depth vertically without overlap', () => {
    const nodes = [node('root'), node('p1', ['root']), node('p2', ['root']), node('p3', ['root']), node('p4', ['root'])];
    const placed = layoutNodes(nodes, 1200, 600);
    const parallels = placed.filter((p) => p.id.startsWith('p'));
    expect(parallels.every((p) => p.x === parallels[0].x)).toBe(true);
    const ys = parallels.map((p) => p.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThan(20);
  });

  it('centers a single node', () => {
    const [only] = layoutNodes([node('solo')], 800, 500);
    expect(only.x).toBe(400);
    expect(only.y).toBeCloseTo(500 / 2, 0);
  });
});

describe('edgeRoute / bezierPoint', () => {
  it('produces a horizontal bezier that starts and ends at the nodes', () => {
    const from = { x: 100, y: 200 };
    const to = { x: 500, y: 300 };
    const r = edgeRoute(from, to);
    expect(bezierPoint(r, 0)).toEqual(from);
    expect(bezierPoint(r, 1)).toEqual(to);
    expect(r.c1.x).toBeGreaterThan(from.x);
    expect(r.c2.x).toBeLessThan(to.x);
  });

  it('marks broken edges', () => {
    expect(edgeRoute({ x: 0, y: 0 }, { x: 10, y: 10 }, true).broken).toBe(true);
  });

  it('routes right-to-left edges with flipped control points', () => {
    const r = edgeRoute({ x: 500, y: 100 }, { x: 100, y: 100 });
    expect(r.c1.x).toBeLessThan(500);
    expect(r.c2.x).toBeGreaterThan(100);
  });
});

describe('edge activity', () => {
  const placed = layoutNodes([
    node('dep', [], 'merged'),
    node('active', ['dep'], 'testing'),
    node('calm', ['dep'], 'waiting'),
    node('broken', [], 'blocked'),
    node('stuck', ['broken'], 'waiting'),
  ], 1000, 600);
  const byId = new Map(placed.map((p) => [p.id, p]));

  it('pulses edges into active downstream nodes only', () => {
    expect(edgeIsActive(byId, 'dep', 'active')).toBe(true);
    expect(edgeIsActive(byId, 'dep', 'calm')).toBe(false);
  });

  it('marks edges out of blocked nodes as broken until merged', () => {
    expect(edgeIsBroken(byId, 'broken', 'stuck')).toBe(true);
    expect(edgeIsBroken(byId, 'dep', 'active')).toBe(false);
  });
});

describe('stepEntity', () => {
  it('approaches the target monotonically and snaps on arrival', () => {
    const target = { x: 800, y: 400 };
    let e = makeEntity('n', { x: 0, y: 0 });
    let prev = entityDistance(e, target);
    for (let i = 0; i < 200; i++) {
      e = stepEntity(e, target, 16);
      const d = entityDistance(e, target);
      expect(d).toBeLessThanOrEqual(prev + 1e-9);
      prev = d;
    }
    expect(e.x).toBeCloseTo(target.x, 5);
    expect(e.y).toBeCloseTo(target.y, 5);
  });

  it('does not overshoot when starting close to the target', () => {
    const target = { x: 100.2, y: 100.1 };
    const e = stepEntity(makeEntity('n', { x: 100, y: 100 }), target, 500);
    expect(entityDistance(e, target)).toBeLessThanOrEqual(0.5);
  });
});

describe('starfield / rng', () => {
  it('is deterministic for a given seed', () => {
    const a = makeStarfield(42, 20, 800, 600);
    const b = makeStarfield(42, 20, 800, 600);
    expect(a).toEqual(b);
    const rng1 = makeRng(7);
    const rng2 = makeRng(7);
    expect([rng1(), rng1(), rng1()]).toEqual([rng2(), rng2(), rng2()]);
  });

  it('stays within bounds', () => {
    for (const s of makeStarfield(1, 50, 640, 480)) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(640);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(480);
    }
  });
});

describe('computeTelemetry', () => {
  const now = Date.parse('2026-10-07T12:00:00Z');
  const ev = (id: number, ts: string): SwarmEvent => ({ id, ts, kind: 'status', nodeId: null, nodeTitle: null });

  it('counts stages and computes fractions', () => {
    const nodes = [
      node('a', [], 'merged', { testsPassed: true, reviewVerdict: 'approve' }),
      node('b', [], 'merged', { testsPassed: true, reviewVerdict: 'changes_requested' }),
      node('c', [], 'building'),
      node('d', [], 'testing'),
    ];
    const tel = computeTelemetry(nodes, [], now);
    expect(tel.total).toBe(4);
    expect(tel.stages.map((s) => s.key)).toEqual(STAGE_ORDER);
    const byKey = new Map(tel.stages.map((s) => [s.key, s]));
    expect(byKey.get('merged')!.count).toBe(2);
    expect(byKey.get('merged')!.fraction).toBe(0.5);
    expect(byKey.get('building')!.count).toBe(1);
    expect(byKey.get('waiting')!.count).toBe(0);
  });

  it('aggregates reviews and the spec score over finished nodes', () => {
    const nodes = [
      node('a', [], 'merged', { testsPassed: true, reviewVerdict: 'approve' }),
      node('b', [], 'merged', { testsPassed: false, reviewVerdict: 'approve' }),
      node('c', [], 'merged', { testsPassed: true, reviewVerdict: 'changes_requested' }),
      node('d', [], 'building', { testsPassed: true, reviewVerdict: 'approve' }),
    ];
    const tel = computeTelemetry(nodes, [], now);
    expect(tel.finished).toBe(3);
    expect(tel.testsOk).toBe(2);
    expect(tel.approved).toBe(2);
    expect(tel.rejected).toBe(1);
    expect(tel.specScore).toBeCloseTo(1 / 3);
  });

  it('is 0 when nothing has finished', () => {
    const tel = computeTelemetry([node('a', [], 'building')], [], now);
    expect(tel.specScore).toBe(0);
    expect(tel.finished).toBe(0);
  });

  it('measures the event rate per minute over the trailing window', () => {
    const recent = Array.from({ length: 6 }, (_, i) => ev(i, '2026-10-07T11:59:30Z'));
    const old = Array.from({ length: 4 }, (_, i) => ev(100 + i, '2026-10-07T11:30:00Z'));
    const tel = computeTelemetry([node('a')], [...old, ...recent], now);
    expect(tel.eventRatePerMin).toBeGreaterThan(0);
    // Old events outside the window are excluded: with a full window, 6 events / 2 min = 3/min.
    expect(tel.eventRatePerMin).toBeLessThanOrEqual(3.01);
  });
});
