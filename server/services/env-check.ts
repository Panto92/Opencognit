// Environment Validation — runs at startup to catch misconfigurations early.
// Exits with code 1 in production if critical variables are missing.

export interface EnvCheck {
  name: string;
  required: boolean;
  validator?: (value: string) => boolean;
  hint?: string;
}

const CHECKS: EnvCheck[] = [
  { name: 'JWT_SECRET', required: true, hint: 'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"' },
  { name: 'BETTER_AUTH_SECRET', required: true, hint: 'Must be >= 32 characters' },
  { name: 'PORT', required: false, validator: (v) => /^(\d{2,5})$/.test(v), hint: 'Default: 3201' },
  { name: 'DATABASE_URL', required: false, hint: 'Optional — defaults to SQLite' },
  { name: 'REDIS_URL', required: false, hint: 'Optional — enables multi-node queue' },
  { name: 'ENCRYPTION_KEY', required: false, hint: '64-char hex; auto-generated if omitted' },
  { name: 'LOG_LEVEL', required: false, validator: (v) => ['debug', 'info', 'warn', 'error'].includes(v.toLowerCase()), hint: 'One of: debug, info, warn, error' },
  { name: 'LOG_FILE', required: false, hint: 'Optional — enables file logging with rotation' },
  { name: 'NODE_ENV', required: false, validator: (v) => ['development', 'production', 'test'].includes(v), hint: 'development | production | test' },
];

export function validateEnvironment(): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = process.env.NODE_ENV === 'production';

  for (const check of CHECKS) {
    const value = process.env[check.name];

    if (check.required && !value) {
      const msg = `Missing required env var: ${check.name}${check.hint ? ` (${check.hint})` : ''}`;
      errors.push(msg);
      continue;
    }

    if (value && check.validator && !check.validator(value)) {
      const msg = `Invalid value for ${check.name}: "${value}"${check.hint ? ` (${check.hint})` : ''}`;
      errors.push(msg);
      continue;
    }

    // Production-specific warnings
    if (isProd) {
      if (check.name === 'JWT_SECRET' && value && value.length < 32) {
        errors.push(`JWT_SECRET must be >= 32 characters in production (got ${value.length})`);
      }
      if (check.name === 'BETTER_AUTH_SECRET' && value && value.length < 32) {
        errors.push(`BETTER_AUTH_SECRET must be >= 32 characters in production (got ${value.length})`);
      }
      if (check.name === 'ENCRYPTION_KEY' && !value) {
        warnings.push('ENCRYPTION_KEY not set — will auto-generate on first start. Set explicitly for multi-node deployments.');
      }
    }
  }

  // Warn if running production without HTTPS
  if (isProd && process.env.APP_URL?.startsWith('http://')) {
    warnings.push('APP_URL uses http:// — consider https:// for production');
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Run validation and exit on critical errors in production.
 */
export function runStartupChecks(): void {
  const { ok, errors, warnings } = validateEnvironment();

  for (const w of warnings) {
    console.warn(`⚠️  ${w}`);
  }

  if (!ok) {
    for (const e of errors) {
      console.error(`❌ ${e}`);
    }
    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 Startup aborted due to configuration errors.');
      process.exit(1);
    } else {
      console.warn('⚠️  Configuration errors detected (non-fatal in development).');
    }
  }
}
