// =============================================================================
// CLI Executor — Interactive bash execution with live SSE streaming
// =============================================================================
//
// Spawns bash commands with real-time stdout/stderr output.
// Used by the Agent Terminal in the War Room frontend.
//
// Security: validates commands against blocked patterns before execution.
// Workspace: resolves to the agent's safe working directory.
// Cleanup: kills child process on client disconnect or timeout.

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';
import { resolveAgentWorkdir } from '../adapters/workspace-guard.js';

// ── Active process registry (in-memory, per process) ─────────────────────────

interface ActiveExecution {
  process: ChildProcessWithoutNullStreams;
  startTime: number;
  command: string;
  agentId: string;
  companyId: string;
  killed: boolean;
}

const activeExecutions = new Map<string, ActiveExecution>();

// ── Security validation (simplified from sandbox.ts) ─────────────────────────

const DEFAULT_BLOCKED = [
  'rm -rf /', 'rm -rf /*', 'mkfs', 'dd if=/dev/zero', 'dd if=/dev/random',
  'dd if=/dev/urandom', ':(){ :|:& };:', 'chmod 777 /', 'chmod -R 777 /',
  '> /dev/sda', '> /dev/hda', 'mv / /dev/null',
];

const DANGEROUS_PATTERNS = [
  /;\s*rm\s+-rf\s+\//,
  /\|\s*bash\s+-i/,
  /\|\s*sh\s+-i/,
  /curl\s+.*\|\s*(bash|sh|zsh)/,
  /wget\s+.*\|\s*(bash|sh|zsh)/,
];

function validateCommand(cmd: string, cwd: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = cmd.trim();
  if (!trimmed) return { ok: false, reason: 'Empty command' };

  for (const b of DEFAULT_BLOCKED) {
    if (trimmed.toLowerCase().includes(b.toLowerCase())) {
      return { ok: false, reason: `Blocked pattern: "${b}"` };
    }
  }
  for (const p of DANGEROUS_PATTERNS) {
    if (p.test(trimmed)) {
      return { ok: false, reason: `Dangerous pattern: ${p.source}` };
    }
  }
  const normalizedCwd = path.resolve(cwd);
  const absolutePathMatches = trimmed.match(/(?:\s|^)(\/[^\s;|&<>\"'`]+)/g) || [];
  for (const match of absolutePathMatches) {
    const p = match.trim();
    if (!p.startsWith(normalizedCwd) && !p.startsWith('/tmp') && !p.startsWith('/dev/null')) {
      return { ok: false, reason: `Absolute path outside workspace blocked: ${p}` };
    }
  }
  if (/\.\.[\/\\]/.test(trimmed) || /\.\.$/.test(trimmed)) {
    return { ok: false, reason: 'Path traversal (../) blocked' };
  }
  return { ok: true };
}

// ── Execution API ────────────────────────────────────────────────────────────

export interface ExecutionCallbacks {
  onData: (chunk: string) => void;
  onError: (chunk: string) => void;
  onExit: (code: number | null, durationMs: number) => void;
}

export interface ExecutionResult {
  executionId: string;
  alreadyRunning?: boolean;
}

/**
 * Start a live bash execution for an agent.
 * Streams stdout/stderr in real-time via callbacks.
 * Returns an executionId that can be used to kill the process.
 */
export function startExecution(
  agentId: string,
  companyId: string,
  workspacePath: string | undefined,
  command: string,
  callbacks: ExecutionCallbacks,
  timeoutMs = 5 * 60 * 1000,
): ExecutionResult {
  // Check if this agent already has a running execution
  for (const [id, ex] of activeExecutions) {
    if (ex.agentId === agentId && !ex.killed) {
      return { executionId: id, alreadyRunning: true };
    }
  }

  const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const cwd = resolveAgentWorkdir(workspacePath);

  const validation = validateCommand(command, cwd);
  if (!validation.ok) {
    // Emit error synchronously so the client sees it immediately
    setTimeout(() => {
      callbacks.onError(validation.reason + '\n');
      callbacks.onExit(1, 0);
    }, 0);
    return { executionId };
  }

  const startTime = Date.now();

  // Spawn bash with -c
  const child = spawn('bash', ['-c', command], {
    cwd,
    env: {
      PATH: process.env.PATH || '/usr/bin:/bin',
      HOME: process.env.HOME || '/tmp',
      TMPDIR: '/tmp',
      OPENCOGNIT_EXPERT_ID: agentId,
      OPENCOGNIT_UNTERNEHMEN_ID: companyId,
      OPENCOGNIT_WORKSPACE: cwd,
    },
    detached: false,
  });

  const execution: ActiveExecution = {
    process: child,
    startTime,
    command,
    agentId,
    companyId,
    killed: false,
  };
  activeExecutions.set(executionId, execution);

  // stdout
  child.stdout?.setEncoding('utf-8');
  child.stdout?.on('data', (data: string) => {
    callbacks.onData(data);
  });

  // stderr
  child.stderr?.setEncoding('utf-8');
  child.stderr?.on('data', (data: string) => {
    callbacks.onError(data);
  });

  // exit
  child.on('exit', (code) => {
    const duration = Date.now() - startTime;
    execution.killed = true;
    activeExecutions.delete(executionId);
    callbacks.onExit(code ?? 0, duration);
  });

  child.on('error', (err) => {
    callbacks.onError(`Process error: ${err.message}\n`);
    execution.killed = true;
    activeExecutions.delete(executionId);
    callbacks.onExit(1, Date.now() - startTime);
  });

  // Timeout
  const timer = setTimeout(() => {
    if (!execution.killed) {
      callbacks.onError('\n[TIMEOUT] Execution killed after 5 minutes\n');
      killExecution(executionId);
    }
  }, timeoutMs);

  child.on('exit', () => clearTimeout(timer));
  child.on('error', () => clearTimeout(timer));

  return { executionId };
}

/**
 * Kill a running execution by its ID.
 */
export function killExecution(executionId: string): boolean {
  const ex = activeExecutions.get(executionId);
  if (!ex || ex.killed) return false;
  ex.killed = true;
  try {
    ex.process.kill('SIGTERM');
    // Force kill after 3s if still running
    setTimeout(() => {
      try { ex.process.kill('SIGKILL'); } catch { /* ignore */ }
    }, 3000);
  } catch { /* ignore */ }
  activeExecutions.delete(executionId);
  return true;
}

/**
 * Kill all running executions for a given agent.
 */
export function killAgentExecutions(agentId: string): number {
  let count = 0;
  for (const [id, ex] of activeExecutions) {
    if (ex.agentId === agentId && !ex.killed) {
      killExecution(id);
      count++;
    }
  }
  return count;
}

/**
 * Check if a CLI binary is available on this system.
 */
export async function checkCliHealth(binary: string): Promise<{
  available: boolean;
  version?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const child = spawn(binary, ['--version'], { timeout: 5000 });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += d; });
    child.stderr?.on('data', (d) => { stderr += d; });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ available: true, version: stdout.trim().split('\n')[0] });
      } else {
        resolve({ available: false, error: stderr.trim() || stdout.trim() || 'Unknown error' });
      }
    });
    child.on('error', (err) => {
      resolve({ available: false, error: err.message });
    });
  });
}
