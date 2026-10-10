// Company Scope Middleware — ensures every request targeting a company
// either has a valid companyId parameter or falls under a system endpoint.
// This is a defense-in-depth layer on top of requireCompanyAccess.

import express from 'express';
import { type AuthRequest } from './auth.js';

/**
 * Extracts companyId from various request sources (params, body, query, headers).
 * Returns null if no company context is found.
 */
export function extractCompanyId(req: express.Request): string | null {
  return (
    req.params.unternehmenId ||
    req.params.companyId ||
    (req.body as any)?.companyId ||
    (req.body as any)?.unternehmenId ||
    (req.query.companyId as string | undefined) ||
    (req.query.unternehmenId as string | undefined) ||
    req.headers['x-company-id'] as string | undefined ||
    req.headers['x-unternehmen-id'] as string | undefined ||
    null
  );
}

/**
 * Middleware that validates companyId is present for routes that need it.
 * Skips validation for public/system endpoints (health, auth, webhooks).
 */
export function companyScopeMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const path = req.path;

  // Skip public and system endpoints
  const publicPaths = [
    '/health',
    '/system/status',
    '/auth/',
    '/webhooks/',
    '/agent/',
  ];
  if (publicPaths.some(p => path.startsWith(p))) {
    return next();
  }

  // Skip if companyId is already validated by requireCompanyAccess
  const authReq = req as AuthRequest;
  if (authReq.companyId || authReq.resolvedCompanyId) {
    return next();
  }

  // For /api/companies/:id/* routes, ensure companyId param exists
  const companyMatch = path.match(/^\/api\/companies\/([^/]+)/);
  if (companyMatch) {
    const companyId = companyMatch[1];
    if (!companyId || companyId === 'undefined') {
      return res.status(400).json({ error: 'Missing companyId in URL.' });
    }
    // Attach for downstream use
    authReq.companyId = companyId;
    return next();
  }

  // For other routes, try to extract companyId from body/query/headers
  const companyId = extractCompanyId(req);
  if (companyId) {
    authReq.companyId = companyId;
  }

  next();
}

/**
 * Strict variant: requires a companyId for ALL non-public routes.
 * Use this for API segments that should never be company-agnostic.
 */
export function requireCompanyScope(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  companyScopeMiddleware(req, res, () => {
    const authReq = req as AuthRequest;
    if (!authReq.companyId && !authReq.resolvedCompanyId) {
      return res.status(400).json({ error: 'Company scope required. Provide companyId in URL, body, or x-company-id header.' });
    }
    next();
  });
}
