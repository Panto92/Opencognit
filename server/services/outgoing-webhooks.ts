// Outgoing Webhook Dispatcher
// Sends HTTP POST events to registered external URLs.
// Supports HMAC-SHA256 signatures, retry with exponential backoff,
// and per-company event filtering.

import crypto from 'crypto';
import { appEvents } from '../events.js';
import { db } from '../db/client.js';
import { settings } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

const WEBHOOK_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[]; // e.g. ['task.created', 'task.completed']
  secret: string;
  active: boolean;
  createdAt: string;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  deliveryId: string;
  data: unknown;
}

let dispatcherStarted = false;
let pendingDispatches = 0;
let dispatcherStopping = false;

/**
 * Load webhook configurations for a company from the settings table.
 */
export function loadWebhooks(companyId: string = ''): WebhookConfig[] {
  try {
    const row = db.select().from(settings)
      .where(and(eq(settings.key, 'webhooks'), eq(settings.companyId, companyId)))
      .get();
    if (!row?.value) return [];
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.filter((w: any) => w.active !== false) : [];
  } catch {
    return [];
  }
}

/**
 * Save webhook configurations for a company.
 */
export function saveWebhooks(companyId: string = '', configs: WebhookConfig[]): void {
  const now = new Date().toISOString();
  const existing = db.select().from(settings)
    .where(and(eq(settings.key, 'webhooks'), eq(settings.companyId, companyId)))
    .get();
  if (existing) {
    db.update(settings)
      .set({ value: JSON.stringify(configs), updatedAt: now })
      .where(and(eq(settings.key, 'webhooks'), eq(settings.companyId, companyId)))
      .run();
  } else {
    db.insert(settings).values({
      key: 'webhooks',
      companyId,
      value: JSON.stringify(configs),
      updatedAt: now,
    }).run();
  }
}

function signPayload(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

async function sendWebhook(
  config: WebhookConfig,
  payload: WebhookPayload
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const body = JSON.stringify(payload);
  const signature = signPayload(config.secret, body);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const res = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenCognit-Signature': `sha256=${signature}`,
        'X-OpenCognit-Event': payload.event,
        'X-OpenCognit-Delivery': payload.deliveryId,
        'User-Agent': 'OpenCognit-Webhook/1.0',
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      return { ok: true, status: res.status };
    }
    return { ok: false, status: res.status, error: `HTTP ${res.status}` };
  } catch (e: any) {
    clearTimeout(timeout);
    return { ok: false, error: e.message || String(e) };
  }
}

async function dispatchWithRetry(
  config: WebhookConfig,
  payload: WebhookPayload
): Promise<void> {
  pendingDispatches++;
  try {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const result = await sendWebhook(config, payload);
      if (result.ok) {
        console.log(`📤 Webhook ${payload.event} → ${config.url} (${payload.deliveryId}) OK`);
        return;
      }
      console.warn(
        `⚠️ Webhook ${payload.event} → ${config.url} attempt ${attempt}/${MAX_RETRIES} failed: ${result.error}`
      );
      if (attempt < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    console.error(`❌ Webhook ${payload.event} → ${config.url} permanently failed (${payload.deliveryId})`);
  } finally {
    pendingDispatches--;
  }
}

/**
 * Dispatch an event to all matching webhooks for a company.
 */
export function dispatchEvent(
  event: string,
  companyId: string,
  data: unknown
): void {
  const configs = loadWebhooks(companyId);
  if (configs.length === 0) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    deliveryId: crypto.randomUUID(),
    data,
  };

  for (const config of configs) {
    if (!config.active) continue;
    if (config.events.length > 0 && !config.events.includes(event) && !config.events.includes('*')) continue;

    // Fire-and-forget — don't block the caller
    dispatchWithRetry(config, payload).catch((err) => {
      console.error('Webhook dispatch error:', err);
    });
  }
}

/**
 * Start listening to appEvents and dispatching webhooks.
 */
export function startWebhookDispatcher(): void {
  if (dispatcherStarted) return;
  dispatcherStarted = true;

  appEvents.on('broadcast', (msg: { type: string; data?: any; companyId?: string }) => {
    if (!msg?.type) return;
    const companyId = msg.companyId || '';
    dispatchEvent(msg.type, companyId, msg.data || msg);
  });

  appEvents.on('webhook', (msg: { event: string; companyId: string; data: unknown }) => {
    if (!msg?.event) return;
    dispatchEvent(msg.event, msg.companyId || '', msg.data);
  });

  console.log('📡 Webhook dispatcher started');
}

export async function stopWebhookDispatcher(maxWaitMs: number = 10_000): Promise<void> {
  dispatcherStopping = true;
  dispatcherStarted = false;
  appEvents.removeAllListeners('broadcast');
  appEvents.removeAllListeners('webhook');

  const start = Date.now();
  while (pendingDispatches > 0 && Date.now() - start < maxWaitMs) {
    console.log(`⏳ Waiting for ${pendingDispatches} pending webhook dispatch(es)...`);
    await new Promise((r) => setTimeout(r, 500));
  }

  if (pendingDispatches > 0) {
    console.warn(`⚠️ Force-stopped webhook dispatcher with ${pendingDispatches} pending dispatch(es)`);
  } else {
    console.log('📡 Webhook dispatcher stopped gracefully');
  }
  dispatcherStopping = false;
}
