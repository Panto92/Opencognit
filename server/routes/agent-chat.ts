// =============================================================================
// Agent chat route — one chat turn on the agent's coding CLI, streamed as NDJSON
// (one ChatEvent per line). Ported from the relaunch's routes/agent-chat.ts.
//
//   POST /api/agents/:id/cli-chat   { message, sessionId?, projectId?, history[] }
//
// The CLI runs in the project's folder (or the company's), read-only — see
// services/cli-chat.ts. Closing the request (the user presses stop or leaves)
// aborts the CLI.
//
// Provider coverage: only CLI providers can chat (claude-code, kimi-cli,
// codex-cli, gemini-cli — see CHAT_CLIS). Unlike the relaunch there is no
// "Roles & models" API here, so the CEO chats on its own configured
// connectionType like any other agent; a non-CLI provider gets a clear 400
// with { error, connectionType } instead of a silent CLI fallback.
// =============================================================================

import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { agents, companies, projects } from '../db/schema.js';
import { authMiddleware, requireResourceAccess } from '../middleware/auth.js';
import { resolveAgentWorkdir } from '../adapters/workspace-guard.js';
import { isChatCli, runChatTurn, type ChatEvent } from '../services/cli-chat.js';

const router = Router();
const MAX_MESSAGE_CHARS = 100_000;
const MAX_HISTORY = 100;
const MAX_HISTORY_ENTRY_CHARS = 20_000;

router.post('/api/agents/:id/cli-chat', authMiddleware, requireResourceAccess('agent'), (req, res) => {
  void (async () => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const sessionId = typeof req.body?.sessionId === 'string' && /^[0-9a-f-]{36}$/i.test(req.body.sessionId) ? req.body.sessionId : undefined;
    const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : undefined;
    // Conversation so far — re-sent as plain text on CLIs without a resumable session (Claude Code
    // resumes its session and ignores this).
    const history = (Array.isArray(req.body?.history) ? req.body.history : [])
      .slice(-MAX_HISTORY)
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_ENTRY_CHARS) }));
    if (!message) return res.status(400).json({ error: 'message is required' });
    if (message.length > MAX_MESSAGE_CHARS) return res.status(413).json({ error: 'message too long' });

    const agent = db.select().from(agents).where(eq(agents.id, req.params.id as string)).get();
    if (!agent) return res.status(404).json({ error: 'agent not found' });

    const chatCli = agent.connectionType;
    if (!isChatCli(chatCli)) {
      return res.status(400).json({ error: `chat is not available for "${agent.connectionType}" yet`, connectionType: agent.connectionType });
    }

    // Working folder: the project's (if given and in the same company), else the company's.
    // resolveAgentWorkdir enforces the workspace guard and always returns a safe path.
    const company = db.select({ workDir: companies.workDir }).from(companies).where(eq(companies.id, agent.companyId)).get();
    const project = projectId
      ? db.select({ workDir: projects.workDir }).from(projects).where(and(eq(projects.id, projectId), eq(projects.companyId, agent.companyId))).get()
      : undefined;
    const cwd = resolveAgentWorkdir(project?.workDir || company?.workDir || null);

    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const controller = new AbortController();
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    const send = (e: ChatEvent | { type: 'cwd'; cwd: string }) => { if (!res.writableEnded) res.write(JSON.stringify(e) + '\n'); };

    send({ type: 'cwd', cwd });
    try {
      await runChatTurn(chatCli, {
        message, cwd, sessionId, history,
        agentName: agent.name, agentRole: agent.role, isLead: !!agent.isOrchestrator,
        signal: controller.signal,
        onEvent: send,
      });
    } catch (err: any) {
      send({ type: 'done', status: 'failed', error: err?.message ?? 'chat failed', durationMs: 0, outputTokens: 0, costUsdEquivalent: 0 });
    }
    res.end();
  })().catch((err) => {
    console.error('[agent-chat] cli-chat failed:', err);
    if (!res.headersSent) res.status(500).json({ error: 'chat failed' });
    else if (!res.writableEnded) res.end();
  });
});

export default router;
