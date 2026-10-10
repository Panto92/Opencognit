// Structured Logger — JSON in production, emoji-pretty in development.
// Supports log levels, request correlation IDs, arbitrary context,
// and optional file output with rotation.

import fs from 'fs';
import path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  agentId?: string;
  companyId?: string;
  runId?: string;
  [key: string]: unknown;
}

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];
const EMOJI: Record<LogLevel, string> = {
  debug: '🔍',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
};

function envLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
  return LEVELS.includes(env) ? env : 'info';
}

// ── File Rotation ────────────────────────────────────────────────────────────

const LOG_FILE = process.env.LOG_FILE;
const LOG_MAX_SIZE = parseInt(process.env.LOG_MAX_SIZE || '52428800', 10); // 50 MB
const LOG_MAX_FILES = parseInt(process.env.LOG_MAX_FILES || '5', 10);

function rotateLogFile(filePath: string): void {
  try {
    // Delete oldest if it exists
    const oldest = `${filePath}.${LOG_MAX_FILES}`;
    if (fs.existsSync(oldest)) {
      fs.unlinkSync(oldest);
    }
    // Shift existing backups up
    for (let i = LOG_MAX_FILES - 1; i >= 1; i--) {
      const src = `${filePath}.${i}`;
      const dst = `${filePath}.${i + 1}`;
      if (fs.existsSync(src)) {
        fs.renameSync(src, dst);
      }
    }
    // Move current log to .1
    if (fs.existsSync(filePath)) {
      fs.renameSync(filePath, `${filePath}.1`);
    }
  } catch (e: any) {
    console.error('❌ Log rotation failed:', e.message);
  }
}

function appendToFile(filePath: string, line: string): void {
  try {
    // Check size and rotate if needed
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size >= LOG_MAX_SIZE) {
        rotateLogFile(filePath);
      }
    }
    fs.appendFileSync(filePath, line + '\n', 'utf-8');
  } catch (e: any) {
    console.error('❌ Failed to write log file:', e.message);
  }
}

// ── Logger ───────────────────────────────────────────────────────────────────

class Logger {
  private levelIndex: number;

  constructor(level: LogLevel = envLevel()) {
    this.levelIndex = LEVELS.indexOf(level);
  }

  setLevel(level: LogLevel) {
    this.levelIndex = LEVELS.indexOf(level);
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVELS.indexOf(level) >= this.levelIndex;
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    if (!this.shouldLog(level)) return;

    const isProd = process.env.NODE_ENV === 'production';
    const timestamp = new Date().toISOString();

    let consoleLine: string;
    let fileLine: string | null = null;

    if (isProd) {
      const entry: Record<string, unknown> = {
        timestamp,
        level,
        message,
        ...context,
      };
      consoleLine = JSON.stringify(entry);
      fileLine = consoleLine;
    } else {
      const emoji = EMOJI[level];
      const ctx = context && Object.keys(context).length > 0
        ? ' ' + JSON.stringify(context)
        : '';
      consoleLine = `${emoji} [${timestamp.slice(11, 19)}] ${message}${ctx}`;
      // Always write JSON to file for easier parsing
      fileLine = JSON.stringify({ timestamp, level, message, ...context });
    }

    // eslint-disable-next-line no-console
    console.log(consoleLine);

    if (LOG_FILE && fileLine) {
      appendToFile(LOG_FILE, fileLine);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }
}

export const logger = new Logger();
