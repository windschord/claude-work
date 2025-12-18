import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateRequiredEnvVars } from '../env-validation';

describe('環境変数バリデーション', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('すべての必須環境変数が設定されている場合、エラーをスローしない', () => {
    process.env.CLAUDE_WORK_TOKEN = 'test-token';
    process.env.SESSION_SECRET = 'test-secret-32-characters-long!!';
    process.env.DATABASE_URL = 'file:./prisma/data/test.db';

    expect(() => {
      validateRequiredEnvVars();
    }).not.toThrow();
  });

  it('CLAUDE_WORK_TOKENが未設定の場合、エラーをスローする', () => {
    delete process.env.CLAUDE_WORK_TOKEN;
    process.env.SESSION_SECRET = 'test-secret-32-characters-long!!';
    process.env.DATABASE_URL = 'file:./prisma/data/test.db';

    expect(() => {
      validateRequiredEnvVars();
    }).toThrow('CLAUDE_WORK_TOKEN environment variable is not set');
  });

  it('SESSION_SECRETが未設定の場合、エラーをスローする', () => {
    process.env.CLAUDE_WORK_TOKEN = 'test-token';
    delete process.env.SESSION_SECRET;
    process.env.DATABASE_URL = 'file:./prisma/data/test.db';

    expect(() => {
      validateRequiredEnvVars();
    }).toThrow('SESSION_SECRET environment variable is not set');
  });

  it('SESSION_SECRETが32文字未満の場合、エラーをスローする', () => {
    process.env.CLAUDE_WORK_TOKEN = 'test-token';
    process.env.SESSION_SECRET = 'short';
    process.env.DATABASE_URL = 'file:./prisma/data/test.db';

    expect(() => {
      validateRequiredEnvVars();
    }).toThrow('SESSION_SECRET must be at least 32 characters');
  });

  it('DATABASE_URLが未設定の場合、エラーをスローする', () => {
    process.env.CLAUDE_WORK_TOKEN = 'test-token';
    process.env.SESSION_SECRET = 'test-secret-32-characters-long!!';
    delete process.env.DATABASE_URL;

    expect(() => {
      validateRequiredEnvVars();
    }).toThrow('DATABASE_URL environment variable is not set');
  });

  it('複数の環境変数が未設定の場合、すべてのエラーを含むメッセージをスローする', () => {
    delete process.env.CLAUDE_WORK_TOKEN;
    delete process.env.SESSION_SECRET;
    delete process.env.DATABASE_URL;

    expect(() => {
      validateRequiredEnvVars();
    }).toThrow(/CLAUDE_WORK_TOKEN.*SESSION_SECRET.*DATABASE_URL/s);
  });
});
