// Runtime Metrics Service
// Collects in-memory request metrics and exposes aggregation helpers.
// No external dependencies — works in both single-node and multi-node setups.

export interface RequestMetric {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  timestamp: number;
}

export interface MetricsSnapshot {
  totalRequests: number;
  errorRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  requestsPerMinute: number;
  statusBreakdown: Record<string, number>;
  topPaths: Array<{ path: string; count: number; avgLatencyMs: number }>;
}

const MAX_RING_SIZE = 10_000;
const ONE_HOUR = 60 * 60 * 1000;

class MetricsService {
  private requests: RequestMetric[] = [];
  private startTime = Date.now();

  recordRequest(metric: Omit<RequestMetric, 'timestamp'>): void {
    this.requests.push({ ...metric, timestamp: Date.now() });
    if (this.requests.length > MAX_RING_SIZE) {
      this.requests = this.requests.slice(-MAX_RING_SIZE);
    }
  }

  getSnapshot(windowMs: number = ONE_HOUR): MetricsSnapshot {
    const cutoff = Date.now() - windowMs;
    const recent = this.requests.filter((r) => r.timestamp >= cutoff);

    if (recent.length === 0) {
      return {
        totalRequests: 0,
        errorRate: 0,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        requestsPerMinute: 0,
        statusBreakdown: {},
        topPaths: [],
      };
    }

    const latencies = recent.map((r) => r.durationMs).sort((a, b) => a - b);
    const errors = recent.filter((r) => r.statusCode >= 500);

    // Status breakdown
    const statusBreakdown: Record<string, number> = {};
    for (const r of recent) {
      const bucket = String(r.statusCode).slice(0, 1) + 'xx';
      statusBreakdown[bucket] = (statusBreakdown[bucket] || 0) + 1;
    }

    // Top paths by count
    const pathMap = new Map<string, { count: number; totalLatency: number }>();
    for (const r of recent) {
      const existing = pathMap.get(r.path);
      if (existing) {
        existing.count++;
        existing.totalLatency += r.durationMs;
      } else {
        pathMap.set(r.path, { count: 1, totalLatency: r.durationMs });
      }
    }
    const topPaths = Array.from(pathMap.entries())
      .map(([path, data]) => ({
        path,
        count: data.count,
        avgLatencyMs: Math.round(data.totalLatency / data.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const minutes = Math.max(windowMs / 60_000, 1);

    return {
      totalRequests: recent.length,
      errorRate: errors.length / recent.length,
      avgLatencyMs: Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length),
      p50LatencyMs: this.percentile(latencies, 0.5),
      p95LatencyMs: this.percentile(latencies, 0.95),
      p99LatencyMs: this.percentile(latencies, 0.99),
      requestsPerMinute: Math.round((recent.length / minutes) * 100) / 100,
      statusBreakdown,
      topPaths,
    };
  }

  getUptimeMs(): number {
    return Date.now() - this.startTime;
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, idx)];
  }
}

export const metricsService = new MetricsService();
