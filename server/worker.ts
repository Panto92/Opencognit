// Standalone Worker Process for OpenCognit
// Usage: npx tsx server/worker.ts
// Connects to the same database and Redis queue as the main server.
// Designed for horizontal scaling: run multiple worker processes
// across multiple machines, all pulling from the same Redis queue.
//
// Environment variables:
//   DATABASE_URL      — PostgreSQL connection string (optional; defaults to SQLite)
//   REDIS_URL         — Redis connection string (optional; defaults to in-memory queue)
//   WORKER_ID         — Existing worker node ID for remote authentication
//   WORKER_TOKEN      — Shared secret token for remote authentication
//   WORKER_CAPABILITIES — Comma-separated list (e.g. "claude-code,anthropic,bash")
//                         Omit or set to "*" for universal capability.

import { initializeDatabase } from './db/client.js';
import { createJobQueue } from './services/job-queue.js';
import { startQueueWorker, stopQueueWorker } from './services/job-queue-worker.js';

const WORKER_ID = process.env.WORKER_ID;
const WORKER_TOKEN = process.env.WORKER_TOKEN;
const WORKER_CAPABILITIES = (process.env.WORKER_CAPABILITIES || '*')
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

async function main() {
  console.log('👷 OpenCognit Worker starting...');
  console.log(`   Capabilities: [${WORKER_CAPABILITIES.join(', ')}]`);

  await initializeDatabase();

  // Remote worker authentication
  if (WORKER_ID && WORKER_TOKEN) {
    const { authenticateWorker, heartbeat } = await import('./services/worker-pool.js');
    if (!authenticateWorker(WORKER_ID, WORKER_TOKEN)) {
      console.error('❌ Invalid worker credentials — check WORKER_ID and WORKER_TOKEN');
      process.exit(1);
    }
    console.log(`🔑 Authenticated as remote worker ${WORKER_ID}`);

    // Heartbeat loop every 30s
    const heartbeatInterval = setInterval(() => {
      try {
        heartbeat(WORKER_ID);
      } catch (e: any) {
        console.warn('⚠️ Heartbeat failed:', e.message);
      }
    }, 30_000);

    // Clean up on shutdown
    process.on('SIGINT', () => clearInterval(heartbeatInterval));
    process.on('SIGTERM', () => clearInterval(heartbeatInterval));
  } else {
    console.log('   Running as local worker (no remote registry auth)');
  }

  const queue = await createJobQueue();
  await startQueueWorker(queue, WORKER_CAPABILITIES);

  console.log('👷 Worker ready. Waiting for jobs...');

  // Keep process alive
  process.stdin.resume();
}

function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down worker...`);
  stopQueueWorker()
    .then(() => {
      console.log('👷 Worker shut down gracefully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Worker shutdown error:', err);
      process.exit(1);
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection in worker:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in worker:', err);
  shutdown('uncaughtException');
});

main().catch((err) => {
  console.error('❌ Worker failed to start:', err);
  process.exit(1);
});
