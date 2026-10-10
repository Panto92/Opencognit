// =============================================================================
// A2A Message Bus Routes — Agent-to-Agent messaging REST API
// =============================================================================

import { Router } from 'express';
import { z } from 'zod';
import { a2aMessageBus } from '../services/a2a-message-bus.js';
import { authMiddleware, requireResourceAccess } from '../middleware/auth.js';

const router = Router();

const sendMessageSchema = z.object({
  recipientId: z.string().optional(),
  channel: z.string().optional(),
  threadId: z.string().optional(),
  type: z.enum(['direct', 'broadcast', 'channel', 'request', 'response']).optional(),
  payload: z.object({
    text: z.string().min(1),
    metadata: z.record(z.unknown()).optional(),
    urgency: z.enum(['low', 'normal', 'high']).optional(),
  }),
  shouldWakeup: z.boolean().optional(),
});

// POST /api/agents/:id/messages — send a message from this agent
router.post('/api/agents/:id/messages', authMiddleware, requireResourceAccess('agent'), async (req, res) => {
  try {
    const senderId = req.params.id as string;
    const unternehmenId = ((req as AuthRequest).resolvedCompanyId || req.headers['x-company-id'] || req.headers['x-unternehmen-id']) as string;

    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    }

    const msg = await a2aMessageBus.sendMessage({
      companyId: unternehmenId,
      senderId,
      ...parsed.data,
    });

    res.json({ status: 'ok', message: msg });
  } catch (err: any) {
    console.error('❌ A2A sendMessage error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// GET /api/agents/:id/inbox — get agent inbox
router.get('/api/agents/:id/inbox', authMiddleware, requireResourceAccess('agent'), async (req, res) => {
  try {
    const agentId = req.params.id as string;
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const since = req.query.since as string | undefined;

    const messages = await a2aMessageBus.getInbox(agentId, { unreadOnly, limit, since });
    res.json({ status: 'ok', messages });
  } catch (err: any) {
    console.error('❌ A2A getInbox error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// GET /api/agents/:id/inbox/unread-count — fast unread count
router.get('/api/agents/:id/inbox/unread-count', authMiddleware, requireResourceAccess('agent'), async (req, res) => {
  try {
    const agentId = req.params.id as string;
    const count = await a2aMessageBus.getUnreadCount(agentId);
    res.json({ status: 'ok', count });
  } catch (err: any) {
    console.error('❌ A2A unreadCount error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// POST /api/messages/:id/read — mark message as read
router.post('/api/messages/:id/read', authMiddleware, async (req, res) => {
  try {
    const messageId = req.params.id as string;
    const changed = await a2aMessageBus.markAsRead([messageId]);
    res.json({ status: 'ok', changed });
  } catch (err: any) {
    console.error('❌ A2A markAsRead error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// POST /api/messages/read — bulk mark as read
router.post('/api/messages/read', authMiddleware, async (req, res) => {
  try {
    const { messageIds } = req.body;
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({ error: 'messageIds array required' });
    }
    const changed = await a2aMessageBus.markAsRead(messageIds);
    res.json({ status: 'ok', changed });
  } catch (err: any) {
    console.error('❌ A2A bulk markAsRead error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// GET /api/messages/thread/:threadId — get thread messages
router.get('/api/messages/thread/:threadId', authMiddleware, async (req, res) => {
  try {
    const threadId = req.params.threadId as string;
    const messages = await a2aMessageBus.getThread(threadId);
    res.json({ status: 'ok', messages });
  } catch (err: any) {
    console.error('❌ A2A getThread error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// POST /api/channels/:channel/messages — broadcast to channel
router.post('/api/channels/:channel/messages', authMiddleware, async (req, res) => {
  try {
    const channel = req.params.channel as string;
    const senderId = req.body.senderId as string;
    const payload = req.body.payload as { text: string; metadata?: Record<string, unknown>; urgency?: 'low' | 'normal' | 'high' };

    if (!senderId || !payload?.text) {
      return res.status(400).json({ error: 'senderId and payload.text required' });
    }

    const msg = await a2aMessageBus.broadcastToChannel(unternehmenId, channel, senderId, payload);
    res.json({ status: 'ok', message: msg });
  } catch (err: any) {
    console.error('❌ A2A broadcast error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// GET /api/channels/:channel/messages — get channel history
router.get('/api/channels/:channel/messages', authMiddleware, async (req, res) => {
  try {
    const channel = req.params.channel as string;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    // Query directly via service — getInbox doesn't filter by channel, so we query manually
    const { db } = await import('../db/client.js');
    const { agentMessages } = await import('../db/schema.js');
    const { eq, and, desc, sql } = await import('drizzle-orm');

    const rows = db.select().from(agentMessages)
      .where(and(eq(agentMessages.companyId, unternehmenId), eq(agentMessages.channel, channel)))
      .orderBy(desc(agentMessages.createdAt), desc(sql`rowid`))
      .limit(limit)
      .all();

    res.json({ status: 'ok', messages: rows });
  } catch (err: any) {
    console.error('❌ A2A channel history error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// POST /api/messages/:id/response — reply to a request message
router.post('/api/messages/:id/response', authMiddleware, async (req, res) => {
  try {
    const requestMessageId = req.params.id as string;
    const { senderId, payload } = req.body;

    if (!senderId || !payload?.text) {
      return res.status(400).json({ error: 'senderId and payload.text required' });
    }

    const msg = await a2aMessageBus.sendResponse(requestMessageId, senderId, payload);
    if (!msg) {
      return res.status(404).json({ error: 'Request message not found' });
    }

    res.json({ status: 'ok', message: msg });
  } catch (err: any) {
    console.error('❌ A2A sendResponse error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

export default router;
