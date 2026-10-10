// In-Memory Rate Limiter — for production, replace with Redis-backed limiter
// Tracks requests per IP per window. Cleans up expired entries periodically.

export interface RateLimitOptions {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  message?: string;
}

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();

// Cleanup expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 60000);

export function rateLimit(opts: RateLimitOptions) {
  const { windowMs, maxRequests, message = 'Too many requests. Please try again later.' } = opts;

  return (req: any, res: any, next: any) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${ip}:${req.path}`;
    const now = Date.now();

    const entry = store.get(key);
    if (!entry || entry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: message });
    }

    next();
  };
}

// ── Per-Company Rate Limiter ────────────────────────────────────────────────
// Prevents one noisy tenant from exhausting server resources.

interface CompanyEntry {
  count: number;
  resetAt: number;
}

const companyStore = new Map<string, CompanyEntry>();

// Cleanup expired company entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of companyStore) {
    if (entry.resetAt <= now) companyStore.delete(key);
  }
}, 60000);

export interface CompanyRateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

export function companyRateLimit(opts: CompanyRateLimitOptions) {
  const { windowMs, maxRequests, message = 'Tenant rate limit exceeded. Please slow down.' } = opts;

  return (req: any, res: any, next: any) => {
    const companyId = req.companyId || req.headers['x-company-id'] || (req as any).companyMembership?.companyId;
    if (!companyId) {
      // No company context — fall through (e.g. system endpoints)
      return next();
    }

    const key = `company:${companyId}`;
    const now = Date.now();

    const entry = companyStore.get(key);
    if (!entry || entry.resetAt <= now) {
      companyStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', '0');
      return res.status(429).json({ error: message, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) });
    }

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - entry.count)));
    next();
  };
}

// Pre-configured limiters for common use cases
export const strictLimiter = rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 5 });
export const standardLimiter = rateLimit({ windowMs: 60 * 1000, maxRequests: 60 });
export const apiRateLimit = rateLimit({ windowMs: 60 * 1000, maxRequests: 120 });

// Per-tenant limiter: 500 requests/minute per company (generous for most use cases)
export const tenantRateLimit = companyRateLimit({ windowMs: 60 * 1000, maxRequests: 500 });
