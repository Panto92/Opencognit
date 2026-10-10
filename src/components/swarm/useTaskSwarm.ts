// Adapter between the main project's task/activity API and the Swarm view's input model.
// Polls the company's tasks (2s), activity (4s) and agents (4s) via React Query and normalizes
// them into a SwarmModel — the renderer (SwarmView) stays free of API knowledge and the mapping
// is a pure, exported function (tasksToSwarmModel) so it is trivially unit-testable.
//
// Deliberate stubs: the main backend has no per-task test results or review verdicts, so
// testsPassed / reviewVerdict / attempts are null / 0 — SwarmView shows the spec-score
// placeholder instead of a percentage in that case. No data is faked.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiTasks } from '@/api/tasks';
import { apiActivity } from '@/api/activity';
import { apiAgents } from '@/api/agents';
import { queryKeys } from '@/lib/queryKeys';
import type { Aktivitaet, Aufgabe } from '@/api/types';
import { computeTelemetry } from './layout';
import type { SwarmEvent, SwarmModel, SwarmNode, SwarmPhase } from './types';

export const SWARM_TASKS_POLL_MS = 2000;
export const SWARM_ACTIVITY_POLL_MS = 4000;
const MAX_EVENTS = 12;

/** The API returns English keys alongside the German aliases — read both. */
type TaskRow = Aufgabe & { title?: string; updatedAt?: string; assignedTo?: string | null };

/** Map the main project's task status onto a swarm pipeline phase. */
export function phaseOfStatus(status: Aufgabe['status']): SwarmPhase {
  switch (status) {
    case 'backlog':
    case 'todo': return 'waiting';
    case 'in_progress': return 'building';
    case 'in_review': return 'reviewing';
    case 'blocked': return 'needs_you';
    case 'done': return 'merged';
    case 'cancelled': return 'blocked';
    default: return 'waiting';
  }
}

/** blockedBy is either an array of task ids, a JSON-encoded array string, a single id, or null. */
export function parseBlockedBy(blockedBy: unknown): string[] {
  if (!blockedBy) return [];
  if (Array.isArray(blockedBy)) return blockedBy.filter((x): x is string => typeof x === 'string');
  if (typeof blockedBy === 'string') {
    const trimmed = blockedBy.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string');
      } catch { /* fall through to single-id */ }
    }
    return [trimmed];
  }
  return [];
}

/** Classify the free-text German activity action into a swarm event kind for the HUD tone. */
function eventKindOf(aktion: string): string {
  const a = aktion.toLowerCase();
  if (/fehler|fehlgeschlagen|eskaliert|blockiert/.test(a)) return 'error';
  if (/abgeschlossen|fertig|freigegeben/.test(a)) return 'approved';
  if (/review|kritik|prüft|geprüft/.test(a)) return 'review';
  if (/erstellt|angelegt|eingestellt|gestartet/.test(a)) return 'node_state';
  return 'status';
}

/** Pure: tasks + activity → SwarmModel. Exported for tests. */
export function tasksToSwarmModel(
  companyId: string,
  companyName: string,
  tasks: Aufgabe[],
  activity: Aktivitaet[],
): SwarmModel {
  const nodes: SwarmNode[] = tasks.map((raw) => {
    const task = raw as TaskRow;
    return {
      id: task.id,
      taskId: task.id,
      title: task.titel ?? task.title ?? task.id,
      depth: 0, // filled by computeDepths via layoutNodes in the renderer
      dependsOn: parseBlockedBy(task.blockedBy),
      phase: phaseOfStatus(task.status),
      attempts: 0,
      testsPassed: null,
      reviewVerdict: null,
    };
  });
  const ids = new Set(nodes.map((n) => n.id));
  const titleById = new Map(nodes.map((n) => [n.id, n.title]));
  const events: SwarmEvent[] = activity.map((a, i) => ({
    id: i + 1,
    ts: a.erstelltAm,
    kind: eventKindOf(a.aktion),
    nodeId: a.entitaetTyp === 'aufgabe' && ids.has(a.entitaetId) ? a.entitaetId : null,
    nodeTitle: (a.entitaetTyp === 'aufgabe' ? titleById.get(a.entitaetId) : undefined) ?? a.akteurName ?? null,
  }));
  const updatedAt = tasks.reduce<string>((latest, raw) => {
    const task = raw as TaskRow;
    const ts = task.aktualisiertAm ?? task.updatedAt ?? '';
    return ts > latest ? ts : latest;
  }, '') || new Date().toISOString();
  return {
    planId: companyId,
    title: companyName,
    updatedAt,
    running: tasks.some((t) => t.status === 'in_progress' || t.status === 'in_review'),
    nodes,
    edges: nodes.flatMap((n) => n.dependsOn.filter((d) => ids.has(d)).map((from) => ({ from, to: n.id }))),
    events: events.slice(0, MAX_EVENTS),
    telemetry: computeTelemetry(nodes, events),
  };
}

export interface TaskSwarm {
  model: SwarmModel | null;
  loading: boolean;
  tasks: Aufgabe[];
}

/** Polls the active company's tasks/activity/agents and returns the swarm model. */
export function useTaskSwarm(companyId: string | null, companyName: string): TaskSwarm {
  const tasksQuery = useQuery({
    queryKey: queryKeys.aufgaben.liste(companyId ?? ''),
    queryFn: () => apiTasks.liste(companyId!),
    enabled: !!companyId,
    refetchInterval: SWARM_TASKS_POLL_MS,
  });
  const activityQuery = useQuery({
    queryKey: [...queryKeys.aktivitaet.liste(companyId ?? ''), 'swarm'],
    queryFn: () => apiActivity.liste(companyId!, 50),
    enabled: !!companyId,
    refetchInterval: SWARM_ACTIVITY_POLL_MS,
  });
  // Agents are polled so the War Room chrome (worker dots / counts) stays fresh; they are not
  // part of the SwarmModel itself.
  useQuery({
    queryKey: queryKeys.experten.liste(companyId ?? ''),
    queryFn: () => apiAgents.liste(companyId!),
    enabled: !!companyId,
    refetchInterval: SWARM_ACTIVITY_POLL_MS,
  });

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const model = useMemo(
    () => (companyId && tasksQuery.data ? tasksToSwarmModel(companyId, companyName, tasks, activityQuery.data ?? []) : null),
    [companyId, companyName, tasks, tasksQuery.data, activityQuery.data],
  );
  return { model, loading: !!companyId && tasksQuery.isLoading, tasks };
}
