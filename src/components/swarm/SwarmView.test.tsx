import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { render } from '@/test/render'
import type { Aktivitaet, Aufgabe } from '@/api/types'
import { computeTelemetry } from './layout'
import { parseBlockedBy, phaseOfStatus, tasksToSwarmModel } from './useTaskSwarm'
import { SwarmView } from './SwarmView'
import type { SwarmModel, SwarmNode } from './types'

// jsdom has no Canvas 2D implementation: getContext returns null (which SwarmView must survive)
// or, where we stub it, a minimal no-op stand-in so the draw loop can be exercised.

function ctxStub(): CanvasRenderingContext2D {
  const noop = () => {};
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get: (t, prop) => (typeof prop === 'string' && prop in t ? t[prop] : noop),
    set: (t, prop, value) => { if (typeof prop === 'string') t[prop] = value; return true },
  }) as unknown as CanvasRenderingContext2D;
}

function stubCanvas() {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(ctxStub()) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  return () => { HTMLCanvasElement.prototype.getContext = original; };
}

function task(id: string, status: Aufgabe['status'], blockedBy: string | null = null): Aufgabe {
  return {
    id, unternehmenId: 'co-1', titel: `Task ${id}`, beschreibung: null, status,
    prioritaet: 'medium', zugewiesenAn: null, erstelltVon: 'board', parentId: null,
    projektId: null, zielId: null, executionRunId: null, executionAgentNameKey: null,
    executionLockedAt: null, isMaximizerMode: false, blockedBy, dueDate: null,
    gestartetAm: null, abgeschlossenAm: null,
    erstelltAm: '2026-10-07T10:00:00Z', aktualisiertAm: '2026-10-07T12:00:00Z',
  };
}

function activityEntry(id: string, aktion: string, entitaetId: string): Aktivitaet {
  return {
    id, unternehmenId: 'co-1', akteurTyp: 'agent', akteurId: 'a1', akteurName: 'Agent A',
    aktion, entitaetTyp: 'aufgabe', entitaetId, details: null, erstelltAm: '2026-10-07T11:59:50Z',
  };
}

function fakeTasks(): Aufgabe[] {
  return [
    task('n1', 'done'),
    task('n2', 'in_review', JSON.stringify(['n1'])),
    task('n3', 'in_progress', JSON.stringify(['n1'])),
    task('n4', 'todo', JSON.stringify(['n2', 'n3'])),
  ];
}

function makeModel(): SwarmModel {
  const m = tasksToSwarmModel('co-1', 'Test GmbH', fakeTasks(), [
    activityEntry('e1', 'hat Aufgabe „Task n2“ abgeschlossen', 'n2'),
    activityEntry('e2', 'Fehler bei Aufgabe „Task n3“', 'n3'),
  ]);
  // Simulate a backend with test/review signals on the finished node.
  const nodes: SwarmNode[] = m.nodes.map((n) =>
    n.id === 'n1' ? { ...n, testsPassed: true, reviewVerdict: 'approve' as const } : n);
  return { ...m, nodes, telemetry: computeTelemetry(nodes, m.events) };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('tasksToSwarmModel (normalization)', () => {
  it('maps task status onto swarm phases', () => {
    expect(phaseOfStatus('backlog')).toBe('waiting');
    expect(phaseOfStatus('todo')).toBe('waiting');
    expect(phaseOfStatus('in_progress')).toBe('building');
    expect(phaseOfStatus('in_review')).toBe('reviewing');
    expect(phaseOfStatus('blocked')).toBe('needs_you');
    expect(phaseOfStatus('done')).toBe('merged');
    expect(phaseOfStatus('cancelled')).toBe('blocked');

    const m = tasksToSwarmModel('co-1', 'Test GmbH', fakeTasks(), []);
    const byId = new Map(m.nodes.map((n) => [n.id, n]));
    expect(byId.get('n1')!.phase).toBe('merged');
    expect(byId.get('n2')!.phase).toBe('reviewing');
    expect(byId.get('n3')!.phase).toBe('building');
    expect(byId.get('n4')!.phase).toBe('waiting');
  });

  it('parses blockedBy in all its shapes', () => {
    expect(parseBlockedBy(null)).toEqual([]);
    expect(parseBlockedBy(['a', 'b'])).toEqual(['a', 'b']);
    expect(parseBlockedBy('["a","b"]')).toEqual(['a', 'b']);
    expect(parseBlockedBy('single-id')).toEqual(['single-id']);
  });

  it('builds edges from blockedBy and derives telemetry', () => {
    const m = tasksToSwarmModel('co-1', 'Test GmbH', fakeTasks(), []);
    expect(m.edges).toContainEqual({ from: 'n1', to: 'n2' });
    expect(m.edges).toContainEqual({ from: 'n2', to: 'n4' });
    expect(m.edges).toContainEqual({ from: 'n3', to: 'n4' });
    expect(m.telemetry.total).toBe(4);
    expect(m.telemetry.stages.find((s) => s.key === 'merged')!.count).toBe(1);
    expect(m.running).toBe(true);
    expect(m.title).toBe('Test GmbH');
  });

  it('maps activity entries onto event-log rows with resolved task titles', () => {
    const m = makeModel();
    expect(m.events.length).toBe(2);
    expect(m.events[0].kind).toBe('approved');
    expect(m.events[0].nodeTitle).toBe('Task n2');
    expect(m.events[1].kind).toBe('error');
  });
});

describe('SwarmView', () => {
  it('renders the HUD and does not crash with a stubbed canvas context', () => {
    const restore = stubCanvas();
    try {
      render(<SwarmView model={makeModel()} />);
      expect(screen.getByTestId('swarm-view')).toBeInTheDocument();
      expect(screen.getByText('Spec score')).toBeInTheDocument();
      expect(screen.getByText('Pipeline')).toBeInTheDocument();
      expect(screen.getByText('Event log')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument(); // one merged node, tests + review green
    } finally {
      restore();
    }
  });

  it('shows the spec-score placeholder when no test/review signal exists', () => {
    render(<SwarmView model={tasksToSwarmModel('co-1', 'Test GmbH', fakeTasks(), [])} />);
    expect(screen.getByTestId('swarm-view')).toBeInTheDocument();
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
  });

  it('shows the empty hint when there is no model', () => {
    render(<SwarmView model={null} loading={false} />);
    expect(screen.getByTestId('swarm-view')).toBeInTheDocument();
    expect(screen.getByText(/watch the swarm/i)).toBeInTheDocument();
  });

  it('cancels the animation frame loop on unmount', () => {
    const restore = stubCanvas();
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 99 as unknown as number);
    try {
      const { unmount } = render(<SwarmView model={makeModel()} />);
      expect(screen.getByTestId('swarm-view')).toBeInTheDocument();
      expect(raf).toHaveBeenCalled();
      unmount();
      expect(cancel).toHaveBeenCalledWith(99);
    } finally {
      restore();
    }
  });

  it('routes canvas mouse events through the click contract without crashing', () => {
    const restore = stubCanvas();
    const onNodeClick = vi.fn();
    try {
      render(<SwarmView model={makeModel()} onNodeClick={onNodeClick} />);
      const canvas = screen.getByLabelText(/swarm view/i);
      fireEvent.mouseMove(canvas, { clientX: 50, clientY: 50 });
      fireEvent.click(canvas, { clientX: 50, clientY: 50 });
      // jsdom reports a 0-sized canvas, so no node is hit — but the wiring must not throw
      // and must not invent clicks.
      expect(onNodeClick).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });
});
