import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ホイストされたモック関数
const { mockGetGlobalSettings, mockUpdateGlobalSettings } = vi.hoisted(() => ({
  mockGetGlobalSettings: vi.fn(),
  mockUpdateGlobalSettings: vi.fn(),
}));

vi.mock('@/services/developer-settings-service', () => {
  return {
    DeveloperSettingsService: class {
      getGlobalSettings = mockGetGlobalSettings;
      updateGlobalSettings = mockUpdateGlobalSettings;
    },
  };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET, PUT } from '../route';

describe('/api/developer-settings/global', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/developer-settings/global', () => {
    it('グローバル設定を取得できる', async () => {
      const globalSettings = {
        id: 'settings-1',
        scope: 'GLOBAL',
        project_id: null,
        git_username: 'john.doe',
        git_email: 'john@example.com',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-15T10:30:00Z'),
      };

      mockGetGlobalSettings.mockResolvedValue(globalSettings);

      const request = new NextRequest('http://localhost:3000/api/developer-settings/global');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('settings-1');
      expect(data.scope).toBe('GLOBAL');
      expect(data.git_username).toBe('john.doe');
      expect(data.git_email).toBe('john@example.com');
      expect(mockGetGlobalSettings).toHaveBeenCalledTimes(1);
    });

    it('グローバル設定が存在しない場合は404を返す', async () => {
      mockGetGlobalSettings.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/developer-settings/global');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error.code).toBe('NOT_FOUND');
      expect(data.error.message).toContain('グローバル設定');
    });

    it('サーバーエラー時は500を返す', async () => {
      mockGetGlobalSettings.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/developer-settings/global');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('PUT /api/developer-settings/global', () => {
    it('グローバル設定を更新できる', async () => {
      const updatedSettings = {
        id: 'settings-1',
        scope: 'GLOBAL',
        project_id: null,
        git_username: 'john.doe',
        git_email: 'john@example.com',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-15T10:30:00Z'),
      };

      mockUpdateGlobalSettings.mockResolvedValue(updatedSettings);

      const request = new NextRequest('http://localhost:3000/api/developer-settings/global', {
        method: 'PUT',
        body: JSON.stringify({
          git_username: 'john.doe',
          git_email: 'john@example.com',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('settings-1');
      expect(data.scope).toBe('GLOBAL');
      expect(data.git_username).toBe('john.doe');
      expect(data.git_email).toBe('john@example.com');
      expect(mockUpdateGlobalSettings).toHaveBeenCalledWith({
        git_username: 'john.doe',
        git_email: 'john@example.com',
      });
    });

    it('git_usernameのみの更新ができる', async () => {
      const updatedSettings = {
        id: 'settings-1',
        scope: 'GLOBAL',
        project_id: null,
        git_username: 'new.user',
        git_email: null,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-15T10:30:00Z'),
      };

      mockUpdateGlobalSettings.mockResolvedValue(updatedSettings);

      const request = new NextRequest('http://localhost:3000/api/developer-settings/global', {
        method: 'PUT',
        body: JSON.stringify({
          git_username: 'new.user',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.git_username).toBe('new.user');
    });

    it('git_emailのみの更新ができる', async () => {
      const updatedSettings = {
        id: 'settings-1',
        scope: 'GLOBAL',
        project_id: null,
        git_username: null,
        git_email: 'new@example.com',
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-15T10:30:00Z'),
      };

      mockUpdateGlobalSettings.mockResolvedValue(updatedSettings);

      const request = new NextRequest('http://localhost:3000/api/developer-settings/global', {
        method: 'PUT',
        body: JSON.stringify({
          git_email: 'new@example.com',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.git_email).toBe('new@example.com');
    });

    it('不正なメールアドレス形式の場合は400を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/developer-settings/global', {
        method: 'PUT',
        body: JSON.stringify({
          git_email: 'invalid-email',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.details.field).toBe('git_email');
    });

    it('git_usernameが100文字を超える場合は400を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/developer-settings/global', {
        method: 'PUT',
        body: JSON.stringify({
          git_username: 'a'.repeat(101),
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.details.field).toBe('git_username');
    });

    it('git_usernameが空文字の場合は400を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/developer-settings/global', {
        method: 'PUT',
        body: JSON.stringify({
          git_username: '',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
      expect(data.error.details.field).toBe('git_username');
    });

    it('両方のフィールドが未指定の場合は400を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/developer-settings/global', {
        method: 'PUT',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('不正なJSONの場合は400を返す', async () => {
      const request = new NextRequest('http://localhost:3000/api/developer-settings/global', {
        method: 'PUT',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('サーバーエラー時は500を返す', async () => {
      mockUpdateGlobalSettings.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/developer-settings/global', {
        method: 'PUT',
        body: JSON.stringify({
          git_username: 'john.doe',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
