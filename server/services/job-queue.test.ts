import { describe, it, expect, beforeEach } from 'vitest';
import { createJobQueue, resetQueue, type JobQueue } from './job-queue.js';

describe('Job Queue — MemoryQueue', () => {
  let queue: JobQueue;

  beforeEach(async () => {
    const originalRedisUrl = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    await resetQueue();
    queue = await createJobQueue();
    process.env.REDIS_URL = originalRedisUrl;
  });

  it('enqueues and processes a job', async () => {
    const processed: string[] = [];

    const listener = queue.listen(async (job) => {
      processed.push(job.agentId);
    });

    const id = await queue.enqueue({
      type: 'heartbeat',
      agentId: 'agent-1',
      companyId: 'comp-1',
      payload: { test: true },
    });

    expect(id).toBeTruthy();

    await new Promise((r) => setTimeout(r, 100));
    expect(processed).toContain('agent-1');

    await queue.stop();
    await listener;
  });

  it('respects priority ordering', async () => {
    const order: number[] = [];

    // Enqueue all jobs before starting listener
    await queue.enqueue({ type: 'heartbeat', agentId: 'a', companyId: 'c', priority: 3 });
    await queue.enqueue({ type: 'heartbeat', agentId: 'b', companyId: 'c', priority: 1 });
    await queue.enqueue({ type: 'heartbeat', agentId: 'c', companyId: 'c', priority: 2 });

    const listener = queue.listen(async (job) => {
      order.push(job.priority);
    });

    await new Promise((r) => setTimeout(r, 200));
    expect(order).toEqual([1, 2, 3]);

    await queue.stop();
    await listener;
  });

  it('retries failed jobs with exponential backoff', async () => {
    let attempts = 0;

    const listener = queue.listen(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Simulated failure');
      }
    });

    await queue.enqueue({
      type: 'heartbeat',
      agentId: 'agent-retry',
      companyId: 'comp-1',
      maxAttempts: 3,
    });

    // Initial attempt (immediate) + retry 1 (~2s) + retry 2 (~4s) = ~6.5s total
    await new Promise((r) => setTimeout(r, 8000));
    expect(attempts).toBe(3);

    await queue.stop();
    await listener;
  });

  it('dead-letters jobs after max attempts', async () => {
    let attempts = 0;

    const listener = queue.listen(async () => {
      attempts++;
      throw new Error('Permanent failure');
    });

    await queue.enqueue({
      type: 'heartbeat',
      agentId: 'agent-dl',
      companyId: 'comp-1',
      maxAttempts: 2,
    });

    // Initial attempt + retry (~2s)
    await new Promise((r) => setTimeout(r, 4000));
    expect(attempts).toBe(2);

    await queue.stop();
    await listener;
  });

  it('reports stats correctly', async () => {
    await queue.enqueue({ type: 'heartbeat', agentId: 's1', companyId: 'c' });
    await queue.enqueue({ type: 'heartbeat', agentId: 's2', companyId: 'c' });

    const stats = await queue.stats();
    expect(stats.pending).toBe(2);
    expect(stats.processing).toBe(0);
  });

  it('supports tryDequeue without blocking', async () => {
    await queue.enqueue({ type: 'heartbeat', agentId: 'td1', companyId: 'c' });

    const job = await queue.tryDequeue();
    expect(job).not.toBeNull();
    expect(job!.agentId).toBe('td1');

    const empty = await queue.tryDequeue();
    expect(empty).toBeNull();
  });

  it('stores requiredCapability on jobs', async () => {
    const id = await queue.enqueue({
      type: 'heartbeat',
      agentId: 'cap1',
      companyId: 'c',
      requiredCapability: 'claude-code',
    });
    expect(id).toBeTruthy();

    const job = await queue.tryDequeue();
    expect(job).not.toBeNull();
    expect(job!.requiredCapability).toBe('claude-code');
  });
});
