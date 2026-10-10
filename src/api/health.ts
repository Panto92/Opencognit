import { request } from './core';

export const apiHealth = {
  check: () => request<{ status: string; version: string; name: string }>('/health'),
};

export interface TelemetryData {
  agents: Record<string, number>;
  tasks: Record<string, number>;
  runs24h: Record<string, number>;
  costs24h: { totalCent: number; count: number };
  wakeupBacklog: number;
  requests: {
    totalRequests: number;
    errorRate: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    requestsPerMinute: number;
    statusBreakdown: Record<string, number>;
    topPaths: Array<{ path: string; count: number; avgLatencyMs: number }>;
  };
  queue: { pending: number; processing: number; initialized: boolean };
  uptimeSeconds: number;
  timestamp: string;
}

export const apiTelemetry = {
  get: () => request<TelemetryData>('/system/telemetry'),
};
