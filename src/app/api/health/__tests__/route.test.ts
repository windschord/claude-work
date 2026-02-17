import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const { mockValidateSchemaIntegrity } = vi.hoisted(() => ({
  mockValidateSchemaIntegrity: vi.fn(),
}));

vi.mock('@/lib/schema-check', () => ({
  validateSchemaIntegrity: mockValidateSchemaIntegrity,
}));

vi.mock('@/lib/db', () => ({
  db: {},
}));

vi.mock('@/services/docker-service', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DockerService: vi.fn().mockImplementation(function (this: any) {
    this.isEnabled = vi.fn().mockReturnValue(false);
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn() },
}));

import { GET } from '../route';

describe('GET /api/health', () => {
  beforeEach(() => {
    mockValidateSchemaIntegrity.mockReset();
    // 詳細情報を有効化してテスト
    process.env.HEALTH_DETAILS = 'true';
  });

  afterEach(() => {
    delete process.env.HEALTH_DETAILS;
  });

  it('スキーマ整合性OKの場合はHTTP 200を返す', async () => {
    mockValidateSchemaIntegrity.mockReturnValue({
      valid: true,
      missingColumns: [],
      checkedTables: ['Project', 'Session'],
      timestamp: new Date('2026-02-17T12:00:00Z'),
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.checks.database.status).toBe('pass');
    expect(body.checks.database.missingColumns).toEqual([]);
  });

  it('スキーマ不一致の場合はHTTP 503を返す', async () => {
    mockValidateSchemaIntegrity.mockReturnValue({
      valid: false,
      missingColumns: [
        { table: 'Session', column: 'active_connections', expectedType: 'integer' },
      ],
      checkedTables: ['Session'],
      timestamp: new Date('2026-02-17T12:00:00Z'),
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe('unhealthy');
    expect(body.checks.database.status).toBe('fail');
    expect(body.checks.database.missingColumns).toHaveLength(1);
  });

  it('例外発生時はHTTP 500を返す', async () => {
    mockValidateSchemaIntegrity.mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.status).toBe('unhealthy');
  });

  it('レスポンスにtimestampを含む', async () => {
    mockValidateSchemaIntegrity.mockReturnValue({
      valid: true,
      missingColumns: [],
      checkedTables: ['Project'],
      timestamp: new Date('2026-02-17T12:00:00Z'),
    });

    const response = await GET();
    const body = await response.json();

    expect(body.timestamp).toBe('2026-02-17T12:00:00.000Z');
  });
});
