import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adapterRegistry } from '../adapters/registry.js';

const router = Router();

function workerAuthMiddleware(req: any, res: any, next: any) {
  const id = req.headers['x-worker-id'] as string;
  const token = req.headers['x-worker-token'] as string;
  if (!id || !token) return res.status(401).json({ error: 'missing worker credentials' });
  import('../services/worker-pool.js').then(({ authenticateWorker }) => {
    if (!authenticateWorker(id, token)) return res.status(401).json({ error: 'invalid worker credentials' });
    req.workerId = id;
    next();
  }).catch(e => res.status(500).json({ error: e.message }));
}

router.get('/api/adapters', (_req, res) => {
  res.json({
    registered: adapterRegistry.getRegisteredAdapters(),
    plugins: adapterRegistry.getLoadedPlugins(),
  });
});

router.get('/api/workers', authMiddleware, async (_req, res) => {
  try {
    const { listWorkers } = await import('../services/worker-pool.js');
    res.json({ workers: listWorkers() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/api/workers/register', authMiddleware, async (req, res) => {
  try {
    const { name, hostname, capabilities, maxConcurrency, id } = req.body;
    if (!name || !Array.isArray(capabilities)) {
      return res.status(400).json({ error: 'name and capabilities[] required' });
    }
    const { registerWorker } = await import('../services/worker-pool.js');
    const w = registerWorker({ name, hostname, capabilities, maxConcurrency, id });
    res.json(w);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/api/workers/:id/disable', authMiddleware, async (req, res) => {
  try {
    const { disableWorker } = await import('../services/worker-pool.js');
    disableWorker(req.params.id as string);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/api/worker/heartbeat', workerAuthMiddleware, async (req: any, res) => {
  try {
    const { heartbeat } = await import('../services/worker-pool.js');
    res.json(heartbeat(req.workerId));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/api/worker/claim', workerAuthMiddleware, async (req: any, res) => {
  try {
    const { claimWork } = await import('../services/worker-pool.js');
    const capability = (req.body?.capability as string) || null;
    const claim = claimWork(req.workerId, capability);
    if (!claim) return res.json({ claim: null });
    res.json({ claim });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/api/worker/submit', workerAuthMiddleware, async (req: any, res) => {
  try {
    const { wakeupId, success, error } = req.body;
    if (!wakeupId) return res.status(400).json({ error: 'wakeupId required' });
    const { submitResult } = await import('../services/worker-pool.js');
    res.json(submitResult(req.workerId, wakeupId, !!success, error));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── Queue-based claim (for remote workers without direct Redis access) ───────

router.get('/api/worker/queue-claim', workerAuthMiddleware, async (req: any, res) => {
  try {
    const { getJobQueue } = await import('../services/job-queue.js');
    const { recordQueueRunStart, recordQueueRunEnd } = await import('../services/worker-pool.js');
    const queue = getJobQueue();

    // Non-blocking peek at the queue
    const job = await queue.tryDequeue();
    if (!job) {
      return res.json({ claim: null });
    }

    // Verify worker can execute this job
    const { getWorkerCapabilities } = await import('../services/worker-pool.js');
    const caps = getWorkerCapabilities(req.workerId);
    const canExecute = !job.requiredCapability || caps.includes('*') || caps.includes(job.requiredCapability);

    if (!canExecute) {
      // Put it back — another worker should handle it
      await queue.enqueue({
        type: job.type,
        agentId: job.agentId,
        companyId: job.companyId,
        payload: job.payload,
        priority: job.priority,
        maxAttempts: job.maxAttempts,
        requiredCapability: job.requiredCapability,
      });
      return res.json({ claim: null, reason: 'capability_mismatch' });
    }

    // Record that this worker took a queue job
    const ok = recordQueueRunStart(req.workerId);
    if (!ok) {
      // Worker at max concurrency — put job back
      await queue.enqueue({
        type: job.type,
        agentId: job.agentId,
        companyId: job.companyId,
        payload: job.payload,
        priority: job.priority,
        maxAttempts: job.maxAttempts,
        requiredCapability: job.requiredCapability,
      });
      return res.json({ claim: null, reason: 'at_capacity' });
    }

    res.json({
      claim: {
        jobId: job.id,
        agentId: job.agentId,
        companyId: job.companyId,
        type: job.type,
        payload: job.payload,
        requiredCapability: job.requiredCapability,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/worker/queue-complete', workerAuthMiddleware, async (req: any, res) => {
  try {
    const { jobId, success } = req.body;
    if (!jobId) return res.status(400).json({ error: 'jobId required' });

    const { getJobQueue } = await import('../services/job-queue.js');
    const { recordQueueRunEnd } = await import('../services/worker-pool.js');
    const queue = getJobQueue();

    await queue.complete(jobId);
    recordQueueRunEnd(req.workerId, !!success);

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Worker details ───────────────────────────────────────────────────────────

router.get('/api/workers/:id', authMiddleware, async (req, res) => {
  try {
    const { listWorkers } = await import('../services/worker-pool.js');
    const workers = listWorkers();
    const worker = workers.find((w: any) => w.id === req.params.id);
    if (!worker) return res.status(404).json({ error: 'worker not found' });
    res.json(worker);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/api/workers/:id/capabilities', authMiddleware, async (req, res) => {
  try {
    const { getWorkerCapabilities } = await import('../services/worker-pool.js');
    res.json({ capabilities: getWorkerCapabilities(req.params.id) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
