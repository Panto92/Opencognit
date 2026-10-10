import { authFetch } from '../../utils/api';

// Client side of POST /api/agents/:id/cli-chat — reads the NDJSON stream of ChatEvents
// (see server/services/cli-chat.ts) and hands each event to the caller.

export type ChatEvent =
  | { type: 'cwd'; cwd: string }
  | { type: 'session'; sessionId: string; model: string }
  | { type: 'step'; id: string; tool: string; input: Record<string, string> }
  | { type: 'step_done'; id: string; isError: boolean; output: string }
  | { type: 'text'; text: string }
  | { type: 'limit'; fiveHour: number | null; sevenDay: number | null; resetsAt: string | null; status: string }
  | { type: 'done'; status: string; error: string | null; durationMs: number; outputTokens: number; costUsdEquivalent: number };

export class ChatUnavailableError extends Error {}

export async function streamChat(
  agentId: string,
  body: { message: string; sessionId?: string; projectId?: string; history?: { role: 'user' | 'assistant'; content: string }[] },
  onEvent: (e: ChatEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await authFetch(`/api/agents/${agentId}/cli-chat`, { method: 'POST', body: JSON.stringify(body), signal });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw res.status === 400 && data.connectionType
      ? new ChatUnavailableError(data.connectionType)
      : new Error(data.error || `HTTP ${res.status}`);
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });
    const lines = buffered.split('\n');
    buffered = lines.pop()!;
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
  }
  if (buffered.trim()) onEvent(JSON.parse(buffered));
}

const base = (p: string) => p.split('/').filter(Boolean).pop() || p;

/** Human label for a tool step — "liest math.js", "sucht „discount“" … */
export function stepLabel(tool: string, input: Record<string, string>, de: boolean): string {
  switch (tool) {
    case 'Read': return `${de ? 'liest' : 'reads'} ${base(input.file_path ?? input.path ?? '')}`;
    case 'Grep': return `${de ? 'sucht' : 'searches'} „${input.pattern ?? ''}“`;
    case 'Glob': return `${de ? 'sucht Dateien' : 'finds files'} ${input.pattern ?? input.glob ?? ''}`;
    case 'LS': return `${de ? 'listet' : 'lists'} ${base(input.path ?? '')}`;
    case 'Bash': return input.description || `${de ? 'führt aus' : 'runs'}: ${input.command ?? ''}`;
    case 'WebSearch': return `${de ? 'sucht im Web' : 'searches the web'}: ${input.query ?? ''}`;
    case 'WebFetch': { try { return `${de ? 'liest' : 'reads'} ${new URL(input.url).hostname}`; } catch { return de ? 'liest eine Webseite' : 'reads a web page'; } }
    case 'TodoWrite': return de ? 'plant die Schritte' : 'plans the steps';
    case 'Task': return input.description || (de ? 'startet einen Hilfsagenten' : 'starts a helper agent');
    case 'Write': case 'Edit': case 'MultiEdit': return `${de ? 'ändert' : 'edits'} ${base(input.file_path ?? '')}`;
    default: return tool;
  }
}
