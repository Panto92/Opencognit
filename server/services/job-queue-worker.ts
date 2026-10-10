// Job Queue Worker — processes heartbeat jobs from the queue
// Can run in the main process or as a standalone worker process.
// Supports capability-based filtering for multi-node deployments.

import { getJobQueue, type JobQueue, type QueueJob } from './job-queue.js';
import { heartbeatService } from './heartbeat.js';

const HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class JobWorker {
  private queue: JobQueue;
  private running = false;
  private activeJobId: string | null = null;
  private capabilities: string[];
  private pendingJobs = 0;

  constructor(queue?: JobQueue, capabilities?: string[]) {
    this.queue = queue || getJobQueue();
    this.capabilities = capabilities || ['*']; // '*' means all capabilities
  }

  setCapabilities(caps: string[]) {
    this.capabilities = caps;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log('👷 Job worker started');

    await this.queue.listen(async (job) => {
      if (!this.running) return;
      this.activeJobId = job.id;
      this.pendingJobs++;
      try {
        await this.processJob(job);
      } finally {
        this.activeJobId = null;
        this.pendingJobs--;
      }
    });
  }

  async stop(maxWaitMs: number = 30_000): Promise<void> {
    if (!this.running) return;
    console.log('🛑 Stopping job worker...');
    this.running = false;
    await this.queue.stop();

    // Wait for active jobs to finish (with timeout)
    const start = Date.now();
    while (this.pendingJobs > 0 && Date.now() - start < maxWaitMs) {
      console.log(`⏳ Waiting for ${this.pendingJobs} active job(s) to finish...`);
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (this.pendingJobs > 0) {
      console.warn(`⚠️ Force-stopped worker with ${this.pendingJobs} unfinished job(s)`);
    } else {
      console.log('🛑 Job worker stopped gracefully');
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getActiveJobId(): string | null {
    return this.activeJobId;
  }

  getCapabilities(): string[] {
    return [...this.capabilities];
  }

  /**
   * Check if this worker can execute a job based on its capabilities.
   * '*' means universal capability.
   */
  private canExecute(job: QueueJob): boolean {
    if (!job.requiredCapability) return true;
    if (this.capabilities.includes('*')) return true;
    return this.capabilities.includes(job.requiredCapability);
  }

  private async processJob(job: QueueJob): Promise<void> {
    if (!this.canExecute(job)) {
      console.log(
        `⏭️ Worker skipping job ${job.id} — requires "${job.requiredCapability}", worker has [${this.capabilities.join(', ')}]`
      );
      // Signal that this worker couldn't handle it, so another worker may pick it up.
      // For MemoryQueue this re-queues immediately; for RedisQueue it stays in the sorted set
      // and another worker will eventually claim it.
      throw new Error(`CAPABILITY_MISMATCH:${job.requiredCapability}`);
    }

    switch (job.type) {
      case 'heartbeat': {
        await this.runWithTimeout(
          heartbeatService.processPendingWakeups(job.agentId),
          HEARTBEAT_TIMEOUT_MS,
          `Heartbeat for agent ${job.agentId}`
        );
        break;
      }
      default: {
        console.warn(`⚠️ Unknown job type: ${(job as any).type}`);
        throw new Error(`Unknown job type: ${(job as any).type}`);
      }
    }
  }

  private async runWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}

let globalWorker: JobWorker | null = null;

export async function startQueueWorker(queue?: JobQueue, capabilities?: string[]): Promise<JobWorker> {
  if (globalWorker?.isRunning()) return globalWorker;
  globalWorker = new JobWorker(queue, capabilities);
  // Start in background so server boot is not blocked
  globalWorker.start().catch((err) => {
    console.error('❌ Job worker crashed:', err);
  });
  return globalWorker;
}

export async function stopQueueWorker(): Promise<void> {
  if (globalWorker) {
    await globalWorker.stop();
    globalWorker = null;
  }
}

export function getActiveWorkerJobId(): string | null {
  return globalWorker?.getActiveJobId() ?? null;
}
