// OpenCognit API Client — talks to the local OpenCognit server

const DEFAULT_BASE_URL = 'http://localhost:3201';

function getBaseUrl(): string {
  return process.env.OPENCOGNIT_URL || DEFAULT_BASE_URL;
}

function getAuthHeaders(): Record<string, string> {
  const token = process.env.OPENCOGNIT_TOKEN;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function ocFetch(path: string, opts: RequestInit = {}) {
  const url = `${getBaseUrl()}${path}`;
  const resp = await fetch(url, {
    ...opts,
    headers: { ...getAuthHeaders(), ...opts.headers },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => 'Unknown error');
    throw new Error(`OpenCognit API error: ${resp.status} ${text}`);
  }
  return resp.json();
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export async function listTasks(companyId: string) {
  return ocFetch(`/api/companies/${companyId}/tasks`);
}

export async function getTask(taskId: string) {
  return ocFetch(`/api/tasks/${taskId}`);
}

export async function createTask(companyId: string, data: {
  title: string;
  description?: string;
  priority?: string;
  assignedTo?: string;
}) {
  return ocFetch(`/api/companies/${companyId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Agents ───────────────────────────────────────────────────────────────────

export async function listAgents(companyId: string) {
  return ocFetch(`/api/companies/${companyId}/agents`);
}

export async function getAgent(agentId: string) {
  return ocFetch(`/api/agents/${agentId}`);
}

export async function wakeAgent(agentId: string) {
  return ocFetch(`/api/agents/${agentId}/wakeup`, { method: 'POST' });
}

// ── Knowledge ────────────────────────────────────────────────────────────────

export async function searchKnowledge(companyId: string, query: string) {
  return ocFetch(`/api/companies/${companyId}/knowledge/search?q=${encodeURIComponent(query)}`);
}

// ── Company ──────────────────────────────────────────────────────────────────

export async function getCompanies() {
  return ocFetch('/api/companies');
}
