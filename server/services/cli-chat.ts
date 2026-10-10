// CLI chat — runs one chat turn on a coding CLI and turns its stream into CLI-neutral events.
//
// Ported from the relaunch's server/services/cli-chat.ts (+ core/claude-runner.ts and
// core/cli-turn.ts, which it depended on). The chat UI only knows ChatEvent. Each CLI gets a
// small translator: Claude Code resumes its session per conversation (--resume); kimi/codex/
// gemini have no resumable session here, so each turn is a one-shot run whose prompt is the
// whole conversation as plain text — system prompt plus history plus the new message.
//
// Adaptations to this codebase:
//  - Binary resolution goes through adapters/cli-paths.ts (resolveCliPath: runtime override →
//    env var → command name) and spawns use getEnrichedEnv() so ~/.local/bin is on PATH.
//  - No bubblewrap home-hiding (this codebase has no sandbox layer); chat turns are read-only
//    by instruction, and Claude Code additionally runs in --restricted mode with a read-only
//    tool allow-list. The caller must resolve cwd through adapters/workspace-guard.ts
//    (resolveAgentWorkdir) — runChatTurn double-checks with isSafeWorkdir and falls back to
//    SAFE_DEFAULT_WORKDIR.
//
// Chat turns are read-only on purpose: the agent may read, search and explain, but not change
// files. Changes go through tasks with review and approval.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

import { resolveCliPath, getEnrichedEnv } from '../adapters/cli-paths.js';
import { isSafeWorkdir, SAFE_DEFAULT_WORKDIR } from '../adapters/workspace-guard.js';

export type ChatEvent =
  | { type: 'session'; sessionId: string; model: string }
  | { type: 'step'; id: string; tool: string; input: Record<string, string> }
  | { type: 'step_done'; id: string; isError: boolean; output: string }
  | { type: 'text'; text: string }
  | { type: 'limit'; fiveHour: number | null; sevenDay: number | null; resetsAt: string | null; status: string }
  | { type: 'done'; status: string; error: string | null; durationMs: number; outputTokens: number; costUsdEquivalent: number };

export interface ChatTurn {
  message: string;
  cwd: string;
  /** Continue an earlier conversation with this CLI session (Claude Code only). */
  sessionId?: string;
  /**
   * The conversation so far (Claude Code resumes its session instead). Sent along as plain text
   * on CLIs without a resumable session, so a turn can see what was already said.
   */
  history?: { role: 'user' | 'assistant'; content: string }[];
  agentName: string;
  agentRole: string;
  /** The company's lead (CEO): plans with the user and hands work to the team. */
  isLead?: boolean;
  /** Model and thinking depth — Claude Code only; other CLIs use their own default model. */
  model?: string;
  effort?: 'low' | 'medium' | 'high';
  signal: AbortSignal;
  onEvent: (e: ChatEvent) => void;
}

/** The chat-capable CLIs, named like the agents' connectionType. */
export const CHAT_CLIS = ['claude-code', 'kimi-cli', 'codex-cli', 'gemini-cli'] as const;
export type ChatCliName = (typeof CHAT_CLIS)[number];
export const isChatCli = (connectionType: string) => (CHAT_CLIS as readonly string[]).includes(connectionType);

// ─── Shared run types ────────────────────────────────────────────────────────

interface RateLimitInfo {
  status: string; // 'allowed' | 'allowed_warning' | 'rejected' | ...
  fiveHourUtilization: number | null;
  sevenDayUtilization: number | null;
  resetsAt: Date | null;
  limitingWindow: string | null;
  fiveHourResetsAt: Date | null;
  sevenDayResetsAt: Date | null;
}

interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };

type RunEvent =
  | { type: 'init'; sessionId: string; model: string }
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; isError: boolean; content: string }
  | { type: 'rate_limit'; info: RateLimitInfo }
  | { type: 'stderr'; line: string };

type RunStatus = 'completed' | 'failed' | 'rate_limited' | 'aborted' | 'idle_timeout';

interface RunResult {
  status: RunStatus;
  sessionId: string | null;
  model: string | null;
  finalText: string;
  usage: Usage;
  costUsdEquivalent: number;
  numTurns: number;
  durationMs: number;
  rateLimit: RateLimitInfo | null;
  exitCode: number | null;
  error: string | null;
}

function emptyResult(): RunResult {
  return {
    status: 'failed',
    sessionId: null,
    model: null,
    finalText: '',
    usage: ZERO_USAGE,
    costUsdEquivalent: 0,
    numTurns: 0,
    durationMs: 0,
    rateLimit: null,
    exitCode: null,
    error: null,
  };
}

// ─── Spawn boilerplate (ported from the relaunch's core/cli-spawn.ts) ────────

const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const STDERR_TAIL_CHARS = 8_000;
const STDOUT_MAX_CHARS = 1_000_000;

interface CliSpawnOptions {
  file: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  /** Text written to stdin and closed; omit/`null` for a CLI that never reads stdin. */
  stdin?: string | null;
  idleTimeoutMs?: number;
  signal?: AbortSignal;
  onStdoutLine?: (line: string) => void;
}

interface CliSpawnResult {
  code: number | null;
  stdout: string;
  stderr: string;
  aborted: boolean;
  idle: boolean;
  spawnError: string | null;
  durationMs: number;
}

/** Runs one CLI process to completion; never throws, reports everything on the result. */
function spawnCli(opts: CliSpawnOptions): Promise<CliSpawnResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(opts.file, opts.args, {
      cwd: opts.cwd,
      stdio: [opts.stdin != null ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      env: opts.env ?? getEnrichedEnv(),
    });

    const stdoutChunks: string[] = [];
    let stdoutLen = 0;
    let stderr = '';
    let aborted = false;
    let idle = false;
    let spawnError: string | null = null;

    const idleMs = opts.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    let timer = setTimeout(() => { idle = true; child.kill('SIGTERM'); }, idleMs);
    const touch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { idle = true; child.kill('SIGTERM'); }, idleMs);
    };

    const onAbort = () => { aborted = true; child.kill('SIGTERM'); };
    if (opts.signal?.aborted) onAbort();
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    child.on('error', (err) => { spawnError = err.message; });
    if (opts.stdin != null) {
      child.stdin?.on('error', () => { /* the CLI died before reading the prompt; handled on close */ });
      child.stdin?.end(opts.stdin);
    }

    readline.createInterface({ input: child.stdout! }).on('line', (line) => {
      touch();
      stdoutChunks.push(line);
      stdoutLen += line.length + 1;
      while (stdoutLen > STDOUT_MAX_CHARS && stdoutChunks.length > 1) stdoutLen -= stdoutChunks.shift()!.length + 1;
      try { opts.onStdoutLine?.(line); } catch { /* a broken listener must not fail the run */ }
    });

    child.stderr!.on('data', (d: Buffer) => {
      touch();
      stderr = (stderr + d.toString()).slice(-STDERR_TAIL_CHARS);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
      resolve({ code, stdout: stdoutChunks.join('\n'), stderr, aborted, idle, spawnError, durationMs: Date.now() - started });
    });
  });
}

/** An absolute path for a command name (PATH plus any extra install folders), or the name unchanged. */
function resolveBin(cmd: string, extraDirs: string[] = []): string {
  if (path.isAbsolute(cmd)) return cmd;
  const dirs = [...(getEnrichedEnv().PATH ?? '').split(path.delimiter), ...extraDirs];
  for (const d of dirs) {
    const p = path.join(d, cmd);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch { /* next */ }
  }
  return cmd;
}

// ─── Claude Code (stream-json, resumable session) ────────────────────────────

interface ClaudeRunOptions {
  prompt: string;
  cwd: string;
  resumeSessionId?: string;
  model?: string;
  effort?: 'low' | 'medium' | 'high';
  allowedTools?: string[];
  disallowedTools?: string[];
  appendSystemPrompt?: string;
  maxTurns?: number;
  /** Claude Code's --restricted mode: no command/code tools, settings files ignored. */
  restricted?: boolean;
  signal?: AbortSignal;
  onEvent?: (event: RunEvent) => void;
}

function buildClaudeArgs(opts: ClaudeRunOptions): string[] {
  const args = ['-p', '--output-format', 'stream-json', '--verbose'];
  if (opts.resumeSessionId) args.push('--resume', opts.resumeSessionId);
  if (opts.model) args.push('--model', opts.model);
  if (opts.effort) args.push('--effort', opts.effort);
  args.push('--permission-mode', 'default');
  if (opts.allowedTools?.length) args.push('--allowedTools', opts.allowedTools.join(','));
  if (opts.disallowedTools?.length) args.push('--disallowedTools', opts.disallowedTools.join(','));
  if (opts.appendSystemPrompt) args.push('--append-system-prompt', opts.appendSystemPrompt);
  if (opts.maxTurns) args.push('--max-turns', String(opts.maxTurns));
  if (opts.restricted) args.push('--restricted', '--strict-mcp-config');
  return args;
}

const epoch = (v: unknown) => (typeof v === 'number' ? new Date(v * 1000) : null);

function parseRateLimit(raw: any): RateLimitInfo {
  const windows = raw?.unifiedWindows ?? {};
  const fiveHourResetsAt = epoch(windows.five_hour?.resetsAt);
  return {
    status: String(raw?.status ?? 'unknown'),
    fiveHourUtilization: windows.five_hour?.utilization ?? null,
    sevenDayUtilization: windows.seven_day?.utilization ?? null,
    resetsAt: epoch(raw?.resetsAt) ?? fiveHourResetsAt,
    limitingWindow: typeof raw?.rateLimitType === 'string' ? raw.rateLimitType : null,
    fiveHourResetsAt,
    sevenDayResetsAt: epoch(windows.seven_day?.resetsAt),
  };
}

const MAX_TOOL_RESULT_CHARS = 4000;

/** Tool results arrive as a string or as an array of content blocks; keep the text, bounded. */
function toolResultText(content: unknown): string {
  const text = typeof content === 'string'
    ? content
    : Array.isArray(content) ? content.map((c: any) => (typeof c?.text === 'string' ? c.text : '')).join('') : '';
  return text.length > MAX_TOOL_RESULT_CHARS ? text.slice(0, MAX_TOOL_RESULT_CHARS) + '\n…' : text;
}

/** One Claude Code session via `claude -p --output-format stream-json`; never throws. */
function runClaude(opts: ClaudeRunOptions): Promise<RunResult> {
  const started = Date.now();
  const bin = resolveCliPath('claude', 'OPENCOGNIT_CLAUDE_PATH', 'claude');
  const args = buildClaudeArgs(opts);
  const emit = (e: RunEvent) => {
    try { opts.onEvent?.(e); } catch { /* a broken listener must not kill the run */ }
  };

  const result: RunResult = { ...emptyResult(), sessionId: opts.resumeSessionId ?? null };

  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: opts.cwd,
      env: getEnrichedEnv({ ...process.env, CLAUDE_CODE_ENTRYPOINT: 'opencognit' }),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let gotResult = false;
    let forcedStatus: RunStatus | null = null;
    const stderrTail: string[] = [];

    const kill = (status: RunStatus) => {
      if (forcedStatus) return;
      forcedStatus = status;
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 5000).unref();
    };

    const idleMs = DEFAULT_IDLE_TIMEOUT_MS;
    let idleTimer = setTimeout(() => kill('idle_timeout'), idleMs);
    const touch = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => kill('idle_timeout'), idleMs);
    };

    const onAbort = () => kill('aborted');
    if (opts.signal?.aborted) onAbort();
    opts.signal?.addEventListener('abort', onAbort, { once: true });

    child.stdin.on('error', () => { /* child died before reading the prompt; handled on close */ });
    child.stdin.end(opts.prompt);

    readline.createInterface({ input: child.stderr }).on('line', (line) => {
      touch();
      stderrTail.push(line);
      if (stderrTail.length > 20) stderrTail.shift();
      emit({ type: 'stderr', line });
    });

    readline.createInterface({ input: child.stdout }).on('line', (line) => {
      touch();
      let msg: any;
      try { msg = JSON.parse(line); } catch { return; }

      switch (msg.type) {
        case 'system':
          if (msg.subtype === 'init') {
            result.sessionId = msg.session_id ?? result.sessionId;
            result.model = msg.model ?? null;
            emit({ type: 'init', sessionId: result.sessionId ?? '', model: result.model ?? '' });
          }
          break;
        case 'assistant':
          for (const block of msg.message?.content ?? []) {
            if (block.type === 'text' && block.text) emit({ type: 'text', text: block.text });
            if (block.type === 'tool_use') emit({ type: 'tool_use', id: block.id, name: block.name, input: block.input });
          }
          break;
        case 'user':
          for (const block of msg.message?.content ?? []) {
            if (block.type === 'tool_result') {
              emit({ type: 'tool_result', toolUseId: block.tool_use_id, isError: !!block.is_error, content: toolResultText(block.content) });
            }
          }
          break;
        case 'rate_limit_event': {
          result.rateLimit = parseRateLimit(msg.rate_limit_info);
          emit({ type: 'rate_limit', info: result.rateLimit });
          break;
        }
        case 'result': {
          gotResult = true;
          const u = msg.usage ?? {};
          result.usage = {
            inputTokens: u.input_tokens ?? 0,
            outputTokens: u.output_tokens ?? 0,
            cacheReadTokens: u.cache_read_input_tokens ?? 0,
            cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
          };
          result.costUsdEquivalent = msg.total_cost_usd ?? 0;
          result.numTurns = msg.num_turns ?? 0;
          result.sessionId = msg.session_id ?? result.sessionId;
          result.finalText = typeof msg.result === 'string' ? msg.result : '';
          result.status = msg.is_error ? 'failed' : 'completed';
          if (msg.is_error) result.error = result.finalText || msg.subtype || 'unknown error';
          break;
        }
      }
    });

    child.on('error', (err) => {
      result.error = err.message;
    });

    child.on('close', (code) => {
      clearTimeout(idleTimer);
      opts.signal?.removeEventListener('abort', onAbort);
      result.exitCode = code;
      result.durationMs = Date.now() - started;

      if (forcedStatus) {
        result.status = forcedStatus;
        result.error ??= forcedStatus === 'aborted' ? 'aborted by user' : `no output for ${idleMs / 1000}s`;
      } else if (result.rateLimit?.status === 'rejected') {
        result.status = 'rate_limited';
        result.error = `usage limit reached${result.rateLimit.resetsAt ? `, resets ${result.rateLimit.resetsAt.toISOString()}` : ''}`;
      } else if (!gotResult) {
        result.status = 'failed';
        result.error ??= stderrTail.join('\n') || `claude exited with code ${code} and no result`;
      }
      resolve(result);
    });
  });
}

// ─── Non-Claude CLIs (one-shot transcript turns) ─────────────────────────────
//
//   kimi:   `kimi -p "<prompt>" --output-format stream-json --agent-file <read-only.md>`,
//           stream-json stdout (Kimi Code CLI; install folder ~/.kimi-code/bin).
//   codex:  `codex --approval-mode full-auto --sandbox read-only "<prompt>"`.
//   gemini: `gemini -p "<prompt>"` (no sandbox flag; the instruction says read-only).
// Long codex/gemini prompts go through a file the CLI reads (Linux argv limit ~128 KiB).

type TurnCli = 'kimi' | 'codex' | 'gemini';

interface CliIdentity {
  name: string;
  notFoundHint: string;
  loginHint: string;
}

const KIMI: CliIdentity = {
  name: 'kimi',
  notFoundHint: 'Install the Kimi Code CLI (https://platform.moonshot.ai) and sign in, or set the path in Settings / OPENCOGNIT_KIMI_PATH.',
  loginHint: 'run `kimi login`',
};

const CODEX: CliIdentity = {
  name: 'codex',
  notFoundHint: 'Install it (npm install -g @openai/codex) and sign in (`codex login`), or set the path in Settings / CODEX_PATH.',
  loginHint: 'run `codex login`',
};

const GEMINI: CliIdentity = {
  name: 'gemini',
  notFoundHint: 'Install it (npm install -g @google/gemini-cli) and sign in (`gemini auth login`), or set the path in Settings / GEMINI_PATH.',
  loginHint: 'run `gemini auth login`',
};

function kimiBinDir(): string {
  return path.join(process.env.KIMI_CODE_HOME ?? path.join(os.homedir(), '.kimi-code'), 'bin');
}

/** The binary a chat CLI resolves to: cli-paths override → env var → PATH (+ the CLI's install folder). */
function cliBin(cli: TurnCli): string {
  switch (cli) {
    case 'kimi': return resolveBin(resolveCliPath('kimi', 'OPENCOGNIT_KIMI_PATH', 'kimi'), [kimiBinDir()]);
    case 'codex': return resolveBin(resolveCliPath('codex', 'CODEX_PATH', 'codex'));
    case 'gemini': return resolveBin(resolveCliPath('gemini', 'GEMINI_PATH', 'gemini'));
  }
}

/** The Kimi agent file for read-only chat turns: its tool allowlist names only read/search tools. */
const CHAT_KIMI_AGENT_FILE = `---
name: opencognit-chat
description: Read-only chat assistant for OpenCognit. Answers questions about the project.
tools:
  - Read
  - Grep
  - Glob
  - WebSearch
---

You are a read-only assistant in an OpenCognit workspace: you may read and search the project and
the web, but never create or change files, never run commands, and never install anything.
`;

const UNKNOWN_RATE_LIMIT: RateLimitInfo = {
  status: 'rejected',
  fiveHourUtilization: null,
  sevenDayUtilization: null,
  resetsAt: null,
  limitingWindow: null,
  fiveHourResetsAt: null,
  sevenDayResetsAt: null,
};

function binNotFound(cli: CliIdentity, bin: string, result: RunResult): RunResult {
  result.status = 'failed';
  result.error = `${cli.name} CLI not found at "${bin}". ${cli.notFoundHint}`;
  return result;
}

/** These CLIs report no token counts: estimate from text length, as the server adapters do. */
function estimatedUsage(prompt: string, text: string): Usage {
  return { ...ZERO_USAGE, inputTokens: Math.ceil(prompt.length / 4), outputTokens: Math.ceil(text.length / 4) };
}

/** Spawn failure → "not found"; abort/idle → its status; quota in stderr → rate_limited; other non-zero → failed. */
function mapCliResult(cli: CliIdentity, r: CliSpawnResult, result: RunResult, emit: (e: RunEvent) => void): RunResult {
  result.durationMs = r.durationMs;
  result.exitCode = r.code;
  if (r.spawnError) {
    result.status = 'failed';
    result.error = `${cli.name} CLI could not be started (${r.spawnError}). ${cli.notFoundHint}`;
    return result;
  }
  if (r.aborted) {
    result.status = 'aborted';
    result.error = 'aborted by user';
    return result;
  }
  if (r.idle) {
    result.status = 'idle_timeout';
    result.error = `${cli.name}: no output for too long`;
    return result;
  }
  if (/usage limit|quota|rate.?limit|too many requests/i.test(r.stderr)) {
    result.status = 'rate_limited';
    result.error = `${cli.name}: usage limit reached`;
    result.rateLimit = UNKNOWN_RATE_LIMIT;
    emit({ type: 'rate_limit', info: UNKNOWN_RATE_LIMIT });
    return result;
  }
  if (r.code !== 0) {
    result.status = 'failed';
    if (/auth_error|401|403|not (logged in|authenticated)|login/i.test(r.stderr)) {
      result.error = `${cli.name}: not signed in (${cli.loginHint})`;
    } else {
      const line = r.stderr.split('\n').map((l) => l.trim()).filter((l) => l && !/^warning:/i.test(l)).find((l) => /error/i.test(l));
      result.error = `${cli.name}: ${line ?? `exited with code ${r.code}`}`.slice(0, 300);
    }
    return result;
  }
  result.status = 'completed';
  return result;
}

/** Linux refuses a single argument over 128 KiB; longer prompts go through a file the CLI reads. */
const MAX_ARG_BYTES = 100_000;

interface CliTurnOptions {
  /** The full transcript (system prompt + conversation so far + the new message). */
  prompt: string;
  cwd: string;
  signal?: AbortSignal;
  onEvent?: (event: RunEvent) => void;
}

async function runKimiTurn(opts: CliTurnOptions): Promise<RunResult> {
  const result = emptyResult();
  // The transcript is a `-p` argument; Linux refuses a single argument over 128 KiB. Fail
  // honestly instead of truncating — a shorter history is the caller's job (the route caps it).
  if (Buffer.byteLength(opts.prompt) > MAX_ARG_BYTES) {
    result.status = 'failed';
    result.error = `kimi: transcript too large for a command-line argument (${Buffer.byteLength(opts.prompt)} bytes, limit ~${MAX_ARG_BYTES}) — shorten the conversation`;
    return result;
  }
  const emit = (e: RunEvent) => { try { opts.onEvent?.(e); } catch { /* a broken listener must not kill the run */ } };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-turn-kimi-'));
  try {
    const agentFile = path.join(dir, 'read-only.md');
    fs.writeFileSync(agentFile, CHAT_KIMI_AGENT_FILE);
    const bin = cliBin('kimi');
    try { fs.accessSync(bin, fs.constants.X_OK); } catch { return binNotFound(KIMI, bin, result); }
    const args = ['-p', opts.prompt, '--output-format', 'stream-json', '--agent-file', agentFile];

    // stream-json on stdout: assistant messages (content, tool_calls), tool results, meta lines.
    let text = '';
    const raw = await spawnCli({
      file: bin,
      args,
      cwd: opts.cwd,
      env: getEnrichedEnv({ ...process.env, TMPDIR: dir, PATH: `${kimiBinDir()}${path.delimiter}${process.env.PATH ?? ''}` }),
      signal: opts.signal,
      onStdoutLine: (line) => {
        let msg: any;
        try { msg = JSON.parse(line); } catch { return; }
        if (msg.type === 'session.resume_hint' && msg.session_id) {
          result.sessionId = String(msg.session_id);
          emit({ type: 'init', sessionId: result.sessionId, model: result.model ?? '' });
        }
        const usage = msg.usage ?? msg.token_usage;
        if (usage && typeof usage === 'object') {
          result.usage = {
            inputTokens: usage.input_tokens ?? usage.inputTokens ?? result.usage.inputTokens,
            outputTokens: usage.output_tokens ?? usage.outputTokens ?? result.usage.outputTokens,
            cacheReadTokens: usage.cache_read_tokens ?? usage.cacheReadTokens,
            cacheCreationTokens: usage.cache_creation_tokens ?? usage.cacheCreationTokens,
          };
        }
        if (msg.role === 'assistant') {
          if (typeof msg.content === 'string' && msg.content) { text += `${msg.content}\n`; emit({ type: 'text', text: msg.content }); }
          for (const call of msg.tool_calls ?? []) {
            let input: unknown = call?.function?.arguments;
            try { input = JSON.parse(String(input)); } catch { /* keep the raw string */ }
            emit({ type: 'tool_use', id: String(call?.id ?? ''), name: String(call?.function?.name ?? ''), input });
          }
        }
        if (msg.role === 'tool' || (msg.tool_call_id && msg.role !== 'assistant')) {
          const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? '');
          emit({ type: 'tool_result', toolUseId: String(msg.tool_call_id ?? ''), isError: false, content: content.slice(0, 4000) });
        }
      },
    });

    result.finalText = text.trim();
    if (result.usage.inputTokens + result.usage.outputTokens === 0) result.usage = estimatedUsage(opts.prompt, result.finalText);
    return mapCliResult(KIMI, raw, result, emit);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function runPlainTurn(
  cli: Exclude<TurnCli, 'kimi'>,
  opts: CliTurnOptions,
  buildArgs: (prompt: string, dir: string) => string[],
): Promise<RunResult> {
  const identity = cli === 'codex' ? CODEX : GEMINI;
  const result = emptyResult();
  const emit = (e: RunEvent) => { try { opts.onEvent?.(e); } catch { /* a broken listener must not kill the run */ } };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `oc-turn-${cli}-`));
  try {
    let prompt = opts.prompt;
    if (Buffer.byteLength(prompt) > MAX_ARG_BYTES) {
      const file = path.join(dir, 'instructions.md');
      fs.writeFileSync(file, prompt);
      prompt = `Read the file ${file} completely — it contains your task instructions — then follow those instructions exactly.`;
    }
    const bin = cliBin(cli);
    try { fs.accessSync(bin, fs.constants.X_OK); } catch { return binNotFound(identity, bin, result); }

    const raw = await spawnCli({
      file: bin,
      args: buildArgs(prompt, dir),
      cwd: opts.cwd,
      env: getEnrichedEnv({ ...process.env, TMPDIR: dir }),
      signal: opts.signal,
    });
    result.finalText = raw.stdout.trim();
    result.usage = estimatedUsage(opts.prompt, result.finalText);
    return mapCliResult(identity, raw, result, emit);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function runCodexTurn(opts: CliTurnOptions): Promise<RunResult> {
  // Read-only on purpose: a chat turn must never change the project.
  return runPlainTurn('codex', opts, (prompt) => ['--approval-mode', 'full-auto', '--sandbox', 'read-only', prompt]);
}

function runGeminiTurn(opts: CliTurnOptions): Promise<RunResult> {
  return runPlainTurn('gemini', opts, (prompt) => ['-p', prompt]);
}

// ─── Turn assembly ───────────────────────────────────────────────────────────

// Tools a chat turn may use: reading and searching only. Enforced by Claude Code's --restricted
// mode (no command/code tools, user settings ignored) — an allow-list alone is not enough, because
// the user's own ~/.claude/settings.json allow-rules (e.g. Bash(node:*)) would otherwise apply.
const READ_ONLY_TOOLS = ['Read', 'Grep', 'Glob', 'WebSearch', 'TodoWrite'];
const DENIED_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash'];

/** The few input fields worth showing for a step (never whole file contents). */
function stepInput(input: unknown): Record<string, string> {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of ['file_path', 'path', 'pattern', 'command', 'url', 'query', 'description', 'glob']) {
    const v = src[key];
    if (typeof v === 'string' && v) out[key] = v.slice(0, 300);
  }
  return out;
}

function systemPrompt(name: string, role: string, isLead: boolean) {
  const who = isLead
    ? `You are ${name}, the CEO of this company in OpenCognit, talking with the user in a chat. You lead a team of AI agents: you clarify what the user wants, turn it into tasks, and your team builds it. Speak as the one in charge of getting it done ("I'll have the team build …"), not as someone who hands the user a to-do.`
    : `You are ${name} (${role}), an agent in OpenCognit, talking with the user in a chat.`;
  return `${who}
In this chat you can only read and search the project: answer questions, explain code, plan work.
You cannot change files, run commands, install packages or start servers here, and you have no skills or other tools — never suggest otherwise.

How work gets done in OpenCognit: the user creates tasks; agents do them, a critic reviews every
result, and anything uncertain is escalated to the user for approval instead of being silently
auto-approved. Suggest concrete tasks when the user wants something built or changed.
Answer in the user's language. Be concise; use Markdown.`;
}

async function runClaudeTurn(turn: ChatTurn): Promise<void> {
  const r = await runClaude({
    prompt: turn.message,
    cwd: turn.cwd,
    resumeSessionId: turn.sessionId,
    model: turn.model ?? 'sonnet',
    effort: turn.effort ?? 'medium',
    allowedTools: READ_ONLY_TOOLS,
    disallowedTools: DENIED_TOOLS,
    appendSystemPrompt: systemPrompt(turn.agentName, turn.agentRole, !!turn.isLead),
    maxTurns: 30,
    restricted: true,
    signal: turn.signal,
    onEvent: (e: RunEvent) => {
      switch (e.type) {
        case 'init': turn.onEvent({ type: 'session', sessionId: e.sessionId, model: e.model }); break;
        case 'tool_use': turn.onEvent({ type: 'step', id: e.id, tool: e.name, input: stepInput(e.input) }); break;
        case 'tool_result': turn.onEvent({ type: 'step_done', id: e.toolUseId, isError: e.isError, output: e.content }); break;
        case 'text': turn.onEvent({ type: 'text', text: e.text }); break;
        case 'rate_limit': turn.onEvent({
          type: 'limit', status: e.info.status, fiveHour: e.info.fiveHourUtilization, sevenDay: e.info.sevenDayUtilization,
          resetsAt: (e.info.fiveHourResetsAt ?? e.info.resetsAt)?.toISOString() ?? null,
        }); break;
      }
    },
  });
  turn.onEvent({
    type: 'done', status: r.status, error: r.error, durationMs: r.durationMs,
    outputTokens: r.usage.outputTokens, costUsdEquivalent: r.costUsdEquivalent,
  });
}

/** Plain-text conversation for CLIs without resumable sessions. */
function transcript(system: string, exchanges: { role: 'user' | 'assistant'; content: string }[]): string {
  const parts = [system.trim()];
  if (exchanges.length) {
    parts.push('## Conversation so far');
    for (const e of exchanges) {
      parts.push(`### ${e.role === 'user' ? 'User' : 'Assistant'}\n\n${e.content.trim()}`);
    }
  }
  return parts.join('\n\n');
}

/** How much of the conversation is re-sent per turn on CLIs without session resume. */
const MAX_HISTORY = 40;
const MAX_HISTORY_CHARS = 80_000;

/**
 * One chat turn on a non-Claude CLI: the whole conversation (system prompt, history, new
 * message) goes in as plain text — these CLIs have no resumable session here.
 */
async function runCliChatTurn(cli: TurnCli, turn: ChatTurn): Promise<void> {
  const history = (turn.history ?? []).slice(-MAX_HISTORY);
  let total = 0;
  const exchanges: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of history) {
    if (total + m.content.length > MAX_HISTORY_CHARS) break;
    total += m.content.length;
    exchanges.push({ role: m.role, content: m.content });
  }
  exchanges.push({ role: 'user', content: turn.message });

  let textSeen = false;
  const r = await (cli === 'kimi' ? runKimiTurn : cli === 'codex' ? runCodexTurn : runGeminiTurn)({
    prompt: transcript(systemPrompt(turn.agentName, turn.agentRole, !!turn.isLead), exchanges),
    cwd: turn.cwd,
    signal: turn.signal,
    onEvent: (e: RunEvent) => {
      switch (e.type) {
        case 'init': turn.onEvent({ type: 'session', sessionId: e.sessionId, model: e.model }); break;
        case 'tool_use': turn.onEvent({ type: 'step', id: e.id, tool: e.name, input: stepInput(e.input) }); break;
        case 'tool_result': turn.onEvent({ type: 'step_done', id: e.toolUseId, isError: e.isError, output: e.content }); break;
        case 'text': textSeen = true; turn.onEvent({ type: 'text', text: e.text }); break;
        case 'rate_limit': turn.onEvent({
          type: 'limit', status: e.info.status, fiveHour: e.info.fiveHourUtilization, sevenDay: e.info.sevenDayUtilization,
          resetsAt: (e.info.fiveHourResetsAt ?? e.info.resetsAt)?.toISOString() ?? null,
        }); break;
      }
    },
  });
  // codex/gemini print the whole answer at the end (no stream): surface it as one text event.
  if (!textSeen && r.finalText && r.status === 'completed') turn.onEvent({ type: 'text', text: r.finalText });
  turn.onEvent({
    type: 'done', status: r.status, error: r.error, durationMs: r.durationMs,
    outputTokens: r.usage.outputTokens, costUsdEquivalent: r.costUsdEquivalent,
  });
}

/** Runs one chat turn on the CLI behind `connectionType`. */
export async function runChatTurn(connectionType: string, turn: ChatTurn): Promise<void> {
  // Defense in depth: the route resolves cwd via resolveAgentWorkdir already.
  const cwd = isSafeWorkdir(turn.cwd) ? turn.cwd : SAFE_DEFAULT_WORKDIR;
  const safeTurn = cwd === turn.cwd ? turn : { ...turn, cwd };
  switch (connectionType) {
    case 'claude-code': return runClaudeTurn(safeTurn);
    case 'kimi-cli': return runCliChatTurn('kimi', safeTurn);
    case 'codex-cli': return runCliChatTurn('codex', safeTurn);
    case 'gemini-cli': return runCliChatTurn('gemini', safeTurn);
    default:
      turn.onEvent({ type: 'done', status: 'failed', error: `chat is not available for "${connectionType}" yet`, durationMs: 0, outputTokens: 0, costUsdEquivalent: 0 });
  }
}
