// Job Queue — abstraction for heartbeat execution scheduling
// Supports in-memory (default) and Redis backends.
// Redis is lazy-loaded: install ioredis and set REDIS_URL to enable.

import { EventEmitter } from 'events';

export type JobType = 'heartbeat';

export interface QueueJob {
  id: string;
  type: JobType;
  agentId: string;
  companyId: string;
  payload: Record<string, unknown>;
  priority: number; // 1 = critical, 2 = high, 3 = normal, 4 = low
  createdAt: number;
  attempts: number;
  maxAttempts: number;
  requiredCapability?: string; // e.g. 'claude-code', 'anthropic', etc.
}

export interface EnqueueOptions {
  type: JobType;
  agentId: string;
  companyId: string;
  payload?: Record<string, unknown>;
  priority?: number;
  maxAttempts?: number;
  requiredCapability?: string;
}

export interface JobQueue {
  enqueue(options: EnqueueOptions): Promise<string>;
  listen(handler: (job: QueueJob) => Promise<void>): Promise<void>;
  tryDequeue(): Promise<QueueJob | null>;
  complete(jobId: string): Promise<void>;
  fail(jobId: string, error: string): Promise<void>;
  stats(): Promise<{ pending: number; processing: number }>;
  stop(): Promise<void>;
}

let globalQueue: JobQueue | null = null;

export async function createJobQueue(): Promise<JobQueue> {
  if (globalQueue) return globalQueue;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      globalQueue = await RedisQueue.create(redisUrl);
      console.log('📬 Redis job queue initialized');
      return globalQueue;
    } catch (e: any) {
      console.warn('⚠️ Redis queue init failed, falling back to memory:', e.message);
    }
  }

  globalQueue = new MemoryQueue();
  console.log('📬 In-memory job queue initialized');
  return globalQueue;
}

export function getJobQueue(): JobQueue {
  if (!globalQueue) {
    throw new Error('Job queue not initialized. Call createJobQueue() first.');
  }
  return globalQueue;
}

export function isQueueInitialized(): boolean {
  return globalQueue !== null;
}

export async function resetQueue(): Promise<void> {
  if (globalQueue) {
    await globalQueue.stop();
  }
  globalQueue = null;
}

// ── In-Memory Implementation ─────────────────────────────────────────────────

class MemoryQueue implements JobQueue {
  private jobs: QueueJob[] = [];
  private processing = new Set<string>();
  private jobById = new Map<string, QueueJob>();
  private emitter = new EventEmitter();
  private running = false;
  private jobIdCounter = 0;

  async enqueue(options: EnqueueOptions): Promise<string> {
    const id = `mem:${++this.jobIdCounter}:${Date.now()}`;
    const job: QueueJob = {
      id,
      type: options.type,
      agentId: options.agentId,
      companyId: options.companyId,
      payload: options.payload || {},
      priority: options.priority ?? 3,
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 3,
      requiredCapability: options.requiredCapability,
    };
    this.jobById.set(id, job);
    this.jobs.push(job);
    this.jobs.sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);
    this.emitter.emit('job');
    return id;
  }

  async listen(handler: (job: QueueJob) => Promise<void>): Promise<void> {
    this.running = true;
    while (this.running) {
      const job = this.dequeueInternal();
      if (job) {
        this.processing.add(job.id);
        try {
          await handler(job);
          await this.complete(job.id);
        } catch (e: any) {
          await this.fail(job.id, String(e.message || e));
        }
      } else {
        await this.waitForJob();
      }
    }
  }

  private dequeueInternal(): QueueJob | null {
    const job = this.jobs.shift();
    if (job) {
      this.jobById.set(job.id, job);
      return job;
    }
    return null;
  }

  async tryDequeue(): Promise<QueueJob | null> {
    return this.dequeueInternal();
  }

  private waitForJob(): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.emitter.off('job', onJob);
        resolve();
      }, 5000);
      const onJob = () => {
        clearTimeout(timer);
        this.emitter.off('job', onJob);
        resolve();
      };
      this.emitter.once('job', onJob);
    });
  }

  async complete(jobId: string): Promise<void> {
    this.processing.delete(jobId);
    this.jobById.delete(jobId);
  }

  async fail(jobId: string, error: string): Promise<void> {
    this.processing.delete(jobId);
    const job = this.jobById.get(jobId);
    if (!job) {
      console.error(`❌ Job ${jobId} failed permanently (data lost): ${error}`);
      return;
    }
    job.attempts++;
    if (job.attempts >= job.maxAttempts) {
      this.jobById.delete(jobId);
      console.error(`❌ Job ${jobId} dead-lettered after ${job.maxAttempts} attempts: ${error}`);
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, job.attempts), 30000);
    setTimeout(() => {
      if (!this.running) return;
      this.jobs.push(job);
      this.jobs.sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);
      this.emitter.emit('job');
    }, delay);
    console.warn(
      `⚠️ Job ${jobId} failed (attempt ${job.attempts}/${job.maxAttempts}), requeued with ${delay}ms delay: ${error}`
    );
  }

  async stats(): Promise<{ pending: number; processing: number }> {
    return { pending: this.jobs.length, processing: this.processing.size };
  }

  async stop(): Promise<void> {
    this.running = false;
    this.emitter.emit('job'); // Wake up listener
  }
}

// ── Redis Implementation ─────────────────────────────────────────────────────

class RedisQueue implements JobQueue {
  private redis: any; // ioredis Redis instance
  private running = false;
  private processing = new Set<string>();

  private static async loadRedis(url: string): Promise<any> {
    let Redis: any;
    try {
      const ioredis = await import('ioredis');
      Redis = ioredis.Redis;
    } catch {
      throw new Error('ioredis is not installed. Run: npm install ioredis');
    }
    const client = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
    });
    await new Promise<void>((resolve, reject) => {
      client.once('ready', resolve);
      client.once('error', reject);
      setTimeout(() => reject(new Error('Redis connection timeout')), 10000);
    });
    return client;
  }

  static async create(url: string): Promise<RedisQueue> {
    const redis = await RedisQueue.loadRedis(url);
    const queue = new RedisQueue(redis);
    redis.on('error', (err: Error) => {
      console.error('❌ Redis connection error:', err.message);
    });
    return queue;
  }

  private constructor(redis: any) {
    this.redis = redis;
  }

  private scoreFor(job: QueueJob): number {
    return job.priority * 1e12 + job.createdAt;
  }

  async enqueue(options: EnqueueOptions): Promise<string> {
    const id = `redis:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const job: QueueJob = {
      id,
      type: options.type,
      agentId: options.agentId,
      companyId: options.companyId,
      payload: options.payload || {},
      priority: options.priority ?? 3,
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 3,
      requiredCapability: options.requiredCapability,
    };
    const score = this.scoreFor(job);
    await this.redis.hset('opencognit:jobs', id, JSON.stringify(job));
    await this.redis.zadd('opencognit:queue', score, id);
    return id;
  }

  async tryDequeue(): Promise<QueueJob | null> {
    try {
      const result = await this.redis.zpopmin('opencognit:queue', 1);
      // ioredis zpopmin returns [member1, score1, member2, score2, ...]
      if (!result || result.length < 2) return null;
      const jobId = result[0];
      const jobJson = await this.redis.hget('opencognit:jobs', jobId);
      if (!jobJson) return null;
      const job: QueueJob = JSON.parse(jobJson);
      this.processing.add(job.id);
      await this.redis.zadd('opencognit:processing', this.scoreFor(job), jobId);
      return job;
    } catch (e: any) {
      console.error('❌ Redis tryDequeue error:', e.message);
      return null;
    }
  }

  async listen(handler: (job: QueueJob) => Promise<void>): Promise<void> {
    this.running = true;
    while (this.running) {
      try {
        const result = await this.redis.bzpopmin('opencognit:queue', 5);
        if (!result) continue;
        const jobId = result[1];
        const jobJson = await this.redis.hget('opencognit:jobs', jobId);
        if (!jobJson) continue;
        const job: QueueJob = JSON.parse(jobJson);

        this.processing.add(job.id);
        // Move to processing set for visibility
        await this.redis.zadd('opencognit:processing', this.scoreFor(job), jobId);

        try {
          await handler(job);
          await this.complete(jobId);
        } catch (e: any) {
          await this.fail(jobId, String(e.message || e));
        }
      } catch (e: any) {
        if (this.running) {
          console.error('❌ Redis queue listen error:', e.message);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }

  async complete(jobId: string): Promise<void> {
    this.processing.delete(jobId);
    await this.redis.zrem('opencognit:processing', jobId);
    await this.redis.hdel('opencognit:jobs', jobId);
  }

  async fail(jobId: string, error: string): Promise<void> {
    this.processing.delete(jobId);
    await this.redis.zrem('opencognit:processing', jobId);
    const jobJson = await this.redis.hget('opencognit:jobs', jobId);
    if (!jobJson) {
      console.error(`❌ Job ${jobId} failed and job data lost: ${error}`);
      return;
    }
    const job: QueueJob = JSON.parse(jobJson);
    job.attempts++;
    if (job.attempts >= job.maxAttempts) {
      await this.redis.hdel('opencognit:jobs', jobId);
      await this.redis.lpush('opencognit:deadletter', JSON.stringify({ ...job, error, failedAt: Date.now() }));
      console.error(`❌ Job ${jobId} dead-lettered after ${job.maxAttempts} attempts: ${error}`);
      return;
    }
    // Exponential backoff retry
    const delay = Math.min(1000 * Math.pow(2, job.attempts), 30000);
    const score = job.priority * 1e12 + Date.now() + delay;
    await this.redis.zadd('opencognit:queue', score, jobId);
    await this.redis.hset('opencognit:jobs', jobId, JSON.stringify(job));
    console.warn(`⚠️ Job ${jobId} failed (attempt ${job.attempts}/${job.maxAttempts}), requeued with ${delay}ms delay: ${error}`);
  }

  async stats(): Promise<{ pending: number; processing: number }> {
    const pending = await this.redis.zcard('opencognit:queue');
    return { pending, processing: this.processing.size };
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.redis.quit();
  }
}
