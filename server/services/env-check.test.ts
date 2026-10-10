import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateEnvironment } from './env-check.js';

describe('Environment Validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Preserve critical env vars that tests need
    const jwt = process.env.JWT_SECRET;
    const betterAuth = process.env.BETTER_AUTH_SECRET;
    const nodeEnv = process.env.NODE_ENV;
    process.env = {
      JWT_SECRET: jwt,
      BETTER_AUTH_SECRET: betterAuth,
      NODE_ENV: nodeEnv,
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('passes when required vars are set', () => {
    process.env.JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-chars';
    process.env.BETTER_AUTH_SECRET = 'another-very-long-secret-for-auth-32-chars';
    process.env.NODE_ENV = 'development';

    const result = validateEnvironment();
    expect(result.ok).toBe(true);
  });

  it('fails when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;
    process.env.BETTER_AUTH_SECRET = 'another-very-long-secret-for-auth-32-chars';
    process.env.NODE_ENV = 'development';

    const result = validateEnvironment();
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('JWT_SECRET'))).toBe(true);
  });

  it('warns about short JWT_SECRET in production', () => {
    process.env.JWT_SECRET = 'short';
    process.env.BETTER_AUTH_SECRET = 'another-very-long-secret-for-auth-32-chars';
    process.env.NODE_ENV = 'production';

    const result = validateEnvironment();
    expect(result.errors.some((e) => e.includes('JWT_SECRET must be >= 32'))).toBe(true);
  });

  it('validates LOG_LEVEL values', () => {
    process.env.JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-chars';
    process.env.BETTER_AUTH_SECRET = 'another-very-long-secret-for-auth-32-chars';
    process.env.LOG_LEVEL = 'invalid-level';
    process.env.NODE_ENV = 'development';

    const result = validateEnvironment();
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('LOG_LEVEL'))).toBe(true);
  });

  it('warns about http APP_URL in production', () => {
    process.env.JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-chars';
    process.env.BETTER_AUTH_SECRET = 'another-very-long-secret-for-auth-32-chars';
    process.env.NODE_ENV = 'production';
    process.env.APP_URL = 'http://example.com';

    const result = validateEnvironment();
    expect(result.warnings.some((w) => w.includes('https://'))).toBe(true);
  });
});
