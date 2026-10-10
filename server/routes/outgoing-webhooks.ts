// Outgoing Webhook Management Routes
// CRUD for webhook subscriptions stored in the settings table.

import { Router } from 'express';
import crypto from 'crypto';
import { authMiddleware, requireCompanyAccess } from '../middleware/auth.js';
import { loadWebhooks, saveWebhooks, dispatchEvent, type WebhookConfig } from '../services/outgoing-webhooks.js';

const router = Router();

router.get('/api/outgoing-webhooks', authMiddleware, requireCompanyAccess(), (req: any, res) => {
  try {
    const companyId = req.companyId as string || '';
    const configs = loadWebhooks(companyId);
    // Don't return secrets
    const safe = configs.map((c) => ({
      id: c.id,
      url: c.url,
      events: c.events,
      active: c.active,
      createdAt: c.createdAt,
    }));
    res.json({ webhooks: safe });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/outgoing-webhooks', authMiddleware, requireCompanyAccess(['owner', 'admin']), (req: any, res) => {
  try {
    const companyId = req.companyId as string || '';
    const { url, events, secret } = req.body;

    if (!url || !Array.isArray(events)) {
      return res.status(400).json({ error: 'url and events[] required' });
    }

    const configs = loadWebhooks(companyId);
    const newConfig: WebhookConfig = {
      id: crypto.randomUUID(),
      url,
      events,
      secret: secret || crypto.randomBytes(32).toString('hex'),
      active: true,
      createdAt: new Date().toISOString(),
    };

    configs.push(newConfig);
    saveWebhooks(companyId, configs);

    res.json({
      id: newConfig.id,
      url: newConfig.url,
      events: newConfig.events,
      active: newConfig.active,
      createdAt: newConfig.createdAt,
      secret: newConfig.secret, // shown once
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/api/outgoing-webhooks/:id', authMiddleware, requireCompanyAccess(['owner', 'admin']), (req: any, res) => {
  try {
    const companyId = req.companyId as string || '';
    const configs = loadWebhooks(companyId);
    const filtered = configs.filter((c) => c.id !== req.params.id);
    if (filtered.length === configs.length) {
      return res.status(404).json({ error: 'webhook not found' });
    }
    saveWebhooks(companyId, filtered);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/api/outgoing-webhooks/:id', authMiddleware, requireCompanyAccess(['owner', 'admin']), (req: any, res) => {
  try {
    const companyId = req.companyId as string || '';
    const configs = loadWebhooks(companyId);
    const idx = configs.findIndex((c) => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'webhook not found' });

    const { active, events, url } = req.body;
    if (active !== undefined) configs[idx].active = !!active;
    if (events !== undefined) configs[idx].events = events;
    if (url !== undefined) configs[idx].url = url;

    saveWebhooks(companyId, configs);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/outgoing-webhooks/:id/test', authMiddleware, requireCompanyAccess(['owner', 'admin']), (req: any, res) => {
  try {
    const companyId = req.companyId as string || '';
    const configs = loadWebhooks(companyId);
    const config = configs.find((c) => c.id === req.params.id);
    if (!config) return res.status(404).json({ error: 'webhook not found' });

    dispatchEvent('webhook.test', companyId, {
      message: 'This is a test event from OpenCognit',
      webhookId: config.id,
      triggeredBy: req.user?.id || 'unknown',
    });

    res.json({ ok: true, message: 'Test event dispatched' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
