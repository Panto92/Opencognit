// Audit Logging Service — records security-relevant events for compliance and debugging.
// Uses the existing activityLog table (schema: companyId, actorType, actorId, actorName, action, entityType, entityId, details, createdAt).

import { db } from '../db/client.js';
import { type AuthRequest } from '../middleware/auth.js';
import { activityLog } from '../db/schema.js';
import { v4 as uuid } from 'uuid';
import express from 'express';

export interface AuditEvent {
  companyId: string;
  actorType: 'user' | 'agent' | 'system' | 'anonymous';
  actorId: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}

export async function logAudit(event: AuditEvent): Promise<void> {
  try {
    await db.insert(activityLog).values({
      id: uuid(),
      companyId: event.companyId,
      actorType: event.actorType as any,
      actorId: event.actorId,
      actorName: event.actorName || event.actorId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      details: event.details ? JSON.stringify(event.details) : null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // Audit logging must never crash the main operation
    console.error('[audit] Failed to write audit log:', err);
  }
}

// Express middleware that logs state-changing requests automatically
export function auditMiddleware(
  opts: { actions: Record<string, { entityType: string; action: string }>; skip?: string[] } = { actions: {} }
) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const start = Date.now();
    const userId = (req as AuthRequest).users?.userId || (req as AuthRequest).agentContext?.agentId || 'anonymous';
    const userName = (req as AuthRequest).users?.email || (req as AuthRequest).agentContext?.agentId || 'anonymous';
    const companyId = (req as AuthRequest).companyId || (req as AuthRequest).agentContext?.companyId || 'system';

    // Only log POST/PUT/DELETE
    const method = req.method;
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next();
    }

    // Skip health checks and webhooks
    const path = req.path;
    if (path.includes('/health') || path.includes('/webhooks') || opts.skip?.some(s => path.includes(s))) {
      return next();
    }

    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;

      // Determine action from path
      const actionKey = `${method} ${path}`;
      const config = opts.actions[path] || { entityType: 'api', action: `${method} ${path}` };

      // Don't log successful reads (already filtered by method, but double-check)
      if (status >= 400) {
        logAudit({
          companyId,
          actorType: userId === 'anonymous' ? 'anonymous' : 'user',
          actorId: userId,
          actorName: userName,
          action: status >= 500 ? 'api_error' : 'api_rejected',
          entityType: config.entityType,
          entityId: req.params.id || req.params.companyId || path,
          details: {
            path,
            method,
            status,
            durationMs: duration,
            bodyKeys: Object.keys(req.body || {}),
          },
        });
      }
    });

    next();
  };
}

// Specific audit helpers for common security events
export async function logLogin(companyId: string, userId: string, email: string, success: boolean, ip?: string): Promise<void> {
  await logAudit({
    companyId,
    actorType: 'user',
    actorId: userId,
    actorName: email,
    action: success ? 'login_success' : 'login_failed',
    entityType: 'session',
    entityId: userId,
    details: { ip, success },
  });
}

export async function logPasswordChange(companyId: string, userId: string, email: string): Promise<void> {
  await logAudit({
    companyId,
    actorType: 'user',
    actorId: userId,
    actorName: email,
    action: 'password_changed',
    entityType: 'user',
    entityId: userId,
  });
}

export async function logPermissionDenied(companyId: string, userId: string, resource: string, action: string): Promise<void> {
  await logAudit({
    companyId,
    actorType: 'user',
    actorId: userId,
    actorName: userId,
    action: 'permission_denied',
    entityType: resource,
    entityId: action,
    details: { resource, action },
  });
}
