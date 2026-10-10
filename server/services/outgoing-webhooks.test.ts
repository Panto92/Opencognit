import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadWebhooks,
  saveWebhooks,
  dispatchEvent,
  startWebhookDispatcher,
  stopWebhookDispatcher,
  type WebhookConfig,
} from './outgoing-webhooks.js';
import { appEvents } from '../events.js';

// Mock fetch globally
const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

describe('Outgoing Webhooks', () => {
  const TEST_COMPANY = 'test-company-webhooks';

  beforeEach(() => {
    mockFetch.mockReset();
    saveWebhooks(TEST_COMPANY, []);
    stopWebhookDispatcher();
  });

  it('saves and loads webhooks', () => {
    const configs: WebhookConfig[] = [
      {
        id: 'wh-1',
        url: 'https://example.com/hook',
        events: ['task.created'],
        secret: 'secret123',
        active: true,
        createdAt: new Date().toISOString(),
      },
    ];

    saveWebhooks(TEST_COMPANY, configs);
    const loaded = loadWebhooks(TEST_COMPANY);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].url).toBe('https://example.com/hook');
    expect(loaded[0].events).toContain('task.created');
  });

  it('dispatches event to matching webhook', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    const configs: WebhookConfig[] = [
      {
        id: 'wh-2',
        url: 'https://hooks.slack.com/test',
        events: ['task.created'],
        secret: 'shh',
        active: true,
        createdAt: new Date().toISOString(),
      },
    ];
    saveWebhooks(TEST_COMPANY, configs);

    dispatchEvent('task.created', TEST_COMPANY, { taskId: 't1', title: 'Test' });

    // Wait for async dispatch
    await new Promise((r) => setTimeout(r, 200));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe('https://hooks.slack.com/test');
    expect(call[1].method).toBe('POST');
    expect(call[1].headers['X-OpenCognit-Event']).toBe('task.created');
    expect(call[1].headers['X-OpenCognit-Signature']).toMatch(/^sha256=/);

    const body = JSON.parse(call[1].body);
    expect(body.event).toBe('task.created');
    expect(body.data.taskId).toBe('t1');
    expect(body.deliveryId).toBeTruthy();
  });

  it('does not dispatch to webhooks with mismatched events', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    const configs: WebhookConfig[] = [
      {
        id: 'wh-3',
        url: 'https://example.com/hook',
        events: ['task.completed'],
        secret: 'shh',
        active: true,
        createdAt: new Date().toISOString(),
      },
    ];
    saveWebhooks(TEST_COMPANY, configs);

    dispatchEvent('task.created', TEST_COMPANY, { taskId: 't2' });

    await new Promise((r) => setTimeout(r, 200));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('dispatches all events when wildcard is set', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    const configs: WebhookConfig[] = [
      {
        id: 'wh-4',
        url: 'https://example.com/all',
        events: ['*'],
        secret: 'shh',
        active: true,
        createdAt: new Date().toISOString(),
      },
    ];
    saveWebhooks(TEST_COMPANY, configs);

    dispatchEvent('agent.heartbeat', TEST_COMPANY, { agentId: 'a1' });

    await new Promise((r) => setTimeout(r, 200));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries failed webhooks', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    const configs: WebhookConfig[] = [
      {
        id: 'wh-5',
        url: 'https://example.com/flaky',
        events: ['task.created'],
        secret: 'shh',
        active: true,
        createdAt: new Date().toISOString(),
      },
    ];
    saveWebhooks(TEST_COMPANY, configs);

    dispatchEvent('task.created', TEST_COMPANY, { taskId: 't3' });

    await new Promise((r) => setTimeout(r, 4000));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('listens to appEvents broadcast', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200 } as Response);

    const configs: WebhookConfig[] = [
      {
        id: 'wh-6',
        url: 'https://example.com/events',
        events: ['task.completed'],
        secret: 'shh',
        active: true,
        createdAt: new Date().toISOString(),
      },
    ];
    saveWebhooks(TEST_COMPANY, configs);

    startWebhookDispatcher();
    appEvents.emit('broadcast', {
      type: 'task.completed',
      companyId: TEST_COMPANY,
      data: { taskId: 't99' },
    });

    await new Promise((r) => setTimeout(r, 300));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
