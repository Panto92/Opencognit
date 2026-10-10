// Request Tracing Middleware
// Attaches / propagates X-Request-ID and logs every request with latency.

import crypto from 'crypto';
import { logger } from '../services/logger.js';
import { metricsService } from '../services/metrics.js';

export function traceMiddleware(req: any, res: any, next: any): void {
  const requestId =
    req.headers['x-request-id'] ||
    req.headers['x-correlation-id'] ||
    crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    metricsService.recordRequest({
      method: req.method,
      path: req.path || req.url,
      statusCode,
      durationMs: duration,
    });

    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const message = `${req.method} ${req.path || req.url} → ${statusCode} (${duration}ms)`;
    const context = {
      requestId,
      method: req.method,
      path: req.path || req.url,
      statusCode,
      durationMs: duration,
      userAgent: req.headers['user-agent'],
    };

    logger[level](message, context);
  });

  next();
}
