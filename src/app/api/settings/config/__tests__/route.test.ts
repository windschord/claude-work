import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, PUT } from '../route';
import { NextRequest } from 'next/server';

vi.mock('@/services/config-service', () => ({
  getConfigService: vi.fn(() => ({
    getConfig: vi.fn(() => ({
      git_clone_timeout_minutes: 5,
      debug_mode_keep_volumes: false,
    })),
    save: vi.fn(),
  })),
}));

vi.mock('@/lib/validation', () => ({
  validateTimeoutMinutes: vi.fn((value) => {
    if (!Number.isInteger(value)) {
      throw new Error('Timeout must be an integer');
    }
    if (value < 1 || value > 30) {
      throw new Error('Timeout must be between 1 and 30 minutes');
    }
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('GET /api/settings/config', () => {
  it('設定を取得できる', async () => {
    const response = await GET();

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.config).toEqual({
      git_clone_timeout_minutes: 5,
      debug_mode_keep_volumes: false,
    });
  });

  it('エラー時は500を返す', async () => {
    const { getConfigService } = await import('@/services/config-service');
    vi.mocked(getConfigService).mockReturnValue({
      getConfig: vi.fn(() => {
        throw new Error('Config error');
      }),
    } as any);

    const response = await GET();

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });
});

describe('PUT /api/settings/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('設定を更新できる', async () => {
    const { getConfigService } = await import('@/services/config-service');
    const mockSave = vi.fn();
    vi.mocked(getConfigService).mockReturnValue({
      getConfig: vi.fn(() => ({
        git_clone_timeout_minutes: 10,
        debug_mode_keep_volumes: true,
      })),
      save: mockSave,
    } as any);

    const request = new NextRequest('http://localhost/api/settings/config', {
      method: 'PUT',
      body: JSON.stringify({
        git_clone_timeout_minutes: 10,
        debug_mode_keep_volumes: true,
      }),
    });

    const response = await PUT(request);

    expect(response.status).toBe(200);
    expect(mockSave).toHaveBeenCalledWith({
      git_clone_timeout_minutes: 10,
      debug_mode_keep_volumes: true,
    });

    const data = await response.json();
    expect(data.config).toEqual({
      git_clone_timeout_minutes: 10,
      debug_mode_keep_volumes: true,
    });
  });

  it('部分的な更新が可能', async () => {
    const { getConfigService } = await import('@/services/config-service');
    const mockSave = vi.fn();
    vi.mocked(getConfigService).mockReturnValue({
      getConfig: vi.fn(() => ({
        git_clone_timeout_minutes: 15,
        debug_mode_keep_volumes: false,
      })),
      save: mockSave,
    } as any);

    const request = new NextRequest('http://localhost/api/settings/config', {
      method: 'PUT',
      body: JSON.stringify({
        git_clone_timeout_minutes: 15,
      }),
    });

    const response = await PUT(request);

    expect(response.status).toBe(200);
    expect(mockSave).toHaveBeenCalledWith({
      git_clone_timeout_minutes: 15,
    });
  });

  it('不正なJSONは400を返す', async () => {
    const request = new NextRequest('http://localhost/api/settings/config', {
      method: 'PUT',
      body: 'invalid json',
    });

    const response = await PUT(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid JSON in request body');
  });

  it('無効なタイムアウト値は400を返す', async () => {
    const request = new NextRequest('http://localhost/api/settings/config', {
      method: 'PUT',
      body: JSON.stringify({
        git_clone_timeout_minutes: 50,
      }),
    });

    const response = await PUT(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Timeout must be between 1 and 30 minutes');
  });

  it('debug_mode_keep_volumesがbooleanでない場合は400を返す', async () => {
    const request = new NextRequest('http://localhost/api/settings/config', {
      method: 'PUT',
      body: JSON.stringify({
        debug_mode_keep_volumes: 'true',
      }),
    });

    const response = await PUT(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('debug_mode_keep_volumes must be a boolean');
  });

  it('保存失敗時は500を返す', async () => {
    const { getConfigService } = await import('@/services/config-service');
    vi.mocked(getConfigService).mockReturnValue({
      getConfig: vi.fn(() => ({
        git_clone_timeout_minutes: 5,
        debug_mode_keep_volumes: false,
      })),
      save: vi.fn(() => {
        throw new Error('Save error');
      }),
    } as any);

    const request = new NextRequest('http://localhost/api/settings/config', {
      method: 'PUT',
      body: JSON.stringify({
        git_clone_timeout_minutes: 10,
      }),
    });

    const response = await PUT(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });
});
