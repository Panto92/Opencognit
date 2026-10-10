// Input model for the Swarm view ("WarRoom 2.0"): a normalized, renderer-agnostic description of
// the company's live task swarm — node phases on the pipeline, dependency edges, recent events and
// HUD telemetry. Produced from tasks + activity + agents (see useTaskSwarm.ts); the pure layout
// and telemetry math lives in layout.ts.

/** Pipeline phase of a plan node, derived from node state + task status. */
export type SwarmPhase =
  | 'waiting'
  | 'building'   // worker agent is coding
  | 'testing'
  | 'reviewing'  // independent reviewer (another vendor) checks the diff
  | 'needs_you'
  | 'merged'
  | 'blocked';

export type ReviewVerdict = 'approve' | 'changes_requested' | 'unknown' | null;

export interface SwarmNode {
  id: string;
  /** Plan-task id of the running task, null while the node never started. */
  taskId: string | null;
  title: string;
  /** Layer in the DAG (0 = no dependencies). */
  depth: number;
  dependsOn: string[];
  phase: SwarmPhase;
  attempts: number;
  testsPassed: boolean | null;
  reviewVerdict: ReviewVerdict;
}

export interface SwarmEdge {
  from: string;
  to: string;
}

export interface SwarmEvent {
  id: number;
  ts: string;
  kind: string;
  nodeId: string | null;
  nodeTitle: string | null;
}

export type StageKey = 'waiting' | 'building' | 'testing' | 'reviewing' | 'needs_you' | 'merged';

export interface StageStat {
  key: StageKey;
  count: number;
  /** count / total nodes, 0..1 */
  fraction: number;
}

export interface SwarmTelemetry {
  total: number;
  stages: StageStat[];
  /** Share of finished nodes with tests passed + approved review, 0..1 (0 when nothing finished). */
  specScore: number;
  finished: number;
  testsOk: number;
  approved: number;
  rejected: number;
  /** Plan activity events per minute over the trailing window. */
  eventRatePerMin: number;
}

export interface SwarmModel {
  planId: string;
  title: string;
  updatedAt: string;
  running: boolean;
  nodes: SwarmNode[];
  edges: SwarmEdge[];
  events: SwarmEvent[];
  telemetry: SwarmTelemetry;
}

export interface Point {
  x: number;
  y: number;
}

/** A positioned node on the canvas. */
export interface PlacedNode extends SwarmNode {
  x: number;
  y: number;
}
