import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockMigrate } = vi.hoisted(() => ({
  mockMigrate: vi.fn(),
}));

vi.mock('drizzle-orm/better-sqlite3/migrator', () => ({
  migrate: mockMigrate,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { runMigrations } from '../migrate';
import { logger } from '@/lib/logger';

describe('runMigrations', () => {
  const mockDb = {} as Parameters<typeof runMigrations>[0];
  const migrationsFolder = '/app/drizzle';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('migrate()を正しい引数で呼び出す', () => {
    runMigrations(mockDb, migrationsFolder);

    expect(mockMigrate).toHaveBeenCalledWith(mockDb, { migrationsFolder });
  });

  it('成功時にログを出力する', () => {
    runMigrations(mockDb, migrationsFolder);

    expect(logger.info).toHaveBeenCalledWith(
      'Running database migrations...',
      { migrationsFolder },
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Database migrations completed successfully',
    );
  });

  it('失敗時にエラーログを出力しthrowする', () => {
    const error = new Error('migration failed');
    mockMigrate.mockImplementation(() => { throw error; });

    expect(() => runMigrations(mockDb, migrationsFolder)).toThrow('migration failed');
    expect(logger.error).toHaveBeenCalledWith(
      'Database migration failed',
      expect.objectContaining({
        error: 'migration failed',
        migrationsFolder,
      }),
    );
  });

  it('非Errorオブジェクトの例外もログに記録する', () => {
    mockMigrate.mockImplementation(() => { throw 'string error'; });

    expect(() => runMigrations(mockDb, migrationsFolder)).toThrow('string error');
    expect(logger.error).toHaveBeenCalledWith(
      'Database migration failed',
      expect.objectContaining({
        error: 'string error',
      }),
    );
  });
});
